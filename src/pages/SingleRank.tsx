// src/pages/SingleRank.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Header } from "../index";
import defaultIcon from "/src/assets/default_icon.png";

// データベースから取得するデータの型定義
type RankData = {
  id: number;
  player_name: string;
  score: number;
  created_at: string;
  user_id: string | null; // ★追加
};

type PublicProfile = {
  id: string;
  avatar_url: string | null;
};

const ITEMS_PER_PAGE = 20; // 1ページあたりの表示件数

function SingleRank() {
  const [rankings, setRankings] = useState<RankData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // ★ user_id -> avatar_url の辞書
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});

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
        setRankings([]);
      } else {
        setRankings((data || []) as RankData[]);
      }

      setIsLoading(false);
    }

    fetchRankings();
  }, []);

  // ページネーション用の計算
  const totalPages = Math.ceil(rankings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = rankings.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // ★ 現在ページに表示される user_id だけ拾う（null除外＆重複除外）
  const pageUserIds = useMemo(() => {
    const ids = currentItems.map((x) => x.user_id).filter((x): x is string => !!x);
    return Array.from(new Set(ids));
  }, [currentItems]);

  // ★ 現在ページの user_id 群のアイコンを public_profiles からまとめて取得
  useEffect(() => {
    async function fetchAvatarsForPage() {
      if (pageUserIds.length === 0) return;

      // 既に持っているIDは除外（無駄な通信を減らす）
      const missing = pageUserIds.filter((id) => !avatarMap[id]);
      if (missing.length === 0) return;

      const { data, error } = await supabase
        .from("public_profiles")
        .select("id, avatar_url")
        .in("id", missing);

      if (error) {
        console.error("public_profiles の取得に失敗しました:", error.message);
        return;
      }

      const next: Record<string, string> = {};
      (data as PublicProfile[]).forEach((p) => {
        if (p.id && p.avatar_url) next[p.id] = p.avatar_url;
      });

      setAvatarMap((prev) => ({ ...prev, ...next }));
    }

    fetchAvatarsForPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageUserIds]);

  // 日付を見やすくフォーマットする関数
  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(
      2,
      "0"
    )} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // ★ 行ごとの表示アイコン
  const iconForRow = (row: RankData) => {
    if (!row.user_id) return defaultIcon;
    return avatarMap[row.user_id] || defaultIcon;
  };

  return (
    <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-cover py-6 px-3 sm:px-6">
      {/* 外枠：w-2/3 をやめて max-w で統一 */}
      <div className="w-full max-w-5xl mx-auto rounded-xl border-2 border-black bg-white/80 backdrop-blur p-3 sm:p-4">
        <Header backTo="/mainpage" />

        <h1 className="text-2xl sm:text-3xl font-bold text-center py-4">🏆 ランキング 🏆</h1>

        {isLoading ? (
          <div className="text-center text-base sm:text-lg mt-10 sm:mt-12">読み込み中...</div>
        ) : (
          <>
            {/* テーブル：スマホは横スクロール可にする */}
            <div className="bg-white rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.1)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-center">
                  <thead className="bg-amber-500 text-white">
                    <tr>
                      <th className="py-3 sm:py-4 px-3 sm:px-4 w-[45%] text-base sm:text-lg">
                        プレイヤー名
                      </th>
                      <th className="py-3 sm:py-4 px-3 sm:px-4 w-[25%] text-base sm:text-lg">
                        スコア
                      </th>
                      <th className="py-3 sm:py-4 px-3 sm:px-4 w-[30%] text-base sm:text-lg">
                        達成日時
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {currentItems.length > 0 ? (
                      currentItems.map((item, index) => (
                        <tr
                          key={item.id}
                          className={`border-b border-gray-200 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"
                            }`}
                        >
                          <td className="py-3 sm:py-4 px-3 sm:px-4 font-bold text-gray-600 text-base sm:text-lg">
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={iconForRow(item)}
                                alt="icon"
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-gray-300 object-cover bg-white flex-none"
                              />
                              <span className="block w-full min-w-0 truncate text-left">
                                {item.player_name}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 sm:py-4 px-3 sm:px-4 font-bold text-pink-600 text-base sm:text-lg">
                            {item.score}問 / 20問
                          </td>

                          <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                            {formatDate(item.created_at)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-8 px-4 text-gray-500 text-base sm:text-lg">
                          まだデータがありません。一番乗りを目指そう！
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ページネーション：スマホで折り返し */}
            {totalPages > 1 && (
              <div className="flex flex-wrap justify-center gap-2 mt-5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  const isActive = currentPage === pageNum;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={[
                        "px-3 sm:px-4 py-2 rounded-md border font-bold transition text-sm sm:text-base",
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