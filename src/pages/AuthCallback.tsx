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

        const { error: upsertError } = await supabase.from("profiles").upsert({
          id: user.id,
          name: "名無しのゲッサ―"
        });

        if (upsertError) throw upsertError;

        navigate("/account", { replace: true });
      } catch (e) {
        console.error("AuthCallback error:", e);
        navigate("/login", { replace: true });
      }
    };

    run();
  }, [navigate]);

  return <div style={{ padding: 24 }}>Signing in...</div>;
}