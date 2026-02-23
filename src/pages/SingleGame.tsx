import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../lib/googleMaps/loader";
import { createStreetViewGame } from "../lib/googleMaps/streetviewGame";
import type { Question, AnswerResult } from "../lib/googleMaps/types";

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

    const mode = Math.random() < 0.5 ? "NARA" : "NOT_NARA";
    const q = await gameRef.current.newView({ mode, panorama: panoramaRef.current });
    setQuestion(q);
  }

  function submit(userSaysNara: boolean) {
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
          <button onClick={() => submit(true)}>なら！</button>
          <button onClick={() => submit(false)}>なら以外！</button>
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