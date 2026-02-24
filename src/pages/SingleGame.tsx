import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../lib/googleMaps/loader";
import { createStreetViewGame } from "../lib/googleMaps/streetviewGame";
import type { Answers, Question, AnswerResult } from "../lib/googleMaps/types";
//ホームに戻すために追加
import { useNavigate } from 'react-router-dom';

function SingleGame() {
  const panoRef = useRef<HTMLDivElement | null>(null);
  const answerMapRef = useRef<HTMLDivElement | null>(null);

  const [question, setQuestion] = useState<Question | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [open, setOpen] = useState(false);
  // 総出題数、奈良出題数、道出題数、それらの正解数の合計6つのuseStateを作成
  const [TotalCount, setTotalCount] = useState(0);
  const [TotalCorrect, setTotalCorrect] = useState(0);
  const [NARACount, setNARACount] = useState(0);
  const [NARACorrect, setNARACorrect] = useState(0);
  const [DOUCount, setDOUCount] = useState(0);
  const [DOUCorrect, setDOUCorrect] = useState(0);

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

    // SingleGame.tsx の nextQuestion 内
    const rand = Math.random();
    let mode: "NARA" | "DOU" | "OTHER";

    if (rand < 0.2) {
      mode = "DOU";       // 0.0〜0.2未満 (20%)
    } else if (rand < 0.7) {
      mode = "NARA";      // 0.2〜0.7未満 (50%)
    } else {
      mode = "OTHER";     // 0.7〜1.0未満 (30%)
    }

    const q = await gameRef.current.newView({ mode, panorama: panoramaRef.current });
    setQuestion(q);
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
      if (question.prefName === "奈良県") {
        setNARACorrect(prev => prev + 1);
      } else if (question.prefName === "北海道") {
        setDOUCorrect(prev => prev + 1);
      }
    }
    // 出題数を更新
    if (question.prefName === "奈良県") {
      setNARACount(prev => prev + 1);
    } else if (question.prefName === "北海道") {
      setDOUCount(prev => prev + 1);
    }
    setOpen(true);
  }

  return (
    <>
      {/* 上部の問題数とボタン */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "20px", margin: "10px 0" }}>
        <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
          現在 {TotalCount + 1} 問目
        </div>
        <button onClick={() => setIsStatsOpen(true)}>現在の回答状況</button>
      </div>

      {/* メインのゲーム画面 */}
      <div id="mainDiv">
        <div id="pano" ref={panoRef} style={{ width: "100%", height: 400 }} />
        <div id="BtnDiv">
          <button onClick={() => submit("奈良県")}>なら！</button>
          <button onClick={() => submit("北海道")}>どう！</button>
          <button onClick={() => submit("OTHER")}>それ以外！</button>
        </div>
      </div>

      {/* 答え合わせダイアログ */}
      {open && (
        <dialog open>
          <div id="dialog_header">
            <div id="resultText">{result?.ok ? "正解！" : "不正解…"}</div>
            <button type="button" onClick={nextQuestion}>閉じる</button>
          </div>
          <div id="answerMap" ref={answerMapRef} style={{ width: 400, height: 300 }} />
        </dialog>
      )}

      {/* --- ここから下が今回追加する リザルト関連のUI --- */}
      
      {/* 回答状況ダイアログ（外側クリックで閉じるための背景カバー） */}
      {isStatsOpen && (
        <div 
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
          onClick={() => { if (!isConfirmOpen) setIsStatsOpen(false); }} // 外側クリックで閉じる（確認画面が出ている時は閉じない）
        >
          {/* ダイアログ本体（クリックイベントが背景に貫通しないようにストップ） */}
          <div 
            style={{ position: "relative", backgroundColor: "white", padding: "30px", borderRadius: "8px", width: "400px", textAlign: "center" }}
            onClick={(e) => e.stopPropagation()} 
          >
            {/* 右上の丸い×ボタン */}
            <button 
              onClick={() => setIsStatsOpen(false)}
              style={{ position: "absolute", top: "-15px", right: "-15px", width: "35px", height: "35px", borderRadius: "50%", backgroundColor: "#333", color: "white", border: "none", cursor: "pointer", fontSize: "1.2rem", fontWeight: "bold" }}
            >
              ×
            </button>

            <h2>現在の回答状況</h2>

            {/* 縦2×横3のグリッド表示 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", margin: "20px 0" }}>
              <div>
                <strong>全体</strong><br />
                出題: {TotalCount}<br />
                正解: {TotalCorrect}
              </div>
              <div>
                <strong>奈良</strong><br />
                出題: {NARACount}<br />
                正解: {NARACorrect}
              </div>
              <div>
                <strong>北海道</strong><br />
                出題: {DOUCount}<br />
                正解: {DOUCorrect}
              </div>
            </div>

            {/* 称号表示エリア（ゲーム終了時のみ表示） */}
            {isGameEnded && (
              <div style={{ margin: "20px 0", padding: "15px", backgroundColor: "#f0f8ff", borderRadius: "8px" }}>
                <h3>今回の称号</h3>
                <p style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#d2691e" }}>【 称号：考え中… 】</p>
                <button onClick={() => navigate('/')} style={{ marginTop: "10px", padding: "8px 16px" }}>ホームに戻る</button>
              </div>
            )}

            {/* 終了ボタン（ゲームが終わっていない時だけ表示） */}
            {!isGameEnded && (
              <div style={{ textAlign: "right", marginTop: "20px" }}>
                <button onClick={() => setIsConfirmOpen(true)}>回答を終了する</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 終了確認ダイアログ（回答状況ダイアログの上に重ねる） */}
      {isConfirmOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1001 }}>
          <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", textAlign: "center" }}>
            <p>本当に回答を終了しますか？</p>
            <div style={{ display: "flex", justifyContent: "space-around", marginTop: "15px" }}>
              <button onClick={() => { setIsConfirmOpen(false); setIsGameEnded(true); }}>はい</button>
              <button onClick={() => setIsConfirmOpen(false)}>いいえ</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export default SingleGame;