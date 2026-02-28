// src/pages/SingleRank.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Header } from "../index";
import defaultIcon from "/src/assets/default_icon.png";
import type { Session } from "@supabase/supabase-js";

type RankData = {
  id: number;
  player_name: string;
  score: number;
  created_at: string;
  user_id: string | null; // ★追加
};

const ITEMS_PER_PAGE = 20;

function SingleRank() {
  const navigate = useNavigate();

  const [rankings, setRankings] = useState<RankData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // ★ログイン情報＆自分のアイコン
  const [session, setSession] = useState<Session | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string>("");

  useEffect(() => {
    // セッション取得＆監視
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchAll() {
      setIsLoading(true);

      // 1) 自分のアイコン（ログインしている場合だけ）
      if (session?.user?.id) {
        const { data: prof, error: pErr } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!pErr) {
          setMyAvatarUrl(prof?.avatar_url ?? "");
        } else {
          console.warn("fetch my avatar error:", pErr.message);
          setMyAvatarUrl("");
        }
      } else {
        setMyAvatarUrl("");
      }

      // 2) ランキング取得
      const { data, error } = await supabase
        .from("single_ranking")
        .select("*")
        .order("score", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) {
        console.error("ランキングの取得に失敗しました:", error.message);
        setRankings([]);
      } else {
        setRankings((data || []) as RankData[]);
      }

      setIsLoading(false);
    }

    fetchAll();
  }, [session?.user?.id]);

  const totalPages = Math.ceil(rankings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = rankings.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
      d.getDate()
    ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // ★その行で表示すべきアイコンURLを決める
  const getIconForRow = (row: RankData) => {
    // 未ログインは全部デフォルト
    if (!session?.user?.id) return defaultIcon;

    // ログイン済み：自分の行だけ自分のアイコン（最新）
    if (row.user_id && row.user_id === session.user.id && myAvatarUrl) return myAvatarUrl;

    return defaultIcon;
  };

  return (
    <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover py-6 px-5">
      <div className="w-2/3 mx-auto rounded-xl border-2 border-black bg-white/80 backdrop-blur p-2">
        <Header backTo="/mainpage" />
        <h1 className="text-3xl font-bold text-center py-4">🏆 ランキング 🏆</h1>

        {isLoading ? (
          <div className="text-center text-lg mt-12">読み込み中...</div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.1)] overflow-hidden">
              <table className="w-full border-collapse text-center">
                <thead className="bg-amber-500 text-white">
                  <tr>
                    <th className="py-4 px-4 w-[45%] text-lg">プレイヤー名</th>
                    <th className="py-4 px-4 w-[25%] text-lg">スコア</th>
                    <th className="py-4 px-4 w-[30%] text-lg">達成日時</th>
                  </tr>
                </thead>

                <tbody>
                  {currentItems.length > 0 ? (
                    currentItems.map((item, index) => (
                      <tr
                        key={item.id}
                        className={`border-b border-gray-200 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                      >
                        <td className="py-4 px-4 font-bold text-gray-600 text-lg">
                          <div className="flex items-center justify-center gap-3">
                            <img
                              src={getIconForRow(item)}
                              alt="icon"
                              className="w-10 h-10 rounded-full border border-gray-300 object-cover bg-white"
                            />
                            <span>{item.player_name}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4 font-bold text-pink-600 text-lg">
                          {item.score}問 / 20問
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-500">{formatDate(item.created_at)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-8 px-4 text-gray-500 text-lg">
                        まだデータがありません。一番乗りを目指そう！
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  const isActive = currentPage === pageNum;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={[
                        "px-4 py-2 rounded-md border font-bold transition",
                        isActive
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100",
                      ].join(" ")}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SingleRank;