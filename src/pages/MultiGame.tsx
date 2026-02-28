import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase-oauth/supabase";
import { loadGoogleMaps } from "../lib/googleMaps/loader";
import { createStreetViewGame } from "../lib/googleMaps/streetviewGame";
import type { Answers, Question, AnswerResult } from "../lib/googleMaps/types";

type GamePhase = "fetching" | "playing" | "revealed_local" | "waiting_others" | "timeout_reveal";

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
  const [result, setResult] = useState<AnswerResult | null>(null);

  const [activePlayersCount, setActivePlayersCount] = useState(1);
  const [answeredPlayersCount, setAnsweredPlayersCount] = useState(0);

  // 退出確認ダイアログ用
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const activeIdsRef = useRef<string[]>([]);
  const nowQuestionRef = useRef(1);
  const phaseRef = useRef<GamePhase>("fetching");

  useEffect(() => { nowQuestionRef.current = nowQuestion; }, [nowQuestion]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // 次の問題へ進む、または終了する（裏側でホストが代表して実行）
  const handleNextQuestionOrFinish = async () => {
    if (!roomId || !roomData) return;
    
    const { data: currentRoom } = await supabase.from("room").select("now, amount").eq("roomid", roomId).single();
    if (currentRoom && currentRoom.now === nowQuestionRef.current) {
      if (currentRoom.now >= currentRoom.amount) {
        await supabase.from("room").update({ stats: "finished" }).eq("roomid", roomId);
      } else {
        await supabase.from("room").update({
          now: currentRoom.now + 1,
          pano: null
        }).eq("roomid", roomId);
      }
    }
  };

  const checkAllAnswered = async () => {
    if (!roomId) return;
    const { data: players } = await supabase.from("players").select("playerid, answers").eq("roomid", roomId);
    if (!players) return;

    const activeIds = activeIdsRef.current;
    const currentQ = nowQuestionRef.current;
    
    setActivePlayersCount(activeIds.length);

    const activePlayersData = players.filter(p => activeIds.includes(p.playerid));
    const answeredCount = activePlayersData.filter(p => p.answers && p.answers.length >= currentQ).length;
    
    setAnsweredPlayersCount(answeredCount);

    if (answeredCount >= activeIds.length && activeIds.length > 0) {
      if (isHost && phaseRef.current !== "timeout_reveal") {
        handleNextQuestionOrFinish();
      }
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

      const { data: me } = await supabase.from("players").select("answers").eq("playerid", playerId).single();
      if (me && me.answers) setMyAnswers(me.answers);

      presenceChannel = supabase.channel(`game_presence_${roomId}`, {
        config: { presence: { key: playerId } },
      });

      presenceChannel
        .on("presence", { event: "sync" }, () => {
          if (!isMounted) return;
          const state = presenceChannel.presenceState();
          activeIdsRef.current = Object.keys(state);
          checkAllAnswered();
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && isMounted) {
            await presenceChannel.track({ playerid: playerId });
          }
        });

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
              setResult(null);
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

  useEffect(() => {
    if (phase !== "playing" && phase !== "revealed_local") return;
    
    // ★ 時間切れ処理：自動的に3(未回答)を送信し、フェーズを移行
    if (timeLeft <= 0) {
      const handleTimeout = async () => {
        if (phase === "playing" || phase === "revealed_local") {
          const finalAnswer = selectedAnswer !== null ? selectedAnswer : 3; 
          const updatedMyAnswers = [...myAnswers];
          updatedMyAnswers[nowQuestion - 1] = finalAnswer;
          setMyAnswers(updatedMyAnswers);
          await supabase.from("players").update({ answers: updatedMyAnswers }).eq("playerid", playerId);
          
          if (selectedAnswer === null && roomData) {
            const pseudoQuestion: Question = {
              panoLatLng: new google.maps.LatLng(roomData.lat, roomData.long),
              prefName: roomData.answers[nowQuestion - 1]
            };
            const ansResult = gameRef.current?.checkResult(pseudoQuestion, "OTHER"); 
            if (ansResult) {
              ansResult.ok = false;
              setResult(ansResult);
            }
          }
        }
        setPhase("timeout_reveal");
      };
      handleTimeout();
      return;
    }
    
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [phase, timeLeft, selectedAnswer, myAnswers, nowQuestion, playerId, roomData]);

  // ★ タイムアウト時の完全自動進行（5秒後に代表してホストが更新）
  useEffect(() => {
    if (phase === "timeout_reveal") {
      const timer = setTimeout(() => {
        if (isHost) {
          handleNextQuestionOrFinish();
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [phase, isHost]);

  useEffect(() => {
    if ((phase === "revealed_local" || phase === "timeout_reveal") && answerMapRef.current && result && roomData && gameRef.current) {
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
  }, [phase, result, roomData, nowQuestion]);

  const handleAnswerClick = (ansNum: number) => {
    if (!roomData || !gameRef.current) return;
    
    setSelectedAnswer(ansNum);
    
    const getAnswerString = (val: number): Answers => {
      if (val === 0) return "奈良県";
      if (val === 1) return "北海道";
      return "OTHER";
    };

    const pseudoQuestion: Question = {
      panoLatLng: new google.maps.LatLng(roomData.lat, roomData.long),
      prefName: roomData.answers[nowQuestion - 1]
    };
    
    const ansResult = gameRef.current.checkResult(pseudoQuestion, getAnswerString(ansNum));
    setResult(ansResult);
    setPhase("revealed_local"); 
  };

  const handleNextSubmit = async () => {
    setPhase("waiting_others");
    const updatedMyAnswers = [...myAnswers];
    updatedMyAnswers[nowQuestion - 1] = selectedAnswer ?? 3;
    setMyAnswers(updatedMyAnswers);

    await supabase.from("players").update({
      answers: updatedMyAnswers
    }).eq("playerid", playerId);
  };

  // ★ ゲームを抜ける処理
  const handleLeaveGame = async () => {
    if (!playerId) return;
    await supabase.from("players").update({ stats: "left" }).eq("playerid", playerId);
    navigate("/mainpage");
  };

  const choiceBtnBase = "w-[120px] py-2 rounded-lg border border-gray-300 font-bold transition";

  return (
    <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover py-6 px-5 flex flex-col items-center">
      <div className="border-2 rounded-xl border-black bg-white/80 backdrop-blur p-4 w-[95%] sm:w-4/5 md:w-2/3 max-w-5xl">
        
        {/* ★ 「抜ける」ボタンを追加 */}
        <div className="flex justify-center items-center mb-4 px-2 relative">
          <div className="absolute left-0 text-2xl font-bold">第 {nowQuestion} / {roomData?.amount} 問</div>
          <div className={`text-2xl font-bold ${timeLeft <= 5 ? "text-red-600 animate-pulse" : "text-gray-800"}`}>
            残り: {timeLeft}秒
          </div>
          <button
            onClick={() => setIsConfirmOpen(true)}
            className="absolute right-0 px-5 py-2 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 active:scale-95 transition"
          >
            抜ける
          </button>
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
          <div className="flex flex-col items-center gap-4 mt-6 min-h-[50px]">
            <div className="flex gap-4">
              <button onClick={() => handleAnswerClick(0)} className={`${choiceBtnBase} bg-gray-50 hover:bg-gray-100 active:scale-95`}>なら！</button>
              <button onClick={() => handleAnswerClick(1)} className={`${choiceBtnBase} bg-gray-50 hover:bg-gray-100 active:scale-95`}>どう！</button>
              <button onClick={() => handleAnswerClick(2)} className={`${choiceBtnBase} bg-gray-50 hover:bg-gray-100 active:scale-95`}>それ以外！</button>
            </div>
          </div>
        )}

      </div>

      {(phase === "revealed_local" || phase === "waiting_others" || phase === "timeout_reveal") && roomData && result && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[1000]">
          <div className="bg-white p-6 rounded-xl flex flex-col items-center w-[95%] max-w-3xl">
            
            {phase === "timeout_reveal" ? (
              <div className="text-2xl font-bold mb-4 text-red-600">時間切れ！</div>
            ) : (
              <div className={`text-2xl font-bold mb-4 ${result.ok ? "text-pink-600" : "text-indigo-600"}`}>
                {result.ok ? "正解！" : "不正解…"}
              </div>
            )}

            <div className="text-lg font-bold text-gray-800 mb-4">
              正解は <span className="text-pink-600">{roomData.answers[nowQuestion - 1]}</span> でした！
            </div>

            <div ref={answerMapRef} className="w-full max-w-[600px] h-[350px] rounded-lg overflow-hidden border border-gray-300" />

            <div className="mt-5 w-full flex flex-col items-center gap-3 min-h-[50px]">
              {phase === "revealed_local" && (
                <button
                  onClick={handleNextSubmit}
                  className="px-8 py-3 rounded-lg font-bold text-white bg-amber-500 hover:bg-amber-600 active:scale-95 transition"
                >
                  次の問題へ
                </button>
              )}
              {phase === "waiting_others" && (
                <p className="text-lg font-bold text-gray-700 animate-pulse">
                  他のプレイヤーの回答を待機中です... ({answeredPlayersCount}/{activePlayersCount})
                </p>
              )}
              {phase === "timeout_reveal" && (
                <p className="text-lg font-bold text-gray-700">
                  まもなく次の問題へ進みます...
                </p>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ★ 退出確認ダイアログ */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[1001]">
          <div className="bg-white p-8 rounded-xl text-center w-[95%] max-w-sm shadow-[0_4px_15px_rgba(0,0,0,0.3)]">
            <p className="text-xl font-bold mb-5">
              本当にゲームを抜けますか？
              <br />
              <span className="text-sm text-gray-600">（他のプレイヤーはそのまま続行します）</span>
            </p>

            <div className="flex gap-4">
              <button
                onClick={handleLeaveGame}
                className="flex-1 py-2 rounded-lg font-bold text-white bg-red-500 hover:bg-red-600 active:scale-95 transition"
              >
                はい
              </button>
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 py-2 rounded-lg font-bold bg-gray-200 text-gray-800 hover:bg-gray-300 active:scale-95 transition"
              >
                いいえ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}