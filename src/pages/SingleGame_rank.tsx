import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../lib/googleMaps/loader";
import { createStreetViewGame } from "../lib/googleMaps/streetviewGame";
import type { Answers, Question, AnswerResult } from "../lib/googleMaps/types";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type TitleData = {
  name: string;
  description: string;
};

// ランキング用の最大問題数
const MAX_QUESTIONS = 20;

function SingleGame_rank() {
  const panoRef = useRef<HTMLDivElement | null>(null);
  const answerMapRef = useRef<HTMLDivElement | null>(null);

  const [question, setQuestion] = useState<Question | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [open, setOpen] = useState(false);

  const [TotalCount, setTotalCount] = useState(0);
  const [CurrentNumber, setCurrentNumber] = useState(1);
  const [TotalCorrect, setTotalCorrect] = useState(0);
  const [NARACount, setNARACount] = useState(0);
  const [NARACorrect, setNARACorrect] = useState(0);
  const [DOUCount, setDOUCount] = useState(0);
  const [DOUCorrect, setDOUCorrect] = useState(0);
  const [CorrectKeep, setCorrectKeep] = useState(0);
  const [MaxCorrectKeep, setMaxCorrectKeep] = useState(0);

  const [isLoading, setIsLoading] = useState(false);

  // ランキング特有
  const [isConfirmOpen, setIsConfirmOpen] = useState(false); // リタイア確認
  const [showResultScreen, setShowResultScreen] = useState(false); // 最終リザルト
  const [playerName, setPlayerName] = useState("");

  const [isRegisterConfirmOpen, setIsRegisterConfirmOpen] = useState(false);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);

  const navigate = useNavigate();

  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const gameRef = useRef<ReturnType<typeof createStreetViewGame> | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!open || !result || !gameRef.current || !answerMapRef.current) return;

    // 前回の地図が残る/二重生成を防ぐ
    answerMapRef.current.innerHTML = "";

    requestAnimationFrame(() => {
      mapRef.current = gameRef.current!.renderAnswerMap(answerMapRef.current!, result);
    });
  }, [open, result]);

  useEffect(() => {
    (async () => {
      await loadGoogleMaps();
      gameRef.current = createStreetViewGame();

      if (!panoRef.current) return;
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

      await nextQuestion();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function nextQuestion() {
    if (!gameRef.current || !panoramaRef.current) return;

    setResult(null);
    setOpen(false);
    setIsLoading(true);

    // CurrentNumberがMAXを超えないように制御
    setCurrentNumber(Math.min(TotalCount + 1, MAX_QUESTIONS));

    try {
      const rand = Math.random();
      let mode: "NARA" | "DOU" | "OTHER";
      if (rand < 0.3) mode = "DOU";
      else if (rand < 0.8) mode = "NARA";
      else mode = "OTHER";

      const q = await gameRef.current.newView({ mode, panorama: panoramaRef.current });
      setQuestion(q);
    } catch (error) {
      console.warn("場所の取得に失敗しました。もう一度お試しください:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function submit(userSays: Answers) {
    if (!gameRef.current || !question) return;
    const r = gameRef.current.checkResult(question, userSays);
    setResult(r);

    setTotalCount((prev) => prev + 1);

    if (r.ok) {
      setTotalCorrect((prev) => prev + 1);
      setCorrectKeep((prev) => prev + 1);
      if (CorrectKeep + 1 > MaxCorrectKeep) setMaxCorrectKeep(CorrectKeep + 1);

      if (question.prefName === "奈良県") setNARACorrect((prev) => prev + 1);
      else if (question.prefName === "北海道") setDOUCorrect((prev) => prev + 1);
    } else {
      setCorrectKeep(0);
    }

    if (question.prefName === "奈良県") setNARACount((prev) => prev + 1);
    else if (question.prefName === "北海道") setDOUCount((prev) => prev + 1);

    setOpen(true);
  }

  function getTitles(): TitleData[] {
    const earnedTitles: TitleData[] = [];
    if (TotalCount === 0)
      return [{ name: "準備中の旅人", description: "まだ1問も答えていない。まずは遊んでみて！" }];

    const totalRate = TotalCorrect / TotalCount;
    const naraRate = NARACount > 0 ? NARACorrect / NARACount : 0;
    const douRate = DOUCount > 0 ? DOUCorrect / DOUCount : 0;

    if (douRate === 1 && DOUCount > 0) earnedTitles.push({ name: "道民", description: "北海道の問題を全問正解。" });
    if (DOUCount > 0 && NARACount > 0 && douRate > naraRate)
      earnedTitles.push({ name: "生粋の道民", description: "奈良よりも北海道の正答率が高い。" });
    if (naraRate === 1 && NARACount > 0) earnedTitles.push({ name: "奈良県民", description: "奈良県の問題を全問正解。" });
    if (NARACount >= 5 && naraRate === 1)
      earnedTitles.push({ name: "生粋の奈良県民", description: "奈良の問題に5問以上回答し、全問正解。鹿と山はトモダチ。" });
    if (TotalCount >= 20 && totalRate >= 0.9)
      earnedTitles.push({ name: "マスター旅人", description: "全体の正答率90%以上。地理マスター。" });
    if (TotalCount >= 20 && totalRate >= 0.8)
      earnedTitles.push({ name: "凄腕の旅人", description: "全体の正答率80%以上。地理に詳しい。" });
    if (MaxCorrectKeep >= 10)
      earnedTitles.push({ name: "ゾーン突入", description: "10問以上連続で正解した。今のあなたには全てが見えている。" });
    if (earnedTitles.length === 0 && totalRate < 0.5)
      earnedTitles.push({ name: "迷子の旅人", description: "正答率が50%未満。少し方向音痴かも…？" });
    if (earnedTitles.length === 0)
      earnedTitles.push({ name: "駆け出しゲッサー", description: "正答率50%以上の標準的な旅人。これからもっと伸びるはず！" });

    return earnedTitles;
  }

  const handleRegister = async () => {
    const finalName = playerName.trim() === "" ? "名無しのゲッサー" : playerName.trim();

    const { error } = await supabase.from("single_ranking").insert([{ player_name: finalName, score: TotalCorrect }]);

    if (error) {
      console.error("ランキングの登録に失敗しました:", error.message);
      alert("通信エラーが発生しました。もう一度お試しください。");
      return;
    }

    navigate("/singlerank");
  };

  // 共通クラス
  const smallBtn =
    "px-2 py-1 text-xs rounded border border-gray-400 bg-white font-bold transition hover:bg-gray-100 active:scale-95";
  const choiceBtnBase =
    "w-[120px] py-2 rounded-lg border border-gray-300 bg-gray-50 font-bold transition hover:bg-gray-100 active:scale-95";
  const disabledBtn = "opacity-50 cursor-not-allowed";
  const modalWrap = "fixed inset-0 flex justify-center items-center";
  const cardBase = "bg-white rounded-xl";

  return (
    <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover py-6 px-5">
      <div className="border-2 rounded-xl border-black bg-white/80 backdrop-blur p-4 w-[95%] sm:w-4/5 md:w-2/3 max-w-5xl mx-auto">
        {/* 上部：問題数 + リタイア */}
        <div className="relative flex justify-center items-center mb-5">
          <div className="text-3xl font-bold">
            現在 {CurrentNumber} / {MAX_QUESTIONS} 問目
          </div>

          <button
            onClick={() => setIsConfirmOpen(true)}
            className="absolute right-0 px-5 py-2 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 active:scale-95 transition"
          >
            リタイア
          </button>
        </div>

        {/* ストリートビュー */}
        <div className="w-full mx-auto">
          <div className="relative w-full h-[500px] rounded-lg overflow-hidden border border-gray-300 bg-white">
            <div ref={panoRef} className="w-full h-full" />

            {isLoading && (
              <div className="absolute inset-0 bg-black/70 flex flex-col justify-center items-center z-10 text-white">
                <div className="text-2xl font-bold mb-2">景色を探しています...</div>
              </div>
            )}
          </div>

          {/* 再取得 */}
          <div className="flex justify-end items-center gap-3 mt-2">
            <span className="text-xs text-gray-600">
              ※10秒以上経っても景色が出ない場合は、再取得をお試しください。
            </span>
            <button
              onClick={nextQuestion}
              disabled={isLoading}
              className={[smallBtn, isLoading ? "opacity-50 cursor-not-allowed" : ""].join(" ")}
            >
              ↻ 景色を再取得する
            </button>
          </div>

          {/* 回答ボタン */}
          <div className="flex justify-center items-center gap-5 mt-4 min-h-[50px]">
            <button
              onClick={() => submit("奈良県")}
              disabled={open}
              className={[choiceBtnBase, open ? disabledBtn : ""].join(" ")}
            >
              なら！
            </button>
            <button
              onClick={() => submit("北海道")}
              disabled={open}
              className={[choiceBtnBase, open ? disabledBtn : ""].join(" ")}
            >
              どう！
            </button>
            <button
              onClick={() => submit("OTHER")}
              disabled={open}
              className={[choiceBtnBase, open ? disabledBtn : ""].join(" ")}
            >
              それ以外！
            </button>
          </div>
        </div>
      </div>

      {/* ========== 答え合わせダイアログ ========== */}
      {open && result && !showResultScreen && (
        <div className={`${modalWrap} bg-black/50 z-[1000]`}>
          <div className={`${cardBase} p-6 flex flex-col items-center w-[95%] max-w-3xl`}>
            <div className={["text-2xl font-bold mb-4", result.ok ? "text-pink-600" : "text-indigo-600"].join(" ")}>
              {result.ok ? (CorrectKeep >= 2 ? `${CorrectKeep}回連続正解！` : "正解！") : "不正解…"}
            </div>

            <div className="text-lg font-bold text-gray-700 mb-4">({question?.prefName})</div>

            <div ref={answerMapRef} className="w-full max-w-[600px] h-[450px] rounded-lg overflow-hidden border border-gray-300" />

            <div className="mt-5 w-full flex flex-col items-center gap-3">
              <a
                href={`https://maps.google.com/maps?q=${result.correctLatLng.lat()},${result.correctLatLng.lng()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-5 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 active:scale-95 transition"
              >
                Googleマップで見る
              </a>

              {TotalCount >= MAX_QUESTIONS ? (
                <button
                  onClick={() => {
                    setOpen(false);
                    setShowResultScreen(true);
                  }}
                  className="px-6 py-2 rounded-lg font-bold text-white bg-amber-500 hover:bg-amber-600 active:scale-95 transition"
                >
                  結果を見る
                </button>
              ) : (
                <button
                  onClick={nextQuestion}
                  className="px-6 py-2 rounded-lg border border-gray-300 bg-gray-50 font-bold hover:bg-gray-100 active:scale-95 transition"
                >
                  次の問題へ
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== 最終リザルト＆登録画面 ========== */}
      {showResultScreen && (
        <div className={`${modalWrap} bg-black/70 z-[1000]`}>
          <div className={`${cardBase} p-10 w-[95%] max-w-lg text-center shadow-[0_4px_15px_rgba(0,0,0,0.2)]`}>
            <h2 className="text-3xl font-bold mb-2 text-gray-800">最終結果</h2>

            <div className="text-2xl font-bold text-pink-600 mb-6">
              {TotalCorrect} / {MAX_QUESTIONS} 問正解！
            </div>

            {/* 称号 */}
            <div className="my-5 p-5 bg-amber-50 rounded-lg border-2 border-amber-300 text-left">
              <h3 className="text-lg font-bold text-center mb-4">獲得した称号</h3>

              <div className="flex flex-col gap-3">
                {getTitles().map((title, index) => (
                  <details key={index} className="bg-white p-3 rounded-md border border-amber-300 cursor-pointer">
                    <summary className="text-lg font-bold text-orange-700 outline-none">🏆 {title.name}</summary>
                    <p className="mt-2 text-sm text-gray-700 pl-6">{title.description}</p>
                  </details>
                ))}
              </div>
            </div>

            {/* 名前入力 */}
            <div className="my-8">
              <p className="text-lg font-bold mb-3">あなたの名前を入力してください！</p>
              <input
                type="text"
                placeholder="名無しのゲッサー"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={15}
                className="w-4/5 px-3 py-3 text-xl rounded-md border-2 border-gray-300 text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            {/* ボタン */}
            <div className="flex flex-col gap-4 items-center">
              <button
                onClick={() => setIsRegisterConfirmOpen(true)}
                className="w-4/5 py-4 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700 active:scale-95 transition text-xl"
              >
                登録して終了
              </button>
              <button
                onClick={() => setIsDiscardConfirmOpen(true)}
                className="w-4/5 py-3 rounded-lg font-bold bg-gray-200 text-gray-800 hover:bg-gray-300 active:scale-95 transition"
              >
                登録せずに終了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== リタイア確認ダイアログ ========== */}
      {isConfirmOpen && (
        <div className={`${modalWrap} bg-black/70 z-[1001]`}>
          <div className={`${cardBase} p-8 w-[95%] max-w-sm text-center shadow-[0_4px_15px_rgba(0,0,0,0.3)]`}>
            <p className="text-xl font-bold mb-5">
              本当に終了してホームに戻りますか？
              <br />
              <span className="text-sm text-gray-600">（ここまでの記録は保存されません）</span>
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => navigate("/")}
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

      {/* ========== 登録確認ダイアログ ========== */}
      {isRegisterConfirmOpen && (
        <div className={`${modalWrap} bg-black/80 z-[1002]`}>
          <div className={`${cardBase} p-8 w-[95%] max-w-md text-center shadow-[0_4px_15px_rgba(0,0,0,0.3)]`}>
            <p className="text-xl font-bold mb-6 leading-relaxed">
              『{playerName.trim() === "" ? "名無しのゲッサー" : playerName.trim()}』で登録します。
              <br />
              間違いありませんか？
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setIsRegisterConfirmOpen(false);
                  handleRegister();
                }}
                className="flex-1 py-2 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700 active:scale-95 transition"
              >
                はい
              </button>
              <button
                onClick={() => setIsRegisterConfirmOpen(false)}
                className="flex-1 py-2 rounded-lg font-bold bg-gray-200 text-gray-800 hover:bg-gray-300 active:scale-95 transition"
              >
                いいえ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 登録せず終了確認ダイアログ ========== */}
      {isDiscardConfirmOpen && (
        <div className={`${modalWrap} bg-black/80 z-[1002]`}>
          <div className={`${cardBase} p-8 w-[95%] max-w-md text-center shadow-[0_4px_15px_rgba(0,0,0,0.3)]`}>
            <p className="text-lg font-bold mb-6 leading-relaxed">
              今回のプレイ記録は保存されませんが、
              <br />
              問題ありませんか？
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => navigate("/")}
                className="flex-1 py-2 rounded-lg font-bold text-white bg-red-500 hover:bg-red-600 active:scale-95 transition"
              >
                はい
              </button>
              <button
                onClick={() => setIsDiscardConfirmOpen(false)}
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

export default SingleGame_rank;