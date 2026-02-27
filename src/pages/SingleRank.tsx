// src/pages/SingleRank.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

// データベースから取得するデータの型定義
type RankData = {
  id: number;
  player_name: string;
  score: number;
  created_at: string;
};

const ITEMS_PER_PAGE = 20; // 1ページあたりの表示件数

function SingleRank() {
  const navigate = useNavigate();
  const [rankings, setRankings] = useState<RankData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // 初回表示時にSupabaseからデータを取得する
  useEffect(() => {
    async function fetchRankings() {
      setIsLoading(true);
      
      // scoreは高い順(降順)、created_atは古い順(昇順: 先に取った人が上)で取得
      const { data, error } = await supabase
        .from("single_ranking")
        .select("*")
        .order("score", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) {
        console.error("ランキングの取得に失敗しました:", error.message);
      } else {
        setRankings(data || []);
      }
      
      setIsLoading(false);
    }

    fetchRankings();
  }, []);

  // ページネーション用の計算
  const totalPages = Math.ceil(rankings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  // 現在のページに表示する20件だけを切り出す
  const currentItems = rankings.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // 日付を見やすくフォーマットする関数
  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px", position: "relative" }}>
      
      {/* 左上の戻るボタン */}
      <button 
        onClick={() => navigate("/Single")}
        style={{ 
          position: "absolute", top: "20px", left: "20px", 
          padding: "10px 20px", borderRadius: "8px", border: "1px solid #ccc", 
          backgroundColor: "#f9f9f9", cursor: "pointer", fontWeight: "bold" 
        }}
      >
         戻る 
      </button>

      <h1 style={{ textAlign: "center", marginBottom: "30px", color: "#333" }}>🏆 ランキング 🏆</h1>

      {isLoading ? (
        <div style={{ textAlign: "center", fontSize: "1.2rem", marginTop: "50px" }}>読み込み中...</div>
      ) : (
        <>
          {/* ランキング表 */}
          {/* ランキング表 */}
          <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: "0 4px 10px rgba(0,0,0,0.1)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
              <thead style={{ backgroundColor: "#ffb300", color: "white" }}>
                <tr>
                  {/* 順位列を消して、3列のバランスを調整したわ */}
                  <th style={{ padding: "15px", width: "45%", fontSize: "1.1rem" }}>プレイヤー名</th>
                  <th style={{ padding: "15px", width: "25%", fontSize: "1.1rem" }}>スコア</th>
                  <th style={{ padding: "15px", width: "30%", fontSize: "1.1rem" }}>達成日時</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? (
                  currentItems.map((item, index) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #eee", backgroundColor: index % 2 === 0 ? "#fff" : "#fafafa" }}>
                      {/* メダルや順位の表示をなくし、名前とスコアを少し大きくして目立たせたわ */}
                      <td style={{ padding: "15px", fontWeight: "bold", color: "#555", fontSize: "1.1rem" }}>
                        {item.player_name}
                      </td>
                      <td style={{ padding: "15px", fontWeight: "bold", color: "#e91e63", fontSize: "1.1rem" }}>
                        {item.score}問 / 20問
                      </td>
                      <td style={{ padding: "15px", fontSize: "0.95rem", color: "#888" }}>
                        {formatDate(item.created_at)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    {/* 列が3つになったから、colSpanも4から3に変更しているわよ */}
                    <td colSpan={3} style={{ padding: "30px", color: "#888", fontSize: "1.1rem" }}>
                      まだデータがありません。一番乗りを目指そう！
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ページネーション（ボタン切り替え） */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "20px" }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  style={{
                    padding: "8px 15px",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                    backgroundColor: currentPage === pageNum ? "#ffb300" : "#fff",
                    color: currentPage === pageNum ? "#fff" : "#333",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  {pageNum}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SingleRank;