import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase-oauth/supabase";

type TitleData = {
  name: string;
  description: string;
};

type PlayerResult = {
  playerid: string;
  name: string;
  join_at: string;
  score: number;        
  totalCount: number;   
  naraCount: number;    
  naraCorrect: number;  
  douCount: number;     
  douCorrect: number;   
  maxCorrectKeep: number; 
};

export default function MultiResult() {
  const navigate = useNavigate();
  const roomId = sessionStorage.getItem("roomid");
  const playerId = sessionStorage.getItem("playerid");

  const [ranking, setRanking] = useState<PlayerResult[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerResult | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!roomId || !playerId) {
      navigate("/multi");
      return;
    }

    const fetchResults = async () => {
      setIsLoading(true);
      
      const { data: roomData } = await supabase
        .from("room")
        .select("host_id, answers, amount")
        .eq("roomid", roomId)
        .single();

      if (!roomData) {
        navigate("/multi");
        return;
      }

      setIsHost(roomData.host_id === playerId);
      const correctAnswers: string[] = roomData.answers || [];
      const amount = roomData.amount || 0;

      const { data: playersData } = await supabase
        .from("players")
        .select("playerid, name, answers, join_at")
        .eq("roomid", roomId);

      if (!playersData) return;

      const results: PlayerResult[] = playersData.map((p) => {
        let score = 0;
        let naraCount = 0;
        let naraCorrect = 0;
        let douCount = 0;
        let douCorrect = 0;
        let currentKeep = 0;
        let maxKeep = 0;

        const pAnswers: number[] = p.answers || [];

        correctAnswers.forEach((correctStr, idx) => {
          if (correctStr === "奈良県") naraCount++;
          if (correctStr === "北海道") douCount++;

          const ansNum = pAnswers[idx];
          let pAnsStr = "未回答";
          if (ansNum === 0) pAnsStr = "奈良県";
          if (ansNum === 1) pAnsStr = "北海道";
          if (ansNum === 2) pAnsStr = "OTHER";

          if (pAnsStr === correctStr) {
            score++;
            currentKeep++;
            maxKeep = Math.max(maxKeep, currentKeep);
            if (correctStr === "奈良県") naraCorrect++;
            if (correctStr === "北海道") douCorrect++;
          } else {
            currentKeep = 0; 
          }
        });

        return {
          playerid: p.playerid,
          name: p.name,
          join_at: p.join_at,
          score,
          totalCount: amount,
          naraCount,
          naraCorrect,
          douCount,
          douCorrect,
          maxCorrectKeep: maxKeep,
        };
      });

      results.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return new Date(a.join_at).getTime() - new Date(b.join_at).getTime();
      });

      setRanking(results);
      setIsLoading(false);
    };

    fetchResults();
  }, [navigate, roomId, playerId]);

  const getTitles = (p: PlayerResult): TitleData[] => {
    const earnedTitles: TitleData[] = [];
    if (p.totalCount === 0) return earnedTitles;

    const totalRate = p.score / p.totalCount;
    const naraRate = p.naraCount > 0 ? p.naraCorrect / p.naraCount : 0;
    const douRate = p.douCount > 0 ? p.douCorrect / p.douCount : 0;

    if (douRate >= 0.8 && p.douCount > 0) earnedTitles.push({ name: "道民", description: "北海道の問題を8割以上正解。" });
    if (p.douCount > 0 && douRate === 1 && p.naraCount > 0 && douRate > naraRate)
      earnedTitles.push({ name: "生粋の道民", description: "北海道の問題に全問正解し、奈良よりも北海道の正答率が高い。" });
    if (naraRate >= 0.8 && p.naraCount > 0) earnedTitles.push({ name: "奈良県民", description: "奈良県の問題を8割以上正解。" });
    if (p.naraCount >= 5 && naraRate === 1)
      earnedTitles.push({ name: "生粋の奈良県民", description: "奈良の問題に5問以上回答し、全問正解。鹿と山はトモダチ。" });
    if (p.totalCount >= 20 && totalRate >= 0.9)
      earnedTitles.push({ name: "マスター旅人", description: "全体の正答率90%以上。地理マスター。" });
    if (p.totalCount >= 20 && totalRate >= 0.75)
      earnedTitles.push({ name: "凄腕の旅人", description: "全体の正答率75%以上。地理に詳しい。" });
    if (p.maxCorrectKeep >= 10)
      earnedTitles.push({ name: "ゾーン突入", description: "10問以上連続で正解した。今のあなたには全てが見えている。" });
    if (earnedTitles.length === 0 && totalRate < 0.5)
      earnedTitles.push({ name: "迷子の旅人", description: "正答率が50%未満。少し方向音痴かも…？" });
    if (earnedTitles.length === 0)
      earnedTitles.push({ name: "駆け出しゲッサー", description: "正答率50%以上の標準的な旅人。これからもっと伸びるはず！" });

    return earnedTitles;
  };

  const handleReturnToRoom = async () => {
    if (isHost && roomId) {
      await supabase.from("room").update({ stats: "waiting", now: 1, answers: [] }).eq("roomid", roomId);
    }
    navigate("/multiroom");
  };

  const handleReturnToHome = async () => {
    if (playerId) {
      await supabase.from("players").update({ stats: "left", roomid: null }).eq("playerid", playerId);
      if (isHost && roomId) {
        await supabase.from("room").update({ stats: "deleted" }).eq("roomid", roomId);
      }
    }
    navigate("/mainpage");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover flex justify-center items-center">
        <div className="text-3xl font-bold text-white bg-black/50 px-8 py-4 rounded-xl">結果を集計中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover py-10 px-5 flex flex-col items-center">
      
      <div className="bg-white/95 backdrop-blur border-2 border-black rounded-xl w-[95%] sm:w-4/5 md:w-2/3 max-w-3xl overflow-hidden shadow-lg flex flex-col max-h-[80vh]">
        <div className="py-4 text-center border-b border-gray-300">
          <h2 className="text-3xl font-bold text-gray-800">🏆 ランキング 🏆</h2>
          <p className="text-sm text-gray-500 mt-1">プレイヤー名をクリックして詳細を見る</p>
        </div>

        <div className="flex text-lg font-bold bg-amber-500 text-white py-3 px-6">
          <div className="flex-[2] text-center">プレイヤー名</div>
          <div className="flex-1 text-center">スコア</div>
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {ranking.map((p, idx) => {
            const isMe = p.playerid === playerId;
            return (
              <div
                key={p.playerid}
                onClick={() => setSelectedPlayer(p)}
                className={`flex items-center text-lg py-4 px-6 border-b border-gray-200 cursor-pointer transition ${
                  isMe ? "bg-amber-100 hover:bg-amber-200" : "hover:bg-amber-50"
                }`}
              >
                {/* ★名前部分のホバー演出と「あなた」バッジ */}
                <div className="flex-[2] font-bold text-gray-800 text-left truncate pr-4 group">
                  <span className="mr-2">{idx + 1}位.</span>
                  <span className="group-hover:text-amber-600 group-hover:underline transition decoration-amber-600 underline-offset-4">
                    {p.name}
                  </span>
                  {isMe && (
                    <span className="ml-3 text-sm font-bold text-amber-800 bg-amber-300 px-3 py-1 rounded-full shadow-sm">
                      あなた
                    </span>
                  )}
                </div>
                <div className="flex-1 font-bold text-pink-600 text-center">
                  {p.score}問 <span className="text-gray-500 text-sm">/ {p.totalCount}問</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-4 w-[95%] sm:w-4/5 md:w-2/3 max-w-3xl justify-center">
        <button
          onClick={handleReturnToRoom}
          className="flex-1 py-3 rounded-lg font-bold text-lg text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition shadow-md"
        >
          部屋に戻る
        </button>
        <button
          onClick={handleReturnToHome}
          className="flex-1 py-3 rounded-lg font-bold text-lg text-white bg-red-500 hover:bg-red-600 active:scale-95 transition shadow-md"
        >
          ホームに戻る
        </button>
      </div>

      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[1000]" onClick={() => setSelectedPlayer(null)}>
          <div
            className="relative bg-white p-8 rounded-xl w-[95%] max-w-lg text-center shadow-[0_4px_15px_rgba(0,0,0,0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-6 text-gray-800">{selectedPlayer.name} の回答状況</h2>

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
                  <td className="border-b border-gray-200 py-3">{selectedPlayer.totalCount}</td>
                  <td className="border-b border-gray-200 py-3 font-bold text-pink-600">{selectedPlayer.score}</td>
                </tr>
                <tr>
                  <td className="border-b border-gray-200 py-3 font-bold">奈良</td>
                  <td className="border-b border-gray-200 py-3">{selectedPlayer.naraCount}</td>
                  <td className="border-b border-gray-200 py-3 font-bold text-pink-600">{selectedPlayer.naraCorrect}</td>
                </tr>
                <tr>
                  <td className="border-b border-gray-200 py-3 font-bold">北海道</td>
                  <td className="border-b border-gray-200 py-3">{selectedPlayer.douCount}</td>
                  <td className="border-b border-gray-200 py-3 font-bold text-pink-600">{selectedPlayer.douCorrect}</td>
                </tr>
              </tbody>
            </table>

            <div className="my-5 p-5 bg-amber-50 rounded-lg border-2 border-amber-300 text-left">
              <h3 className="text-lg font-bold text-center mb-4">獲得した称号</h3>
              <div className="flex flex-col gap-3 mb-2">
                {getTitles(selectedPlayer).length > 0 ? (
                  getTitles(selectedPlayer).map((title, index) => (
                    <details key={index} className="bg-white p-3 rounded-md border border-amber-300 cursor-pointer">
                      <summary className="text-lg font-bold text-orange-700 outline-none">
                        🏆 {title.name}
                      </summary>
                      <p className="mt-2 text-sm text-gray-700 pl-6">{title.description}</p>
                    </details>
                  ))
                ) : (
                  <p className="text-center text-gray-500 font-bold py-2">獲得した称号はありませんでした</p>
                )}
              </div>
            </div>

            <div className="text-center mt-6">
              <button
                onClick={() => setSelectedPlayer(null)}
                className="w-[200px] py-3 rounded-lg font-bold text-white bg-gray-500 hover:bg-gray-600 active:scale-95 transition text-lg"
              >
                リザルト一覧に戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}