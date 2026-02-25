import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase-oauth/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictModeの2回実行対策
    ran.current = true;

    (async () => {
      const url = window.location.href;

      // ✅ PKCE（?code=...）のときだけ交換する
      if (url.includes("?code=")) {
        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) {
          console.error("exchangeCodeForSession error:", error);
          navigate("/login", { replace: true });
          return;
        }
        navigate("/", { replace: true });
        return;
      }

      // ✅ #access_token=...（Implicit）なら交換しない。セッションが入ってるか確認する
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error("getSession error:", error);

      if (data.session) {
        navigate("/mainpage", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate]);

  return <div style={{ padding: 24 }}>Signing in...</div>;
}