import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../lib/googleMaps/loader";
import { useNavigate } from 'react-router-dom';
import type { Answers } from "../lib/googleMaps/types";

// pano, heading, pitch を使って視点を完全に固定
const TUTORIAL_STEPS = [
  {
    answer: "奈良県" as Answers,
    pano: "IbNcUnTUdgZUvrJpU9mmhg",
    heading: 277.9857445300277,
    pitch: 6.823334801899023,
    zoom: 1,
    getHint: (userSays: Answers) => "残念！ですが、鹿が歩いていたり、歴史的な雰囲気があるこの景色…特徴的な場所と言えば…？",
    explanation: "ここは奈良県。鹿や古いお寺が見えたら、『なら！』を選びましょう。"
  },
  {
    answer: "北海道" as Answers,
    pano: "4TgyUGEe_ekAQNnZ6C9FMA", 
    heading: 148.19,
    pitch: -17.310000000000002,  
    zoom: 1,
    getHint: (userSays: Answers) => "残念！ですが、有名なビールの看板や、縦信号、長く続く十字の道路。そして、書かれている文字を見ると…？",
    explanation: "ここは北海道。どこまでも続くような道や、北国特有の標識が見えたら『どう！』を選びましょう。"
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
    explanation: "ここは沖縄県。奈良でも北海道でもない景色が出たら、『それ以外！』を選びましょう。"
  }
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
// 指定したステップの景色（panoと視点）を読み込む
  const loadStep = (stepIndex: number) => {
    if (!panoramaRef.current) return;
    setIsLoading(true);
    
    const stepData = TUTORIAL_STEPS[stepIndex];

    // ★ 景色をセットする『前』に、ロード完了を待つイベントを登録する
    google.maps.event.addListenerOnce(panoramaRef.current, 'status_changed', () => {
      setIsLoading(false);
    });
    
    // その後に panoID と、向く方向(heading)、上下の角度(pitch)をセット
    panoramaRef.current.setPano(stepData.pano);
    panoramaRef.current.setPov({ heading: stepData.heading, pitch: stepData.pitch });
    panoramaRef.current.setZoom(stepData.zoom);
  };

const submit = (userSays: Answers) => {
    if (introStep < 2) return; //説明が終わるまでは反応させない
    const currentData = TUTORIAL_STEPS[currentStep];

    if (userSays === currentData.answer) {
      // 正解
      setSuccessMessage(currentData.explanation);
    } else {
      // 不正解（ユーザーの回答に応じたヒントを出す）
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

  const btnStyle = {
    width: "120px",
    padding: "10px 0",
    borderRadius: "8px",
    border: "1px solid #ccc",
    backgroundColor: "#f9f9f9",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "bold",
    textAlign: "center" as const
  };

  return (
    <div style={{ 
      maxWidth: "1500px", 
      margin: "0 auto", 
      padding: "20px",
      position: "relative", // ★追加：説明用ポップアップを絶対配置する基準にする
      minHeight: "100vh",   // ★追加：コンテンツが短くても画面いっぱいの高さを確保する
    }}>
      
      <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "20px",
        zIndex: 51
       }}>
        <div style={{ fontSize: "2rem", fontWeight: "bold", color: introStep < 2 ? "white" : "black" }}>
          チュートリアル ({currentStep + 1} / {TUTORIAL_STEPS.length})
        </div>
        <button 
          onClick={() => setIsConfirmOpen(true)}
          style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #ccc", backgroundColor: "#fff", cursor: "pointer", fontSize: "0.9rem", fontWeight: "bold", position: "absolute", right: 0 }}
        >
          チュートリアルを終了する
        </button>
      </div>

      <div style={{ width: "100%", margin: "0 auto" }}>
        <div style={{ 
          position: "relative", width: "100%", height: "500px", 
          borderRadius: "8px", overflow: "hidden", border: "1px solid #ddd",
          zIndex: introStep === 0 ? 51 : "auto", backgroundColor: "white" 
        }}>
          <div ref={panoRef} style={{ width: "100%", height: "100%" }} />
          
          {isLoading && (
            <div style={{
              position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
              backgroundColor: "rgba(0, 0, 0, 0.7)", 
              display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
              zIndex: 10, color: "white"
            }}>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
                景色を準備中です...
              </div>
            </div>
          )}
        </div>
        
        <div style={{ 
          display: "flex", justifyContent: "center", gap: "20px", marginTop: "20px",
          position: "relative", zIndex: introStep === 1 ? 51 : "auto",
          backgroundColor: introStep === 1 ? "rgba(255,255,255,0.8)" : "transparent",
          padding: introStep === 1 ? "10px" : "0", borderRadius: "8px"
        }}>
          <button onClick={() => submit("奈良県")} style={btnStyle}>なら！</button>
          <button onClick={() => submit("北海道")} style={btnStyle}>どう！</button>
          <button onClick={() => submit("OTHER")} style={btnStyle}>それ以外！</button>
        </div>
      </div>

{/* ★ ここから新しい導入説明ブロック（一番最後に配置） */}
      
      {/* チュートリアル開始時の背景暗転フィルター */}
      {introStep < 2 && (
        <div style={{ 
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", 
          backgroundColor: "rgba(0,0,0,0.6)", zIndex: 50
        }} />
      )}

      {/* 導入ステップの説明ポップアップエリア（フィルターの上に配置） */}
      {/* ★ ここから新しい導入説明ブロック（一番最後に配置） */}
      
      {/* チュートリアル開始時の背景暗転フィルター */}
      {introStep < 2 && (
        <div style={{ 
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", 
          backgroundColor: "rgba(0,0,0,0.6)", zIndex: 50
        }} />
      )}

      {/* ステップ0：ストリートビューの説明（ビューの上部に被せて、上向き矢印） */}
      {introStep === 0 && (
        <div style={{ 
          position: "absolute", 
          top: "150px",       // ビューの上部あたりに配置
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 52,
          display: "flex", flexDirection: "column", alignItems: "center",
          width: "90%", maxWidth: "500px"
        }}>
          {/* 上向きの矢印（ビューを指す） */}
          <div style={{
            width: 0, height: 0,
            borderLeft: "20px solid transparent",
            borderRight: "20px solid transparent",
            borderBottom: "20px solid white",
            marginBottom: "-1px"
          }} />

          {/* 白いポップアップボックス */}
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", textAlign: "center", width: "100%", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <p style={{ fontSize: "1.2rem", marginBottom: "20px", fontWeight: "bold", lineHeight: "1.5" }}>
              この場所はストリートビュー。景色が表示されます。<br />
              表示される景色の中から、場所を判断できる特徴を探しましょう！
            </p>
            <button onClick={() => setIntroStep(1)} style={{ ...btnStyle, width: "150px", backgroundColor: "#4CAF50", color: "white", border: "none" }}>OK！(1/2)</button>
          </div>
        </div>
      )}

      {/* ステップ1：ボタンの説明（ビューの下部に被せて、下向き矢印） */}
      {introStep === 1 && (
        <div style={{ 
          position: "absolute", 
          top: "400px",       // ビューの下端あたり（ボタンのすぐ上）に配置
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 52,
          display: "flex", flexDirection: "column", alignItems: "center",
          width: "90%", maxWidth: "500px"
        }}>
          {/* 白いポップアップボックス */}
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", textAlign: "center", width: "100%", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <p style={{ fontSize: "1.2rem", marginBottom: "20px", fontWeight: "bold", lineHeight: "1.5" }}>
              これらは回答ボタン。『なら！(奈良県)』『どう！(北海道)』『それ以外！』の中から、ここだ！と思う選択肢を選びましょう。
            </p>
            <button onClick={() => setIntroStep(2)} style={{ ...btnStyle, width: "150px", backgroundColor: "#4CAF50", color: "white", border: "none" }}>OK！(2/2)</button>
          </div>
          
          {/* 下向きの矢印（ボタンを指す） */}
          <div style={{
            width: 0, height: 0,
            borderLeft: "20px solid transparent",
            borderRight: "20px solid transparent",
            borderTop: "20px solid white",
            marginTop: "-1px"
          }} />
        </div>
      )}
      {/* ★ 追加ここまで */}
      {hintMessage && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", textAlign: "center", width: "400px" }}>
            <p style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#e91e63", marginBottom: "20px" }}>
              {hintMessage}
            </p>
            <button onClick={() => setHintMessage(null)} style={{ ...btnStyle, width: "150px" }}>もう一度考える</button>
          </div>
        </div>
      )}

      {successMessage && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", textAlign: "center", width: "400px" }}>
            <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#4CAF50", marginBottom: "15px" }}>正解！</div>
            <p style={{ fontSize: "1.1rem", marginBottom: "25px", lineHeight: "1.5" }}>{successMessage}</p>
            <button onClick={nextStepOrFinish} style={{ ...btnStyle, width: "200px", backgroundColor: "#4CAF50", color: "white", border: "none" }}>
              {currentStep + 1 === TUTORIAL_STEPS.length ? "チュートリアル完了！" : "次の景色へ"}
            </button>
          </div>
        </div>
      )}

      {isConfirmOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1001 }}>
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", textAlign: "center", width: "400px" }}>
            <p style={{ fontSize: "1.3rem", fontWeight: "bold", marginBottom: "10px" }}>チュートリアルを終了しますか？</p>
            <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "25px" }}>(後から再度行うことも可能です)</p>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "15px" }}>
              <button 
                onClick={finishTutorial}
                style={{ ...btnStyle, flex: 1, backgroundColor: "#ff5252", color: "white", border: "none" }}
              >
                終了する
              </button>
              <button 
                onClick={() => setIsConfirmOpen(false)}
                style={{ ...btnStyle, flex: 1, backgroundColor: "#e0e0e0", color: "#333", border: "none" }}
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