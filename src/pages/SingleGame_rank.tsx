import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../lib/googleMaps/loader";
import { createStreetViewGame } from "../lib/googleMaps/streetviewGame";
import type { Answers, Question, AnswerResult } from "../lib/googleMaps/types";
import { useNavigate } from 'react-router-dom';
import { supabase } from "../lib/supabase";

type TitleData = {
  name: string;
  description: string;
};

// ランキング用の最大問題数を設定
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

  // ランキング特有のState
  const [isConfirmOpen, setIsConfirmOpen] = useState(false); // リタイア確認用
  const [showResultScreen, setShowResultScreen] = useState(false); // 最終リザルト画面用
  const [playerName, setPlayerName] = useState(""); // プレイヤー名入力用

  const [isRegisterConfirmOpen, setIsRegisterConfirmOpen] = useState(false); // 登録確認用
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);   // 破棄（登録しない）確認用

  const navigate = useNavigate();

  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const gameRef = useRef<ReturnType<typeof createStreetViewGame> | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!open || !result || !gameRef.current || !answerMapRef.current) return;
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

  function submit(userSaysNara: Answers) {
    if (!gameRef.current || !question) return;
    const r = gameRef.current.checkResult(question, userSaysNara);
    setResult(r);
    
    setTotalCount(prev => prev + 1);
    if (r.ok) {
      setTotalCorrect(prev => prev + 1);
      setCorrectKeep(prev => prev + 1);
      if (CorrectKeep + 1 > MaxCorrectKeep) setMaxCorrectKeep(CorrectKeep + 1);
      if (question.prefName === "奈良県") setNARACorrect(prev => prev + 1);
      else if (question.prefName === "北海道") setDOUCorrect(prev => prev + 1);
    } else {
      setCorrectKeep(0);
    }
    
    if (question.prefName === "奈良県") setNARACount(prev => prev + 1);
    else if (question.prefName === "北海道") setDOUCount(prev => prev + 1);
    
    setOpen(true);
  }

  function getTitles(): TitleData[] {
    const earnedTitles: TitleData[] = [];
    if (TotalCount === 0) return [{ name: "準備中の旅人", description: "まだ1問も答えていない。まずは遊んでみて！" }];

    const totalRate = TotalCorrect / TotalCount;
    const naraRate = NARACount > 0 ? NARACorrect / NARACount : 0;
    const douRate = DOUCount > 0 ? DOUCorrect / DOUCount : 0;

    if (douRate === 1 && DOUCount > 0) earnedTitles.push({ name: "道民", description: "北海道の問題を全問正解。" });
    if (DOUCount > 0 && NARACount > 0 && douRate > naraRate) earnedTitles.push({ name: "生粋の道民", description: "奈良よりも北海道の正答率が高い。" });
    if (naraRate === 1 && NARACount > 0) earnedTitles.push({ name: "奈良県民", description: "奈良県の問題を全問正解。" });
    if (NARACount >= 5 && naraRate === 1) earnedTitles.push({ name: "生粋の奈良県民", description: "奈良の問題に5問以上回答し、全問正解。鹿と山はトモダチ。" });
    if (TotalCount >= 20 && totalRate >= 0.9) earnedTitles.push({ name: "マスター旅人", description: "全体の正答率90%以上。地理マスター。" });
    if (TotalCount >= 20 && totalRate >= 0.8) earnedTitles.push({ name: "凄腕の旅人", description: "全体の正答率80%以上。地理に詳しい。" });
    if (MaxCorrectKeep >= 10) earnedTitles.push({ name: "ゾーン突入", description: "10問以上連続で正解した。今のあなたには全てが見えている。" });
    if (earnedTitles.length === 0 && totalRate < 0.5) earnedTitles.push({ name: "迷子の旅人", description: "正答率が50%未満。少し方向音痴かも…？" });
    if (earnedTitles.length === 0) earnedTitles.push({ name: "駆け出しゲッサー", description: "正答率50%以上の標準的な旅人。これからもっと伸びるはず！" });

    return earnedTitles;
  }

  // DB登録用のダミー関数
  // DB登録用の関数（非同期処理に書き換え）
  const handleRegister = async () => {
    const finalName = playerName.trim() === "" ? "名無しのゲッサー" : playerName;
    
    const { error } = await supabase
      .from('single_ranking')
      .insert([
        { player_name: finalName, score: TotalCorrect }
      ]);

    if (error) {
      console.error("ランキングの登録に失敗しました:", error.message);
      alert("通信エラーが発生しました。もう一度お試しください。");
      return; // エラーの時は画面遷移させずに止める
    }

    navigate('/singlerank'); 
  };

  const btnStyle = { width: "120px", padding: "10px 0", borderRadius: "8px", border: "1px solid #ccc", backgroundColor: "#f9f9f9", cursor: "pointer", fontSize: "1rem", fontWeight: "bold", textAlign: "center" as const };

  return (
    <div style={{ maxWidth: "1500px", margin: "0 auto", padding: "20px" }}>
      
      <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ fontSize: "2rem", fontWeight: "bold" }}>
          現在 {CurrentNumber} / {MAX_QUESTIONS} 問目
        </div>
        {/* リタイアボタン */}
        <button 
          onClick={() => setIsConfirmOpen(true)}
          style={{ padding: "10px 20px", borderRadius: "8px", border: "none", backgroundColor: "#ff5252", color: "white", cursor: "pointer", fontSize: "0.9rem", fontWeight: "bold", position: "absolute", right: 0 }}
        >
          リタイア
        </button>
      </div>

      <div id="mainDiv" style={{ width: "100%", margin: "0 auto" }}>
        <div style={{ position: "relative", width: "100%", height: "500px", borderRadius: "8px", overflow: "hidden", border: "1px solid #ddd" }}>
          <div id="pano" ref={panoRef} style={{ width: "100%", height: "100%" }} />
          {isLoading && (
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0, 0, 0, 0.7)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", zIndex: 10, color: "white" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "10px" }}>景色を探しています...</div>
            </div>
          )}
        </div>
        
        <div style={{ textAlign: "right", marginTop: "8px" }}>
          <span style={{ fontSize: "0.8rem", color: "#666", marginRight: "10px" }}>※10秒以上経っても景色が出ない場合は、再取得をお試しください。</span>
          <button onClick={nextQuestion} disabled={isLoading} style={{ padding: "4px 8px", fontSize: "0.8rem", borderRadius: "4px", border: "1px solid #aaa", backgroundColor: isLoading ? "#eee" : "#fff", cursor: isLoading ? "not-allowed" : "pointer" }}>↻ 景色を再取得する</button>
        </div>
        
        <div id="BtnDiv" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "20px", marginTop: "10px", minHeight: "50px" }}>
          <button onClick={() => submit("奈良県")} style={btnStyle} disabled={open}>なら！</button>
          <button onClick={() => submit("北海道")} style={btnStyle} disabled={open}>どう！</button>
          <button onClick={() => submit("OTHER")} style={btnStyle} disabled={open}>それ以外！</button>
        </div>
      </div>

      {/* 答え合わせダイアログ */}
      {open && result && !showResultScreen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "15px", color: result.ok ? "#e91e63" : "#3f51b5" }}>
              {result.ok ? (CorrectKeep >= 2 ? `${CorrectKeep}回連続正解！` : "正解！") : "不正解…"}
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#555", marginBottom: "15px" }}>({question?.prefName})</div>
            <div id="answerMap" ref={answerMapRef} style={{ width: "600px", height: "450px", borderRadius: "8px", overflow: "hidden", border: "1px solid #ccc" }} />
            
            <div style={{ marginTop: "20px", textAlign: "center", display: "flex", flexDirection: "column", gap: "10px" }}>
              <a 
                href={`https://maps.google.com/maps?q=${result.correctLatLng.lat()},${result.correctLatLng.lng()}`}
                target="_blank" 
                rel="noopener noreferrer"
                style={{ display: "inline-block", padding: "10px 20px", backgroundColor: "#4285F4", color: "white", textDecoration: "none", borderRadius: "8px", fontWeight: "bold" }}
              >Googleマップで見る</a>
              
              {/* 20問目の時だけボタンが「結果を見る」に変わる */}
              {TotalCount >= MAX_QUESTIONS ? (
                <button 
                  onClick={() => { setOpen(false); setShowResultScreen(true); }} 
                  style={{ ...btnStyle, width: "auto", backgroundColor: "#ffb300", color: "white", border: "none" }}
                >
                  結果を見る
                </button>
              ) : (
                <button onClick={nextQuestion} style={{ ...btnStyle, width: "auto" }}>次の問題へ</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 最終リザルト＆登録画面 */}
      {showResultScreen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "40px", borderRadius: "12px", width: "500px", textAlign: "center", boxShadow: "0 4px 15px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: "2rem", marginBottom: "10px", color: "#333" }}>最終結果</h2>
            <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#e91e63", marginBottom: "20px" }}>
              {TotalCorrect} / {MAX_QUESTIONS} 問正解！
            </div>

            {/* 称号表示エリア */}
            <div style={{ margin: "20px 0", padding: "15px", backgroundColor: "#fff8e1", borderRadius: "8px", border: "2px solid #ffca28", textAlign: "left" }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "1.1rem", textAlign: "center" }}>獲得した称号</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {getTitles().map((title, index) => (
                  <details key={index} style={{ backgroundColor: "white", padding: "8px", borderRadius: "6px", border: "1px solid #ffd54f", cursor: "pointer" }}>
                    <summary style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#d84315", outline: "none" }}>🏆 {title.name}</summary>
                    <p style={{ margin: "8px 0 0 0", fontSize: "0.9rem", color: "#555", paddingLeft: "25px" }}>{title.description}</p>
                  </details>
                ))}
              </div>
            </div>

            {/* 名前入力フォーム */}
            <div style={{ margin: "30px 0" }}>
              <p style={{ fontSize: "1.1rem", fontWeight: "bold", marginBottom: "10px" }}>あなたの名前を入力してください！</p>
              <input 
                type="text" 
                placeholder="名無しのゲッサー" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={15}
                style={{ width: "80%", padding: "12px", fontSize: "1.2rem", borderRadius: "6px", border: "2px solid #ccc", textAlign: "center" }}
              />
            </div>

            {/* 送信ボタン類 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "15px", alignItems: "center" }}>
              <button 
                onClick={() => setIsRegisterConfirmOpen(true)} 
                style={{ ...btnStyle, width: "80%", backgroundColor: "#4caf50", color: "white", border: "none", fontSize: "1.2rem", padding: "15px 0" }}
              >
                登録して終了
              </button>
              <button 
                onClick={() => setIsDiscardConfirmOpen(true)} 
                style={{ ...btnStyle, width: "80%", backgroundColor: "#e0e0e0", color: "#333", border: "none" }}
              >
                登録せずに終了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 終了確認ダイアログ */}
      {isConfirmOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1001 }}>
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", textAlign: "center", width: "350px", boxShadow: "0 4px 15px rgba(0,0,0,0.3)" }}>
            <p style={{ fontSize: "1.3rem", fontWeight: "bold", marginBottom: "25px" }}>本当に終了してホームに戻りますか？<br/><span style={{fontSize:"0.9rem", color:"#666"}}>（ここまでの記録は保存されません）</span></p>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "15px" }}>
              <button onClick={() => navigate('/')} style={{ ...btnStyle, flex: 1, backgroundColor: "#ff5252", color: "white", border: "none" }}>はい</button>
              <button onClick={() => setIsConfirmOpen(false)} style={{ ...btnStyle, flex: 1, backgroundColor: "#e0e0e0", color: "#333", border: "none" }}>いいえ</button>
            </div>
          </div>
        </div>
      )}

      {/* 登録確認ダイアログ */}
      {isRegisterConfirmOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1002 }}>
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", textAlign: "center", width: "400px", boxShadow: "0 4px 15px rgba(0,0,0,0.3)" }}>
            <p style={{ fontSize: "1.3rem", fontWeight: "bold", marginBottom: "25px", lineHeight: "1.5" }}>
              『{playerName.trim() === "" ? "名無しのゲッサー" : playerName}』で登録します。<br/>間違いありませんか？
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "15px" }}>
              <button 
                onClick={() => { setIsRegisterConfirmOpen(false); handleRegister(); }} 
                style={{ ...btnStyle, flex: 1, backgroundColor: "#4caf50", color: "white", border: "none" }}
              >
                はい
              </button>
              <button 
                onClick={() => setIsRegisterConfirmOpen(false)} 
                style={{ ...btnStyle, flex: 1, backgroundColor: "#e0e0e0", color: "#333", border: "none" }}
              >
                いいえ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 登録せずに終了（破棄）確認ダイアログ */}
      {isDiscardConfirmOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1002 }}>
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", textAlign: "center", width: "400px", boxShadow: "0 4px 15px rgba(0,0,0,0.3)" }}>
            <p style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "25px", lineHeight: "1.5" }}>
              今回のプレイ記録は保存されませんが、<br/>問題ありませんか？
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "15px" }}>
              <button 
                onClick={() => navigate('/')} 
                style={{ ...btnStyle, flex: 1, backgroundColor: "#ff5252", color: "white", border: "none" }}
              >
                はい
              </button>
              <button 
                onClick={() => setIsDiscardConfirmOpen(false)} 
                style={{ ...btnStyle, flex: 1, backgroundColor: "#e0e0e0", color: "#333", border: "none" }}
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