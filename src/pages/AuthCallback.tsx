import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase-oauth/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const run = async () => {
      try {
        const url = window.location.href;

        // 1) PKCE（?code=...）ならセッション交換
        if (url.includes("?code=")) {
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) throw error;
        }

        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;

        const user = data.user;
        if (!user) {
          navigate("/login", { replace: true });
          return;
        }

        // 2) Google等のプロバイダから取れるアイコンURL
        // (supabaseは providerごとにuser_metadataのキーが違うことがあるので候補を広く拾う)
        const meta = user.user_metadata as any;
        const providerAvatarUrl: string | null =
          meta?.avatar_url ??
          meta?.picture ??
          meta?.image_url ??
          meta?.profile_picture ??
          null;

        // 3) 既存profilesを確認
        const { data: existing, error: selErr } = await supabase
          .from("profiles")
          .select("id, name, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (selErr) throw selErr;

        if (!existing) {
          // 初回: INSERT（10秒制限に引っかからない）
          const { error: insErr } = await supabase.from("profiles").insert({
            id: user.id,
            name: meta?.full_name ?? meta?.name ?? "名無しのゲッサ―",
            avatar_url: providerAvatarUrl, // ここで保存
          });
          if (insErr) throw insErr;
        } else {
          // 2回目以降: 既にavatar_urlがあるなら触らない（10秒制限＆ユーザーが変えた場合の上書き防止）
          // avatar_urlが空で、providerから取れた時だけ埋める
          if (!existing.avatar_url && providerAvatarUrl) {
            const { error: updErr } = await supabase
              .from("profiles")
              .update({ avatar_url: providerAvatarUrl })
              .eq("id", user.id);
            if (updErr) throw updErr;
          }
        }

        navigate("/account", { replace: true });
      } catch (e) {
        console.error("AuthCallback error:", e);
        navigate("/login", { replace: true });
      }
    };

    run();
  }, [navigate]);

  return (
    <div
      style={{ padding: 24 }}
      className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover"
    >
      <div className="w-full bg-white/80 backdrop-blur border-b border-gray-200 p-20">
        <div className="flex mx-auto max-w-5xl items-center justify-between px-6 py-4">
          Signing in...
        </div>
      </div>
    </div>
  );
}