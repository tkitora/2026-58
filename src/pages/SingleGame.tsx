import { use, useEffect, useRef, useState } from "react";
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
    if (douRate === 1){
      earnedTitles.push({
        name: "道民",
        description: "北海道の問題を全問正解。。"
      });
    }

    if (DOUCount > 0 && NARACount > 0 && douRate > naraRate) {
      earnedTitles.push({
        name: "生粋の道民",
        description: "北海道の問題に専門正解し、奈良よりも北海道の正答率が高い。"
      });
    }

    // 2. 奈良県民判定
    if (naraRate === 1){
      earnedTitles.push({
        name: "奈良県民",
        description: "奈良県の問題を全問正解。"
      });
    }

    if (NARACount >= 5 && naraRate === 1) {
      earnedTitles.push({
        name: "生粋の奈良県民",
        description: "奈良の問題に5問以上回答し、全問正解。鹿と山はトモダチ。"
      });
    }

    // 3. 凄腕判定
    if (TotalCount >= 30 && totalRate >= 0.9) {
      earnedTitles.push({
        name: "マスター旅人",
        description: "30問以上遊んで、全体の正答率90%以上。地理マスター。"
      });
    }
    if (TotalCount >= 20 && totalRate >= 0.8) {
      earnedTitles.push({
        name: "凄腕の旅人",
        description: "20問以上遊んで、全体の正答率80%以上。地理に詳しい。"
      });
    }

    // 4. 連勝判定（CorrectKeepの変数を使ってみるわ）
    if (MaxCorrectKeep >= 10) {
      earnedTitles.push({
        name: "ゾーン突入",
        description: "10問以上連続で正解した。今のあなたには全てが見えている。"
      });
    }

    // 5. 迷子判定（どれにも当てはまらず、正答率が低い場合）
    if (earnedTitles.length === 0 && totalRate < 0.5) {
      earnedTitles.push({
        name: "迷子の旅人",
        description: "正答率が50%未満。少し方向音痴かも…？"
      });
    }

    // 6. 普通判定（どれにも当てはまらない場合）
    if (earnedTitles.length === 0) {
      earnedTitles.push({
        name: "駆け出しゲッサー",
        description: "正答率50%以上の標準的な旅人。これからもっと伸びるはず！"
      });
    }

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
    <div style={{ maxWidth: "1500px", margin: "0 auto", padding: "20px" }}>
      
      {/* 上部の問題数とボタン */}
      <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ fontSize: "2rem", fontWeight: "bold" }}>
          現在 {CurrentNumber} 問目
        </div>
        <button 
          onClick={() => setIsStatsOpen(true)}
          style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #ccc", backgroundColor: "#f9f9f9", cursor: "pointer", fontSize: "0.9rem", fontWeight: "bold", position: "absolute", right: 0 }}
        >
          現在の回答状況
        </button>
      </div>

      {/* メインのゲーム画面 */}
      <div id="mainDiv" style={{ width: "100%", margin: "0 auto" }}>
        
        {/* ストリートビューとロード画面を重ねるための親要素 */}
        <div style={{ position: "relative", width: "100%", height: "500px", borderRadius: "8px", overflow: "hidden", border: "1px solid #ddd" }}>
          
          {/* ストリートビュー本体 */}
          <div id="pano" ref={panoRef} style={{ width: "100%", height: "100%" }} />
          
          {/* ロード中のみ被せる黒い半透明の画面 */}
          {isLoading && (
            <div style={{
              position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
              backgroundColor: "rgba(0, 0, 0, 0.7)", 
              display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
              zIndex: 10, color: "white"
            }}>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "10px" }}>
                景色を探しています...
              </div>
            </div>
          )}
        </div>
        
        {/* 再読み込みボタンと、具体的なメッセージ */}
        <div style={{ textAlign: "right", marginTop: "8px" }}>
          <span style={{ fontSize: "0.8rem", color: "#666", marginRight: "10px" }}>
            ※10秒以上経っても景色が出ない場合は、再取得をお試しください。
          </span>
          <button 
            onClick={nextQuestion} 
            disabled={isLoading} // ロード中に何度も押されないように一応ロック
            style={{ padding: "4px 8px", fontSize: "0.8rem", borderRadius: "4px", border: "1px solid #aaa", backgroundColor: isLoading ? "#eee" : "#fff", cursor: isLoading ? "not-allowed" : "pointer" }}
          >
            ↻ 景色を再取得する
          </button>
        </div>
        
        {/* 回答エリア */}
        <div id="BtnDiv" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "20px", marginTop: "10px", minHeight: "50px" }}>
          <button onClick={() => submit("奈良県")} style={btnStyle} disabled={open}>なら！</button>
          <button onClick={() => submit("北海道")} style={btnStyle} disabled={open}>どう！</button>
          <button onClick={() => submit("OTHER")} style={btnStyle} disabled={open}>それ以外！</button>
        </div>
      </div>

      {/* 答え合わせダイアログ（ボタンを消してマップとリンクだけに） */}
      {open && result && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "15px", color: result.ok ? "#e91e63" : "#3f51b5" }}>
              {result.ok 
                ? (CorrectKeep >= 2 ? `${CorrectKeep}回連続正解！` : "正解！") 
                : "不正解…"}
            </div>

            <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#555", marginBottom: "15px" }}>
              ({question?.prefName})
            </div>
            
            {/* マップ部分（親要素がalignItems: "center"なので自動的に中央に寄る） */}
            <div id="answerMap" ref={answerMapRef} style={{ width: "600px", height: "450px", borderRadius: "8px", overflow: "hidden", border: "1px solid #ccc" }} />

            <div style={{ marginTop: "20px", textAlign: "center", display: "flex", flexDirection: "column", gap: "10px" }}>
              <a 
                href={`https://maps.google.com/maps?q=${result.correctLatLng.lat()},${result.correctLatLng.lng()}`} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ display: "inline-block", padding: "10px 20px", backgroundColor: "#4285F4", color: "white", textDecoration: "none", borderRadius: "8px", fontWeight: "bold" }}
              >
                Googleマップで見る
              </a>
              
              {/* マップの下に「次の問題へ」ボタンを配置*/}
              <button onClick={nextQuestion} style={{ ...btnStyle, width: "auto" }}>次の問題へ</button>
            </div>
          </div>
        </div>
      )}

{/* 回答状況ダイアログ */}
      {isStatsOpen && (
        <div 
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
          onClick={() => { 
            // 確認ダイアログが出ている時、または「ゲーム終了状態」の時は閉じないように条件を追加
            if (!isConfirmOpen && !isGameEnded) setIsStatsOpen(false); 
          }}
        >
          <div 
            style={{ position: "relative", backgroundColor: "white", padding: "40px", borderRadius: "12px", width: "500px", textAlign: "center", boxShadow: "0 4px 15px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()} 
          >
            
            {/* 閉じるボタン（ゲームが終了していない時だけ表示） */}
            {!isGameEnded && (
              <button 
                onClick={() => setIsStatsOpen(false)}
                style={{ position: "absolute", top: "-15px", right: "-15px", width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#333", color: "white", border: "none", cursor: "pointer", fontSize: "1.5rem", fontWeight: "bold", display: "flex", justifyContent: "center", alignItems: "center" }}
              >
                ×
              </button>
            )}

            <h2 style={{ fontSize: "1.8rem", marginBottom: "20px", color: "#333" }}>現在の回答状況</h2>
            

            {/* 表（テーブル）で区切って見やすく配置 */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "1.2rem", marginBottom: "30px" }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: "2px solid #ccc", padding: "10px", width: "34%" }}>区分</th>
                  <th style={{ borderBottom: "2px solid #ccc", padding: "10px", width: "33%" }}>出題数</th>
                  <th style={{ borderBottom: "2px solid #ccc", padding: "10px", width: "33%" }}>正解数</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ borderBottom: "1px solid #eee", padding: "15px", fontWeight: "bold" }}>全体</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "15px" }}>{TotalCount}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "15px", color: "#e91e63", fontWeight: "bold" }}>{TotalCorrect}</td>
                </tr>
                <tr>
                  <td style={{ borderBottom: "1px solid #eee", padding: "15px", fontWeight: "bold" }}>奈良</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "15px" }}>{NARACount}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "15px", color: "#e91e63", fontWeight: "bold" }}>{NARACorrect}</td>
                </tr>
                <tr>
                  <td style={{ borderBottom: "1px solid #eee", padding: "15px", fontWeight: "bold" }}>北海道</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "15px" }}>{DOUCount}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "15px", color: "#e91e63", fontWeight: "bold" }}>{DOUCorrect}</td>
                </tr>
              </tbody>
            </table>

            {/* 称号表示エリア */}
            {isGameEnded && (
              <div style={{ margin: "20px 0", padding: "20px", backgroundColor: "#fff8e1", borderRadius: "8px", border: "2px solid #ffca28", textAlign: "left" }}>
                <h3 style={{ margin: "0 0 15px 0", fontSize: "1.2rem", textAlign: "center" }}>獲得した称号</h3>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                  {/* getTitles()で取得した配列をループして表示 */}
                  {getTitles().map((title, index) => (
                    <details 
                      key={index} 
                      style={{ backgroundColor: "white", padding: "10px", borderRadius: "6px", border: "1px solid #ffd54f", cursor: "pointer" }}
                    >
                      {/* summary が常に表示されるタイトル部分 */}
                      <summary style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#d84315", outline: "none" }}>
                        🏆 {title.name}
                      </summary>
                      {/* 開いた時に表示される説明文 */}
                      <p style={{ margin: "10px 0 0 0", fontSize: "0.95rem", color: "#555", paddingLeft: "25px" }}>
                        {title.description}
                      </p>
                    </details>
                  ))}
                </div>

                <div style={{ textAlign: "center" }}>
                  <button 
                    onClick={() => navigate('/')} 
                    style={{ ...btnStyle, width: "200px", backgroundColor: "#ffb300", color: "#fff", border: "none" }}
                  >
                    ホームに戻る
                  </button>
                </div>
              </div>
            )}

            {/* 回答終了ボタン（目立つように赤っぽく） */}
            {!isGameEnded && (
              <div style={{ textAlign: "center", marginTop: "20px" }}>
                <button 
                  onClick={() => setIsConfirmOpen(true)}
                  style={{ ...btnStyle, width: "250px", backgroundColor: "#ff5252", color: "white", border: "none", fontSize: "1.1rem" }}
                >
                  回答を終了する
                </button>
                <p style={{ marginTop: "10px", fontSize: "1.2rem", color: "#666" }}>
                  ※終了時、結果に応じた称号が獲得できます
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 終了確認ダイアログ */}
      {isConfirmOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1001 }}>
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", textAlign: "center", width: "350px", boxShadow: "0 4px 15px rgba(0,0,0,0.3)" }}>
            <p style={{ fontSize: "1.3rem", fontWeight: "bold", marginBottom: "25px" }}>本当に回答を終了しますか？</p>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "15px" }}>
              {/* はい・いいえボタンも、しっかりとしたボタン風に装飾 */}
              <button 
                onClick={() => { setIsConfirmOpen(false); setIsGameEnded(true); }}
                style={{ ...btnStyle, flex: 1, backgroundColor: "#ff5252", color: "white", border: "none" }}
              >
                はい
              </button>
              <button 
                onClick={() => setIsConfirmOpen(false)}
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
export default SingleGame;