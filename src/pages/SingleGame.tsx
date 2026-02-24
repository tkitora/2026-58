import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../lib/googleMaps/loader";
import { createStreetViewGame } from "../lib/googleMaps/streetviewGame";
import type { Answers, Question, AnswerResult } from "../lib/googleMaps/types";

function SingleGame() {
  const panoRef = useRef<HTMLDivElement | null>(null);
  const answerMapRef = useRef<HTMLDivElement | null>(null);

  const [question, setQuestion] = useState<Question | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [open, setOpen] = useState(false);

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
    setOpen(true);
  }

  return (
    <>
      <div id="mainDiv">
        <div id="pano" ref={panoRef} style={{ width: "100%", height: 400 }} />
        <div id="BtnDiv">
          <button onClick={() => submit("奈良県")}>なら！</button>
          <button onClick={() => submit("北海道")}>どう！</button>
          <button onClick={() => submit("OTHER")}>それ以外！</button>
        </div>
      </div>

      {open && (
        <dialog open>
          <div id="dialog_header">
            <div id="resultText">{result?.ok ? "正解！" : "不正解…"}</div>
            <button type="button" onClick={nextQuestion}>閉じる</button>
          </div>
          <div id="answerMap" ref={answerMapRef} style={{ width: 400, height: 300 }} />
        </dialog>
      )}
    </>
  );
}
export default SingleGame;