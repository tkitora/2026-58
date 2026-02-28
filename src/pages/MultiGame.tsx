import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase-oauth/supabase";
import { loadGoogleMaps } from "../lib/googleMaps/loader";
import { createStreetViewGame } from "../lib/googleMaps/streetviewGame";

type GamePhase = "fetching" | "playing" | "waiting" | "revealing";

export default function MultiGame() {
  const navigate = useNavigate();
  const panoRef = useRef<HTMLDivElement | null>(null);
  const answerMapRef = useRef<HTMLDivElement | null>(null);

  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const gameRef = useRef<ReturnType<typeof createStreetViewGame> | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const roomId = sessionStorage.getItem("roomid");
  const playerId = sessionStorage.getItem("playerid");

  const [isHost, setIsHost] = useState(false);
  const [roomData, setRoomData] = useState<any>(null);
  const [phase, setPhase] = useState<GamePhase>("fetching");
  
  const [nowQuestion, setNowQuestion] = useState(1);
  const [timeLeft, setTimeLeft] = useState(30);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [myAnswers, setMyAnswers] = useState<number[]>([]);

  // リアルタイムな判定用にRefで状態を保持
  const activeIdsRef = useRef<string[]>([]);
  const nowQuestionRef = useRef(1);

  useEffect(() => { nowQuestionRef.current = nowQuestion; }, [nowQuestion]);

  // 全員回答完了チェック関数
  const checkAllAnswered = async () => {
    if (!roomId) return;
    const { data: players } = await supabase.from("players").select("playerid, answers").eq("roomid", roomId);
    if (!players) return;

    const activeIds = activeIdsRef.current;
    const currentQ = nowQuestionRef.current;
    
    // 現在接続中のプレイヤーのみを対象に判定
    const activePlayersData = players.filter(p => activeIds.includes(p.playerid));
    const allAnswered = activePlayersData.length > 0 && activePlayersData.every(p => p.answers && p.answers.length >= currentQ);

    if (allAnswered) {
      setPhase("revealing");
    }
  };

  useEffect(() => {
    if (!roomId || !playerId) {
      navigate("/multi");
      return;
    }

    let isMounted = true;
    let presenceChannel: ReturnType<typeof supabase.channel>;
    let dbChannel: ReturnType<typeof supabase.channel>;

    const initGame = async () => {
      await loadGoogleMaps();
      gameRef.current = createStreetViewGame();

      if (panoRef.current && !panoramaRef.current) {
        panoramaRef.current = new google.maps.StreetViewPanorama(panoRef.current, {
          addressControl: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
          panControl: false,
          zoomControl: false,
          linksControl: false,
          clickToGo: false,
        });
      }

      const { data: room } = await supabase.from("room").select("*").eq("roomid", roomId).single();
      if (!room || !isMounted) return;
      
      setRoomData(room);
      setIsHost(room.host_id === playerId);
      setNowQuestion(room.now);
      setTimeLeft(room.timeLimit);

      // Presenceによる参加者監視
      presenceChannel = supabase.channel(`game_presence_${roomId}`, {
        config: { presence: { key: playerId } },
      });

      presenceChannel
        .on("presence", { event: "sync" }, () => {
          if (!isMounted) return;
          const state = presenceChannel.presenceState();
          activeIdsRef.current = Object.keys(state);
          // 誰かが退出したことで「全員回答済み」状態になる可能性があるのでチェック
          checkAllAnswered();
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && isMounted) {
            await presenceChannel.track({ playerid: playerId });
          }
        });

      // DBによる進行と回答の監視
      dbChannel = supabase.channel(`game_db_${roomId}`);
      dbChannel
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "room" }, (payload: any) => {
          if (!isMounted || payload.new.roomid !== roomId) return;
          const newRoom = payload.new;
          setRoomData(newRoom);
          
          setNowQuestion((prev) => {
            if (newRoom.now > prev) {
              setPhase("fetching");
              setTimeLeft(newRoom.timeLimit);
              setSelectedAnswer(null);
              return newRoom.now;
            }
            return prev;
          });

          setPhase((prevPhase) => {
            if (newRoom.pano && newRoom.now === nowQuestionRef.current && prevPhase === "fetching") {
              panoramaRef.current?.setPano(newRoom.pano);
              return "playing";
            }
            return prevPhase;
          });

          if (newRoom.stats === "finished") {
            navigate("/multiresult");
          }
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "players" }, (payload: any) => {
          if (!isMounted || payload.new.roomid !== roomId) return;
          checkAllAnswered();
        })
        .subscribe();
    };

    initGame();

    return () => {
      isMounted = false;
      if (presenceChannel) supabase.removeChannel(presenceChannel);
      if (dbChannel) supabase.removeChannel(dbChannel);
    };
  }, [navigate, roomId, playerId]);

  // ホストの問題取得処理
  useEffect(() => {
    if (isHost && phase === "fetching" && roomData) {
      let isFetching = true;
      const fetchQuestion = async () => {
        if (!gameRef.current || !panoramaRef.current) return;
        try {
          const rand = Math.random();
          const mode = rand < 0.3 ? "DOU" : rand < 0.8 ? "NARA" : "OTHER";
          const q = await gameRef.current.newView({ mode, panorama: panoramaRef.current });
          
          if (!isFetching) return;

          // ★ 修正箇所：パノラマIDが生成されるまでイベントリスナーで確実に待機する
          let pano = panoramaRef.current.getPano();
          if (!pano) {
            pano = await new Promise<string>((resolve) => {
              const listener = google.maps.event.addListener(panoramaRef.current!, 'pano_changed', () => {
                const newPano = panoramaRef.current!.getPano();
                if (newPano) {
                  google.maps.event.removeListener(listener);
                  resolve(newPano);
                }
              });
            });
          }

          if (!isFetching) return;

          const lat = q.panoLatLng.lat();
          const lng = q.panoLatLng.lng();

          const updatedAnswers = [...(roomData.answers || [])];
          updatedAnswers[nowQuestion - 1] = q.prefName;

          await supabase.from("room").update({
            lat, long: lng, pano, answers: updatedAnswers
          }).eq("roomid", roomId);

        } catch (error) {
          console.error("問題取得エラー:", error);
        }
      };
      fetchQuestion();
      return () => { isFetching = false; };
    }
  }, [isHost, phase, roomData, nowQuestion, roomId]);

  // タイマー処理
  useEffect(() => {
    if (phase !== "playing") return;
    if (timeLeft <= 0) {
      handleAnswerSubmit(selectedAnswer ?? 3); // 3=未回答扱い
      return;
    }
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [phase, timeLeft, selectedAnswer]);

  // 答え合わせフェーズのマップ描画
  useEffect(() => {
    if (phase === "revealing" && answerMapRef.current && roomData && gameRef.current) {
      answerMapRef.current.innerHTML = "";
      requestAnimationFrame(() => {
        mapRef.current = new google.maps.Map(answerMapRef.current!, {
          center: { lat: roomData.lat, lng: roomData.long },
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        new google.maps.Marker({
          map: mapRef.current,
          position: { lat: roomData.lat, lng: roomData.long },
          title: `正解: ${roomData.answers[nowQuestion - 1]}`,
        });
      });
    }
  }, [phase, roomData, nowQuestion]);

  const handleAnswerSubmit = async (answerValue: number) => {
    setPhase("waiting");
    const updatedMyAnswers = [...myAnswers];
    updatedMyAnswers[nowQuestion - 1] = answerValue;
    setMyAnswers(updatedMyAnswers);

    await supabase.from("players").update({
      answers: updatedMyAnswers
    }).eq("playerid", playerId);
  };

  const handleNextOrResult = async () => {
    if (!roomData) return;
    if (nowQuestion >= roomData.amount) {
      await supabase.from("room").update({ stats: "finished" }).eq("roomid", roomId);
    } else {
      await supabase.from("room").update({
        now: nowQuestion + 1,
        pano: null
      }).eq("roomid", roomId);
    }
  };

  const choiceBtnBase = "w-[120px] py-2 rounded-lg border border-gray-300 font-bold transition";

  return (
    <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover py-6 px-5 flex flex-col items-center">
      <div className="border-2 rounded-xl border-black bg-white/80 backdrop-blur p-4 w-[95%] sm:w-4/5 md:w-2/3 max-w-5xl">
        
        <div className="flex justify-between items-center mb-4 px-2">
          <div className="text-2xl font-bold">第 {nowQuestion} / {roomData?.amount} 問</div>
          <div className={`text-2xl font-bold ${timeLeft <= 5 ? "text-red-600 animate-pulse" : "text-gray-800"}`}>
            残り: {timeLeft}秒
          </div>
        </div>

        <div className="relative w-full h-[500px] rounded-lg overflow-hidden border border-gray-300 bg-black">
          <div ref={panoRef} className="w-full h-full" />
          {phase === "fetching" && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white text-2xl font-bold z-10">
              景色を取得中...
            </div>
          )}
        </div>

        {phase === "playing" && (
          <div className="flex flex-col items-center gap-4 mt-6">
            <div className="flex gap-4">
              <button
                onClick={() => setSelectedAnswer(0)}
                className={`${choiceBtnBase} ${selectedAnswer === 0 ? "bg-amber-400 border-amber-600 text-white shadow-inner" : "bg-gray-50 hover:bg-gray-100"}`}
              >なら！</button>
              <button
                onClick={() => setSelectedAnswer(1)}
                className={`${choiceBtnBase} ${selectedAnswer === 1 ? "bg-amber-400 border-amber-600 text-white shadow-inner" : "bg-gray-50 hover:bg-gray-100"}`}
              >どう！</button>
              <button
                onClick={() => setSelectedAnswer(2)}
                className={`${choiceBtnBase} ${selectedAnswer === 2 ? "bg-amber-400 border-amber-600 text-white shadow-inner" : "bg-gray-50 hover:bg-gray-100"}`}
              >それ以外！</button>
            </div>
            
            <button
              onClick={() => handleAnswerSubmit(selectedAnswer ?? 3)}
              className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 active:scale-95 transition mt-2"
            >
              次へ進む（確定）
            </button>
          </div>
        )}

        {phase === "waiting" && (
          <div className="text-center mt-8">
            <p className="text-xl font-bold text-gray-700 animate-pulse">
              他のプレイヤーの回答を待機中です...
            </p>
          </div>
        )}
      </div>

      {phase === "revealing" && roomData && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[1000]">
          <div className="bg-white p-6 rounded-xl flex flex-col items-center w-[95%] max-w-3xl">
            <div className="text-2xl font-bold mb-4 text-gray-800">
              正解は <span className="text-pink-600">{roomData.answers[nowQuestion - 1]}</span> でした！
            </div>

            <div ref={answerMapRef} className="w-full max-w-[600px] h-[350px] rounded-lg overflow-hidden border border-gray-300" />

            <div className="mt-5 w-full flex flex-col items-center gap-3">
              {isHost ? (
                <button
                  onClick={handleNextOrResult}
                  className="px-8 py-3 rounded-lg font-bold text-white bg-amber-500 hover:bg-amber-600 active:scale-95 transition"
                >
                  {nowQuestion >= roomData.amount ? "結果を見る" : "次の問題へ"}
                </button>
              ) : (
                <p className="text-lg font-bold text-gray-600">
                  ホストが次の画面へ進むのを待機しています...
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}