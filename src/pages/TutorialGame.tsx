import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../lib/googleMaps/loader";
import { useNavigate } from "react-router-dom";
import type { Answers } from "../lib/googleMaps/types";

// pano, heading, pitch を使って視点を完全に固定
const TUTORIAL_STEPS = [
  {
    answer: "奈良県" as Answers,
    pano: "IbNcUnTUdgZUvrJpU9mmhg",
    heading: 277.9857445300277,
    pitch: 6.823334801899023,
    zoom: 1,
    getHint: () =>
      "残念！ですが、鹿が歩いていたり、歴史的な雰囲気があるこの景色…特徴的な場所と言えば…？",
    explanation:
      "ここは奈良県。鹿や古いお寺が見えたら、『なら！』を選びましょう。",
  },
  {
    answer: "北海道" as Answers,
    pano: "4TgyUGEe_ekAQNnZ6C9FMA",
    heading: 148.19,
    pitch: -17.310000000000002,
    zoom: 1,
    getHint: () =>
      "残念！ですが、有名なビールの看板や、縦信号、長く続く十字の道路。そして、書かれている文字を見ると…？",
    explanation:
      "ここは北海道。どこまでも続くような道や、北国特有の標識が見えたら『どう！』を選びましょう。",
  },
  {
    answer: "OTHER" as Answers,
    pano: "4VHj2AGjDnPuSqoqBGsMxg",
    heading: 290.38117840903095,
    pitch: -5.946534665583343,
    zoom: 1,
    getHint: (userSays: Answers) => {
      if (userSays === "奈良県") {
        return "奈良県は内陸県ですよ…？";
      } else if (userSays === "北海道") {
        return "この写真から北国を感じ取ったのですか…？";
      }
      return "残念！もう一度考えてましょう。";
    },
    explanation:
      "ここは沖縄県。奈良でも北海道でもない景色が出たら、『それ以外！』を選びましょう。",
  },
];

function TutorialGame() {
  const panoRef = useRef<HTMLDivElement | null>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // チュートリアル開始時の説明ステップ（0: 景色説明、1: ボタン説明、2: 説明終了でゲーム開始）
  const [introStep, setIntroStep] = useState(0);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await loadGoogleMaps();

      if (!panoRef.current) return;

      panoramaRef.current = new google.maps.StreetViewPanorama(panoRef.current, {
        addressControl: false,
        fullscreenControl: true,
        motionTracking: false,
        showRoadLabels: false,
        zoomControl: true,
        panControl: true,
        linksControl: false,
        clickToGo: true,
      });

      loadStep(0);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 指定したステップの景色（panoと視点）を読み込む
  const loadStep = (stepIndex: number) => {
    if (!panoramaRef.current) return;
    setIsLoading(true);

    const stepData = TUTORIAL_STEPS[stepIndex];

    // 景色をセットする前にロード完了を待つ
    google.maps.event.addListenerOnce(
      panoramaRef.current,
      "status_changed",
      () => {
        setIsLoading(false);
      }
    );

    panoramaRef.current.setPano(stepData.pano);
    panoramaRef.current.setPov({ heading: stepData.heading, pitch: stepData.pitch });
    panoramaRef.current.setZoom(stepData.zoom);
  };

  const submit = (userSays: Answers) => {
    if (introStep < 2) return; //説明が終わるまでは反応させない
    const currentData = TUTORIAL_STEPS[currentStep];

    if (userSays === currentData.answer) {
      setSuccessMessage(currentData.explanation);
    } else {
      setHintMessage(currentData.getHint(userSays));
    }
  };

  const nextStepOrFinish = () => {
    setSuccessMessage(null);
    const nextIndex = currentStep + 1;

    if (nextIndex < TUTORIAL_STEPS.length) {
      setCurrentStep(nextIndex);
      loadStep(nextIndex);
    } else {
      finishTutorial();
    }
  };

  const finishTutorial = () => {
    localStorage.setItem("tutorialCompleted", "true");
    navigate("/mainpage");
  };


  return (
    <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover py-6 px-5">
      {/* ===== メインカード（SingleGame寄せ） ===== */}
      <div className="border-2 rounded-xl border-black bg-white/80 backdrop-blur p-4 w-[95%] sm:w-4/5 md:w-2/3 max-w-5xl mx-auto relative z-[60]">
        {/* 上部：タイトル + 終了ボタン */}
        <div className="relative flex justify-center items-center mb-5 z-[51]">
          <div
            className={[
              "text-2xl sm:text-3xl font-bold",
              introStep < 2 ? "text-white" : "text-gray-900",
            ].join(" ")}
          >
            チュートリアル ({currentStep + 1} / {TUTORIAL_STEPS.length})
          </div>

          <button
            onClick={() => setIsConfirmOpen(true)}
            className="absolute right-0 px-3 sm:px-5 py-2 rounded-lg border border-gray-300 bg-gray-50 text-xs sm:text-sm font-bold
                       hover:bg-gray-100 active:scale-95 transition"
          >
            チュートリアルを終了する
          </button>
        </div>

        {/* メイン */}
        <div className="w-full mx-auto">
          {/* ストリートビュー枠：外側は overflow-visible、内側だけ overflow-hidden */}
          <div
            className={[
              "relative w-full",
              // introStep=0 の時だけ “地図を暗転より前” に出す
              introStep === 0 ? "z-[60]" : "z-[40]",
            ].join(" ")}
          >
            {/* ここが “枠” 本体（こっちだけ overflow-hidden） */}
            <div className="relative w-full h-[360px] sm:h-[420px] md:h-[500px] rounded-lg overflow-hidden border border-gray-300 bg-white">
              <div ref={panoRef} className="w-full h-full" />

              {/* ロード中 */}
              {isLoading && (
                <div className="absolute inset-0 bg-black/70 flex flex-col justify-center items-center z-10 text-white">
                  <div className="text-lg sm:text-2xl font-bold mb-2">
                    {"景色を準備中です...".split("").map((char, i) => (
                      <span
                        key={i}
                        className="inline-block animate-wave"
                        style={{ animationDelay: `${i * 0.1}s` }}
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ✅ introStep 0：枠の外に出してもクリップされない（外側divがoverflow-visibleだから） */}
            {introStep === 0 && (
              <div className="absolute left-1/2 top-full mt-3 sm:mt-4 -translate-x-1/2 z-[52] w-[95%] max-w-md flex flex-col items-center">
                {/* 上向き矢印 */}
                <div
                  className="w-0 h-0"
                  style={{
                    borderLeft: "16px solid transparent",
                    borderRight: "16px solid transparent",
                    borderBottom: "16px solid white",
                    marginBottom: "-1px",
                  }}
                />
                <div className="bg-white p-4 sm:p-6 rounded-xl text-center w-full shadow-[0_10px_25px_rgba(0,0,0,0.2)] border border-gray-200">
                  <p className="text-base sm:text-lg font-bold leading-relaxed mb-4 sm:mb-5 text-gray-800">
                    この場所はストリートビュー。景色が表示されます。<br />
                    表示される景色の中から、場所を判断できる特徴を探しましょう！
                  </p>
                  <button
                    onClick={() => setIntroStep(1)}
                    className="w-[180px] py-2 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition"
                  >
                    OK！(1/2)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 回答ボタン列 */}
          <div
            className={[
              "relative flex justify-center items-center gap-3 sm:gap-5 mt-4 min-h-[50px]",
              // introStep=1 の時だけ “ボタンを暗転より前” に出す
              introStep === 1 ? "z-[60]" : "z-[40]",
            ].join(" ")}
          >
            {/* ===== introStep 1：ボタン列にアンカーする吹き出し（矢印ズレ対策） ===== */}
            {introStep === 1 && (
              <div className="absolute left-1/2 bottom-full mb-3 sm:mb-4 -translate-x-1/2 z-[70] w-[95%] max-w-md flex flex-col items-center">
                <div className="bg-white p-4 sm:p-6 rounded-xl text-center w-full shadow-[0_10px_25px_rgba(0,0,0,0.2)] border border-gray-200">
                  <p className="text-base sm:text-lg font-bold leading-relaxed mb-4 sm:mb-5 text-gray-800">
                    これらは回答ボタン。『なら！(奈良県)』『どう！(北海道)』『それ以外！』の中から、
                    ここだ！と思う選択肢を選びましょう。
                  </p>
                  <button
                    onClick={() => setIntroStep(2)}
                    className="w-[180px] py-2 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition"
                  >
                    OK！(2/2)
                  </button>
                </div>

                {/* 下向き矢印（ボタンを指す） */}
                <div
                  className="w-0 h-0"
                  style={{
                    borderLeft: "16px solid transparent",
                    borderRight: "16px solid transparent",
                    borderTop: "16px solid white",
                    marginTop: "-1px",
                  }}
                />
              </div>
            )}

            <button
              onClick={() => submit("奈良県")}
              className="w-[104px] sm:w-[120px] py-2 rounded-lg border border-gray-300 bg-gray-50 font-bold transition
                         hover:bg-gray-100 active:scale-95 text-sm sm:text-base"
            >
              なら！
            </button>
            <button
              onClick={() => submit("北海道")}
              className="w-[104px] sm:w-[120px] py-2 rounded-lg border border-gray-300 bg-gray-50 font-bold transition
                         hover:bg-gray-100 active:scale-95 text-sm sm:text-base"
            >
              どう！
            </button>
            <button
              onClick={() => submit("OTHER")}
              className="w-[104px] sm:w-[120px] py-2 rounded-lg border border-gray-300 bg-gray-50 font-bold transition
                         hover:bg-gray-100 active:scale-95 text-sm sm:text-base"
            >
              それ以外！
            </button>
          </div>
        </div>
      </div>

      {/* ===== intro中：背景暗転（1個だけ） ===== */}
      {introStep < 2 && (
        <div className="fixed inset-0 bg-black/60 z-[50] pointer-events-none" />
      )}

      {/* ===== ヒントモーダル ===== */}
      {hintMessage && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[1000] px-4">
          <div className="bg-white p-6 sm:p-8 rounded-xl text-center w-full max-w-sm shadow-[0_4px_15px_rgba(0,0,0,0.3)]">
            <p className="text-base sm:text-lg font-bold text-pink-600 mb-6 leading-relaxed">
              {hintMessage}
            </p>
            <button
              onClick={() => setHintMessage(null)}
              className="w-full sm:w-[220px] py-2 rounded-lg font-bold bg-gray-200 text-gray-800 hover:bg-gray-300 active:scale-95 transition"
            >
              もう一度考える
            </button>
          </div>
        </div>
      )}

      {/* ===== 正解モーダル ===== */}
      {successMessage && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[1000] px-4">
          <div className="bg-white p-6 sm:p-8 rounded-xl text-center w-full max-w-sm shadow-[0_4px_15px_rgba(0,0,0,0.3)]">
            <div className="text-2xl sm:text-3xl font-bold text-emerald-600 mb-4">
              正解！
            </div>
            <p className="text-sm sm:text-base text-gray-800 mb-6 leading-relaxed">
              {successMessage}
            </p>
            <button
              onClick={nextStepOrFinish}
              className="w-full sm:w-[240px] py-2 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition"
            >
              {currentStep + 1 === TUTORIAL_STEPS.length
                ? "チュートリアル完了！"
                : "次の景色へ"}
            </button>
          </div>
        </div>
      )}

      {/* ===== 終了確認モーダル ===== */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[1001] px-4">
          <div className="bg-white p-6 sm:p-8 rounded-xl text-center w-full max-w-sm shadow-[0_4px_15px_rgba(0,0,0,0.3)]">
            <p className="text-lg sm:text-xl font-bold mb-2">
              チュートリアルを終了しますか？
            </p>
            <p className="text-xs sm:text-sm text-gray-600 mb-6">
              (後から再度行うことも可能です)
            </p>

            <div className="flex gap-4">
              <button
                onClick={finishTutorial}
                className="flex-1 py-2 rounded-lg font-bold text-white bg-red-500 hover:bg-red-600 active:scale-95 transition"
              >
                終了する
              </button>
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 py-2 rounded-lg font-bold bg-gray-200 text-gray-800 hover:bg-gray-300 active:scale-95 transition"
              >
                続ける
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TutorialGame;