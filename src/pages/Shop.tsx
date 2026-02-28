import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase-oauth/supabase";
import type { Session } from "@supabase/supabase-js";
import { Header } from "../index";

function SingleGame_rank() {
  const [session, setSession] = useState<Session | null>(null);
  const [bonusMessage, setBonusMessage] = useState<string | null>(null);

  // セッション取得
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => sub.subscription.unsubscribe();
  }, []);

  // 🎁 デイリーボーナス処理
  const giveDailyBonusIfNeeded = async () => {
    if (!session?.user?.id) return;

    const userId = session.user.id;

    // ① 現在の daily と points を取得
    const { data, error } = await supabase
      .from("profiles")
      .select("daily, points")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("daily fetch error:", error);
      return;
    }

    if (!data) return;

    // ② すでにtrueなら何もしない
    if (data.daily === true) return;

    // ③ falseなら更新
    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        daily: true,
        points: (data.points ?? 0) + 10,
      })
      .eq("id", userId);

    if (updErr) {
      console.error("daily bonus update error:", updErr);
      return;
    }

    setBonusMessage("🎉 デイリーボーナス +10 ポイント獲得！");
  };

  // セッション確定後に1回だけ実行
  useEffect(() => {
    if (!session?.user?.id) return;
    giveDailyBonusIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  return (
    <div
      style={{ padding: 24 }}
      className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover"
    >
      <Header backTo="/mainpage" />

      <div className="w-2/3 mx-auto bg-white/80 backdrop-blur border-b border-gray-200 p-10">
        <div className="mx-auto max-w-5xl px-6 py-4 flex flex-col gap-6">
          <h1 className="text-3xl font-bold text-center">ランキング結果</h1>

          {/* 🎁 ボーナスメッセージ */}
          {bonusMessage && (
            <div className="text-center text-green-700 font-semibold text-lg">
              {bonusMessage}
            </div>
          )}

          {/* ここにランキング表示UIを追加 */}
          <div className="text-center text-gray-700">
            ランキング情報表示エリア
          </div>
        </div>
      </div>
    </div>
  );
}

export default SingleGame_rank;