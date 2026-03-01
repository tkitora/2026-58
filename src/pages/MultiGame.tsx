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
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const isHostRef = useRef(false);
  const nowQuestionRef = useRef(1);
  const phaseRef = useRef<GamePhase>("fetching");
  const isFinishingRef = useRef(false);
  const isTimeoutHandledRef = useRef(false);

  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { nowQuestionRef.current = nowQuestion; }, [nowQuestion]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => {
    isTimeoutHandledRef.current = false;
  }, [nowQuestion]);

  const handleNextQuestionOrFinish = async () => {
    if (!roomId) return;
    const { data: currentRoom } = await supabase.from("room").select("now, amount").eq("roomid", roomId).single();

    // 【追加】取得した部屋の状態を出力

    // 文字列で返ってくる可能性も考慮し Number() で比較
    if (currentRoom && Number(currentRoom.now) === Number(nowQuestionRef.current)) {
      if (Number(currentRoom.now) >= Number(currentRoom.amount)) {
        const { error } = await supabase.from("room").update({ stats: "finished" }).eq("roomid", roomId);
        if (error) console.error("DB更新エラー:", error);
      } else {
        await supabase.from("room").update({ now: Number(currentRoom.now) + 1, pano: null }).eq("roomid", roomId);
      }
    }
  };

  const checkAllAnswered = async () => {
    if (!roomId) return;
    const { data: activePlayersData } = await supabase
      .from("players")
      .select("playerid, answers")
      .eq("roomid", roomId)
      .eq("stats", "active");

    if (!activePlayersData) return;

    const currentQ = nowQuestionRef.current;
    setActivePlayersCount(activePlayersData.length);

    const answeredCount = activePlayersData.filter(p => p.answers && p.answers.length >= currentQ).length;
    setAnsweredPlayersCount(answeredCount);

    if (answeredCount >= activePlayersData.length && activePlayersData.length > 0) {
      if (isHostRef.current && phaseRef.current !== "timeout_reveal") {
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
    let dbChannel: ReturnType<typeof supabase.channel>;

    const initGame = async () => {
      await supabase.from("players").update({ stats: "active", roomid: roomId }).eq("playerid", playerId);

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

      if (!isMounted) return;
      if (!room || room.stats === "deleted") {
        navigate("/multi");
        return;
      }

      setRoomData(room);
      setIsHost(room.host_id === playerId);
      setNowQuestion(room.now);
      setTimeLeft(room.timeLimit);

      const { data: me } = await supabase.from("players").select("answers").eq("playerid", playerId).single();
      if (me && me.answers) setMyAnswers(me.answers);

      checkAllAnswered();

      const uniqueDbTopic = `game_db_${roomId}_${Date.now()}`;
      dbChannel = supabase.channel(uniqueDbTopic);

      dbChannel
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "room" }, (payload: any) => {
          if (!isMounted || payload.new.roomid !== roomId) return;
          const newRoom = payload.new;

          if (newRoom.stats === "deleted") {
            alert("ホストが退出したため、ゲームが終了しました。");
            isFinishingRef.current = true;
            navigate("/mainpage");
            return;
          }

          setRoomData((prev: any) => (prev ? { ...prev, ...newRoom } : newRoom));

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

          // if (newRoom.stats === "finished") {
          //   isFinishingRef.current = true;
          //   navigate("/multiresult"); 
          // }
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "players" }, (payload: any) => {
          if (!isMounted) return;
          const targetRoomId = payload.new ? payload.new.roomid : payload.old.roomid;
          if (targetRoomId === roomId) {
            checkAllAnswered();
          }
        })
        .subscribe();
    };

    initGame();

    const handleBeforeUnload = () => {
      if (!isFinishingRef.current && roomId && playerId) {
        supabase.from("players").update({ stats: "left", roomid: null }).eq("playerid", playerId).then();
        if (isHostRef.current) {
          supabase.from("room").update({ stats: "deleted" }).eq("roomid", roomId).then();
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      isMounted = false;
      if (dbChannel) supabase.removeChannel(dbChannel);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [navigate, roomId, playerId]);

  useEffect(() => {
    if (roomData?.stats === "finished") {
      isFinishingRef.current = true;
      navigate("/multiresult");
    }
  }, [roomData?.stats, navigate]);

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

    if (timeLeft <= 0) {
      // 【追加】既にタイムアウト処理中なら弾く
      if (isTimeoutHandledRef.current) return;
      isTimeoutHandledRef.current = true; // ロックをかける

      const handleTimeout = async () => {
        // 【修正】非同期処理（await）の前に、先にフェーズを変更してUIを切り替える
        setPhase("timeout_reveal");

        if (phase === "playing" || phase === "revealed_local") {
          const finalAnswer = selectedAnswer !== null ? selectedAnswer : 3;
          const updatedMyAnswers = [...myAnswers];
          updatedMyAnswers[nowQuestion - 1] = finalAnswer;
          setMyAnswers(updatedMyAnswers);

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

          // DB更新は一番最後に実行する
          await supabase.from("players").update({ answers: updatedMyAnswers }).eq("playerid", playerId);
        }
      };
      handleTimeout();
      return;
    }

    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [phase, timeLeft, selectedAnswer, myAnswers, nowQuestion, playerId, roomData]);

  useEffect(() => {
    if (phase === "timeout_reveal") {
      const timer = setTimeout(() => {
        if (isHost) handleNextQuestionOrFinish();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [phase, isHost]);

  useEffect(() => {
    if ((phase === "revealed_local" || phase === "timeout_reveal") && answerMapRef.current && result && roomData && gameRef.current) {
      answerMapRef.current.innerHTML = "";
      requestAnimationFrame(() => {
        mapRef.current = gameRef.current!.renderAnswerMap(answerMapRef.current!, result);
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

  const handleLeaveGame = async () => {
    isFinishingRef.current = true;
    if (playerId) {
      await supabase.from("players").update({ stats: "left", roomid: null }).eq("playerid", playerId);
      if (isHostRef.current && roomId) {
        await supabase.from("room").update({ stats: "deleted" }).eq("roomid", roomId);
      }
    }
    navigate("/mainpage");
  };

  const getBtnClass = () => [
    "w-[120px] py-2 rounded-lg border border-gray-300 bg-gray-50 font-bold transition",
    phase !== "playing" ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100 active:scale-95",
  ].join(" ");

  // ★ 最終問題かどうかの判定（数値変換で安全に）
  const isLastQuestion = roomData && Number(nowQuestion) >= Number(roomData.amount);

  return (
    <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-cover py-4 sm:py-6 px-3 sm:px-5 flex flex-col items-center">
      <div className="border-2 rounded-xl border-black bg-white/80 backdrop-blur p-3 sm:p-4 w-full max-w-5xl">
        {/* Header：スマホは縦並び、sm以上で横並び */}
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center mb-4 sm:mb-5">
          {/* 問題数 */}
          <div className="text-xl sm:text-2xl md:text-3xl font-bold text-center">
            現在 {nowQuestion} / {roomData?.amount} 問目
          </div>

          {/* 残り時間：スマホは左上寄せ、sm以上で左固定 */}
          <div
            className={[
              "sm:absolute sm:left-0",
              "text-base sm:text-lg md:text-xl font-bold",
              timeLeft <= 5 ? "text-red-600 animate-pulse" : "text-gray-800",
              "self-start sm:self-auto",
            ].join(" ")}
          >
            残り: {timeLeft}秒
          </div>

          {/* 抜ける：スマホは右寄せ、sm以上で右固定 */}
          <div className="sm:absolute sm:right-0 self-end sm:self-auto">
            <button
              onClick={() => setIsConfirmOpen(true)}
              className="px-4 sm:px-5 py-2 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 active:scale-95 transition"
            >
              抜ける
            </button>
          </div>
        </div>

        {/* Pano：vhで高さを可変に。上限も付ける */}
        <div className="relative w-full rounded-lg overflow-hidden border border-gray-300 bg-white h-[45vh] min-h-[260px] max-h-[520px] sm:h-[50vh] md:h-[520px]">
          <div ref={panoRef} className="w-full h-full" />
          {phase === "fetching" && (
            <div className="absolute inset-0 bg-black/70 flex flex-col justify-center items-center z-10 text-white px-4 text-center">
              <div className="text-xl sm:text-2xl font-bold">景色を探しています...</div>
              <div className="text-xs sm:text-sm mt-2 opacity-90">少しお待ちください</div>
            </div>
          )}
        </div>

        {/* Answer buttons：スマホは折り返し・ボタン幅可変 */}
        <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-5 mt-4 min-h-[50px]">
          <button
            onClick={() => handleAnswerClick(0)}
            disabled={phase !== "playing"}
            className={[getBtnClass(), "w-[48%] sm:w-auto"].join(" ")}
          >
            なら！
          </button>
          <button
            onClick={() => handleAnswerClick(1)}
            disabled={phase !== "playing"}
            className={[getBtnClass(), "w-[48%] sm:w-auto"].join(" ")}
          >
            どう！
          </button>
          <button
            onClick={() => handleAnswerClick(2)}
            disabled={phase !== "playing"}
            className={[getBtnClass(), "w-full sm:w-auto"].join(" ")}
          >
            それ以外！
          </button>
        </div>
      </div>

      {/* Result Modal：スマホで高さ溢れしないように scroll + map 高さ可変 */}
      {(phase === "revealed_local" || phase === "waiting_others" || phase === "timeout_reveal") &&
        roomData &&
        result && (
          <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[1000] p-3 sm:p-6">
            <div className="bg-white p-4 sm:p-6 rounded-xl flex flex-col items-center w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              {phase === "timeout_reveal" ? (
                <div className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-red-600">時間切れ！</div>
              ) : (
                <div
                  className={[
                    "text-xl sm:text-2xl font-bold mb-3 sm:mb-4",
                    result.ok ? "text-pink-600" : "text-indigo-600",
                  ].join(" ")}
                >
                  {result.ok ? "正解！" : "不正解…"}
                </div>
              )}

              <div className="text-base sm:text-lg font-bold text-gray-700 mb-3 sm:mb-4 text-center">
                ({roomData.answers[nowQuestion - 1]})
              </div>

              <div
                ref={answerMapRef}
                className="w-full max-w-[600px] rounded-lg overflow-hidden border border-gray-300 h-[38vh] min-h-[260px] max-h-[460px] sm:h-[420px]"
              />

              <div className="mt-4 sm:mt-5 w-full flex flex-col items-center gap-3">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${result.correctLatLng.lat()},${result.correctLatLng.lng()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block w-full sm:w-auto text-center px-5 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 active:scale-95 transition"
                >
                  Googleマップで見る
                </a>

                {phase === "revealed_local" && (
                  <button
                    onClick={handleNextSubmit}
                    className="w-full sm:w-auto px-5 py-2 rounded-lg border border-gray-300 bg-gray-50 font-bold hover:bg-gray-100 active:scale-95 transition"
                  >
                    {isLastQuestion ? "結果を見る" : "次の問題へ"}
                  </button>
                )}

                {phase === "waiting_others" && (
                  <p className="text-base sm:text-lg font-bold text-gray-700 animate-pulse text-center">
                    他のプレイヤーを待機中です... ({answeredPlayersCount}/{activePlayersCount})
                  </p>
                )}

                {phase === "timeout_reveal" && (
                  <p className="text-base sm:text-lg font-bold text-gray-700 text-center">
                    {isLastQuestion ? "まもなく結果発表へ進みます..." : "まもなく次の問題へ進みます..."}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Confirm Modal：スマホで横幅いっぱい + padding */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[1001] p-3">
          <div className="bg-white p-6 sm:p-8 rounded-xl text-center w-full max-w-sm shadow-[0_4px_15px_rgba(0,0,0,0.3)]">
            <p className="text-lg sm:text-xl font-bold mb-5">
              本当にゲームを抜けますか？
              <br />
              <span className="text-xs sm:text-sm text-gray-600">（ホストの場合は部屋が解散されます）</span>
            </p>

            <div className="flex gap-3 sm:gap-4">
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