import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../lib/googleMaps/loader";
import { createStreetViewGame } from "../lib/googleMaps/streetviewGame";
import type { Answers, Question, AnswerResult } from "../lib/googleMaps/types";
//ホームに戻すために追加
import { useNavigate } from 'react-router-dom';

// 称号データの型定義
type TitleData = {
  name: string;
  description: string;
};

function SingleGame() {
  const panoRef = useRef<HTMLDivElement | null>(null);
  const answerMapRef = useRef<HTMLDivElement | null>(null);

  const [question, setQuestion] = useState<Question | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [open, setOpen] = useState(false);
  // 総出題数、奈良出題数、道出題数、それらの正解数の合計6つと、連続正解数のuseStateを作成
  const [TotalCount, setTotalCount] = useState(0);
  const [CurrentNumber, setCurrentNumber] = useState(1); // 画面上に表示する何問目
  const [TotalCorrect, setTotalCorrect] = useState(0);
  const [NARACount, setNARACount] = useState(0);
  const [NARACorrect, setNARACorrect] = useState(0);
  const [DOUCount, setDOUCount] = useState(0);
  const [DOUCorrect, setDOUCorrect] = useState(0);
  const [CorrectKeep, setCorrectKeep] = useState(0);
  const [MaxCorrectKeep, setMaxCorrectKeep] = useState(0); // 連続正解の最高記録を保存するためのstate

  //ロード中管理
  const [isLoading, setIsLoading] = useState(false);

  //ダイアログを管理するためのuseState3つ
  const [isStatsOpen, setIsStatsOpen] = useState(false);   // 回答状況ダイアログ
  const [isConfirmOpen, setIsConfirmOpen] = useState(false); // 終了確認ダイアログ
  const [isGameEnded, setIsGameEnded] = useState(false);     // ゲーム終了（称号表示）
  //ホームに戻るためのnavigate関数
  const navigate = useNavigate();

  // panoramaインスタンス保持
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const gameRef = useRef<ReturnType<typeof createStreetViewGame> | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!result) return;
    if (!gameRef.current) return;
    if (!answerMapRef.current) return;

    // 前回の地図が残る/二重生成を防ぐ（divをクリア）
    answerMapRef.current.innerHTML = "";

    // dialog内はサイズ確定が遅れるので1フレーム待つ
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
    setIsLoading(true); // ロード開始！

    setCurrentNumber(TotalCount + 1); // 画面上の何問目表示を更新（TotalCountはまだ更新されていないので+1して渡す）

    try {
      const rand = Math.random();
      let mode: "NARA" | "DOU" | "OTHER";

      if (rand < 0.25) {
        mode = "DOU";       // 30%
      } else if (rand < 0.75) {
        mode = "NARA";      // 50%
      } else {
        mode = "OTHER";     // 20%
      }
      console.log(`次の問題のモード: ${mode}`); // デバッグ用にモードをコンソールに表示
      const q = await gameRef.current.newView({ mode, panorama: panoramaRef.current });
      setQuestion(q);
    } catch (error) {
      console.warn("場所の取得に失敗しました。もう一度お試しください:", error);
    } finally {
      setIsLoading(false); // 成功しても失敗しても、ここでロード状態を解除
    }
  }

  function submit(userSaysNara: Answers) {
    if (!gameRef.current || !question) return;
    const r = gameRef.current.checkResult(question, userSaysNara);
    setResult(r);

    // 総出題数を更新
    setTotalCount(prev => prev + 1);
    // 正解数を更新
    if (r.ok) {
      setTotalCorrect(prev => prev + 1);
      setCorrectKeep(prev => prev + 1); // 連続正解数を増やす
      if (CorrectKeep + 1 > MaxCorrectKeep) {
        setMaxCorrectKeep(CorrectKeep + 1); // 最高連続正解数を更新
      }
      if (question.prefName === "奈良県") {
        setNARACorrect(prev => prev + 1);
      } else if (question.prefName === "北海道") {
        setDOUCorrect(prev => prev + 1);
      }
    } else {
      setCorrectKeep(0); // 不正解だった場合は連続正解をリセット
    }
    // 出題数を更新
    if (question.prefName === "奈良県") {
      setNARACount(prev => prev + 1);
    } else if (question.prefName === "北海道") {
      setDOUCount(prev => prev + 1);
    }
    setOpen(true);
  }

  // 獲得した称号の配列を返す関数
  function getTitles(): TitleData[] {
    const earnedTitles: TitleData[] = [];

    // データなしの場合はこれだけ返して終了
    if (TotalCount === 0) {
      return [{ name: "準備中の旅人", description: "まだ1問も答えていない。まずは遊んでみて！" }];
    }

    const totalRate = TotalCorrect / TotalCount;
    const naraRate = NARACount > 0 ? NARACorrect / NARACount : 0;
    const douRate = DOUCount > 0 ? DOUCorrect / DOUCount : 0;

    // --- ここから各種条件判定 ---

    // 1. 道民判定
    if (douRate >= 0.8 && DOUCount > 0) earnedTitles.push({ name: "道民", description: "北海道の問題を8割以上正解。" });
    if (DOUCount > 0 && douRate === 1 && NARACount > 0 && douRate > naraRate)
      earnedTitles.push({ name: "生粋の道民", description: "北海道の問題に全問正解し、奈良よりも北海道の正答率が高い。" });
    if (naraRate >= 0.8 && NARACount > 0) earnedTitles.push({ name: "奈良県民", description: "奈良県の問題を8割以上正解。" });
    if (NARACount >= 5 && naraRate === 1)
      earnedTitles.push({ name: "生粋の奈良県民", description: "奈良の問題に5問以上回答し、全問正解。鹿と山はトモダチ。" });
    if (TotalCount >= 20 && totalRate >= 0.9)
      earnedTitles.push({ name: "マスター旅人", description: "全体の正答率90%以上。地理マスター。" });
    if (TotalCount >= 20 && totalRate >= 0.75)
      earnedTitles.push({ name: "凄腕の旅人", description: "全体の正答率75%以上。地理に詳しい。" });
    if (MaxCorrectKeep >= 10)
      earnedTitles.push({ name: "ゾーン突入", description: "10問以上連続で正解した。今のあなたには全てが見えている。" });
    if (earnedTitles.length === 0 && totalRate < 0.5)
      earnedTitles.push({ name: "迷子の旅人", description: "正答率が50%未満。少し方向音痴かも…？" });
    if (earnedTitles.length === 0)
      earnedTitles.push({ name: "駆け出しゲッサー", description: "正答率50%以上の標準的な旅人。これからもっと伸びるはず！" });

    return earnedTitles;
  }

  const btnStyle = {
    width: "120px", // ここでボタンの横幅を固定
    padding: "10px 0",
    borderRadius: "8px",
    border: "1px solid #ccc",
    backgroundColor: "#f9f9f9",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "bold",
    textAlign: "center" as const // 文字を中央揃えに
  };

  return (
  <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover py-6 px-5">
    <div className="border-2 rounded-xl border-black bg-white/80 backdrop-blur p-4 w-[95%] sm:w-4/5 md:w-2/3 max-w-5xl mx-auto">
      {/* 上部：問題数 + 回答状況ボタン */}
      <div className="relative flex justify-center items-center mb-5">
        <div className="text-3xl font-bold">現在 {CurrentNumber} 問目</div>

        <button
          onClick={() => setIsStatsOpen(true)}
          className="absolute right-0 px-5 py-2 rounded-lg border border-gray-300 bg-gray-50 text-sm font-bold
                     hover:bg-gray-100 active:scale-95 transition"
        >
          現在の回答状況
        </button>
      </div>

      {/* メイン */}
      <div className="w-full mx-auto">
        {/* ストリートビュー枠 */}
        <div className="relative w-full h-[500px] rounded-lg overflow-hidden border border-gray-300 bg-white">
          <div ref={panoRef} className="w-full h-full" />

          {/* ロード中オーバーレイ */}
          {isLoading && (
            <div className="absolute inset-0 bg-black/70 flex flex-col justify-center items-center z-10 text-white">
              <div className="text-2xl font-bold">景色を探しています...</div>
              <div className="text-sm mt-2 opacity-90">少しお待ちください</div>
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
            className={[
              "px-2 py-1 text-xs rounded border border-gray-400 bg-white font-bold transition",
              isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100 active:scale-95",
            ].join(" ")}
          >
            ↻ 景色を再取得する
          </button>
        </div>

        {/* 回答ボタン */}
        <div className="flex justify-center items-center gap-5 mt-4 min-h-[50px]">
          <button
            onClick={() => submit("奈良県")}
            disabled={open}
            className={[
              "w-[120px] py-2 rounded-lg border border-gray-300 bg-gray-50 font-bold transition",
              open ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100 active:scale-95",
            ].join(" ")}
          >
            なら！
          </button>
          <button
            onClick={() => submit("北海道")}
            disabled={open}
            className={[
              "w-[120px] py-2 rounded-lg border border-gray-300 bg-gray-50 font-bold transition",
              open ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100 active:scale-95",
            ].join(" ")}
          >
            どう！
          </button>
          <button
            onClick={() => submit("OTHER")}
            disabled={open}
            className={[
              "w-[120px] py-2 rounded-lg border border-gray-300 bg-gray-50 font-bold transition",
              open ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100 active:scale-95",
            ].join(" ")}
          >
            それ以外！
          </button>
        </div>
      </div>
    </div>

    {/* ========== 答え合わせダイアログ ========== */}
    {open && result && (
      <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[1000]">
        <div className="bg-white p-6 rounded-xl flex flex-col items-center w-[95%] max-w-3xl">
          <div
            className={[
              "text-2xl font-bold mb-4",
              result.ok ? "text-pink-600" : "text-indigo-600",
            ].join(" ")}
          >
            {result.ok ? (CorrectKeep >= 2 ? `${CorrectKeep}回連続正解！` : "正解！") : "不正解…"}
          </div>

          <div className="text-lg font-bold text-gray-700 mb-4">
            ({question?.prefName})
          </div>

          {/* マップ */}
          <div
            ref={answerMapRef}
            className="w-full max-w-[600px] h-[450px] rounded-lg overflow-hidden border border-gray-300"
          />

          <div className="mt-5 w-full flex flex-col items-center gap-3">
            <a
              href={`https://maps.google.com/maps?q=${result.correctLatLng.lat()},${result.correctLatLng.lng()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-5 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 active:scale-95 transition"
            >
              Googleマップで見る
            </a>

            <button
              onClick={nextQuestion}
              className="px-5 py-2 rounded-lg border border-gray-300 bg-gray-50 font-bold hover:bg-gray-100 active:scale-95 transition"
            >
              次の問題へ
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ========== 回答状況ダイアログ ========== */}
    {isStatsOpen && (
      <div
        className="fixed inset-0 bg-black/60 flex justify-center items-center z-[1000]"
        onClick={() => {
          if (!isConfirmOpen && !isGameEnded) setIsStatsOpen(false);
        }}
      >
        <div
          className="relative bg-white p-10 rounded-xl w-[95%] max-w-lg text-center shadow-[0_4px_15px_rgba(0,0,0,0.2)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 閉じる（ゲーム終了前のみ） */}
          {!isGameEnded && (
            <button
              onClick={() => setIsStatsOpen(false)}
              className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-gray-800 text-white text-2xl font-bold
                         flex items-center justify-center hover:bg-black active:scale-95 transition"
            >
              ×
            </button>
          )}

          <h2 className="text-2xl font-bold mb-6 text-gray-800">現在の回答状況</h2>

          {/* 表 */}
          <table className="w-full border-collapse text-lg mb-8">
            <thead>
              <tr>
                <th className="border-b-2 border-gray-300 py-2 w-[34%]">区分</th>
                <th className="border-b-2 border-gray-300 py-2 w-[33%]">出題数</th>
                <th className="border-b-2 border-gray-300 py-2 w-[33%]">正解数</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-b border-gray-200 py-3 font-bold">全体</td>
                <td className="border-b border-gray-200 py-3">{TotalCount}</td>
                <td className="border-b border-gray-200 py-3 font-bold text-pink-600">{TotalCorrect}</td>
              </tr>
              <tr>
                <td className="border-b border-gray-200 py-3 font-bold">奈良</td>
                <td className="border-b border-gray-200 py-3">{NARACount}</td>
                <td className="border-b border-gray-200 py-3 font-bold text-pink-600">{NARACorrect}</td>
              </tr>
              <tr>
                <td className="border-b border-gray-200 py-3 font-bold">北海道</td>
                <td className="border-b border-gray-200 py-3">{DOUCount}</td>
                <td className="border-b border-gray-200 py-3 font-bold text-pink-600">{DOUCorrect}</td>
              </tr>
            </tbody>
          </table>

          {/* 称号 */}
          {isGameEnded && (
            <div className="my-5 p-5 bg-amber-50 rounded-lg border-2 border-amber-300 text-left">
              <h3 className="text-lg font-bold text-center mb-4">獲得した称号</h3>

              <div className="flex flex-col gap-3 mb-5">
                {getTitles().map((title, index) => (
                  <details
                    key={index}
                    className="bg-white p-3 rounded-md border border-amber-300 cursor-pointer"
                  >
                    <summary className="text-lg font-bold text-orange-700 outline-none">
                      🏆 {title.name}
                    </summary>
                    <p className="mt-2 text-sm text-gray-700 pl-6">{title.description}</p>
                  </details>
                ))}
              </div>

              <div className="text-center">
                <button
                  onClick={() => navigate("/")}
                  className="w-[200px] py-2 rounded-lg font-bold text-white bg-amber-500 hover:bg-amber-600 active:scale-95 transition"
                >
                  ホームに戻る
                </button>
              </div>
            </div>
          )}

          {/* 終了ボタン */}
          {!isGameEnded && (
            <div className="text-center mt-5">
              <button
                onClick={() => setIsConfirmOpen(true)}
                className="w-[250px] py-3 rounded-lg font-bold text-white bg-red-500 hover:bg-red-600 active:scale-95 transition text-lg"
              >
                回答を終了する
              </button>
              <p className="mt-3 text-base text-gray-600">
                ※終了時、結果に応じた称号が獲得できます
              </p>
            </div>
          )}
        </div>
      </div>
    )}

    {/* ========== 終了確認ダイアログ ========== */}
    {isConfirmOpen && (
      <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[1001]">
        <div className="bg-white p-8 rounded-xl text-center w-[95%] max-w-sm shadow-[0_4px_15px_rgba(0,0,0,0.3)]">
          <p className="text-xl font-bold mb-6">本当に回答を終了しますか？</p>

          <div className="flex gap-4">
            <button
              onClick={() => {
                setIsConfirmOpen(false);
                setIsGameEnded(true);
              }}
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
export default SingleGame;