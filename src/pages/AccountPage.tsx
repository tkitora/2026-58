import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase-oauth/supabase";
import type { Session } from "@supabase/supabase-js";
import { Link } from "react-router-dom";

function Account() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  
  

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Home</h1>

      {!session ? (
        <p>
          未ログインです。<Link to="/login">ログインへ</Link>
        </p>
      ) : (
        <>
          <p>ログイン中: {session.user.email}</p>
          <p>ID: {session.user.id}</p>
          <p>名前: {session.user.user_metadata?.full_name}</p>
          <img src={session.user.user_metadata?.avatar_url}></img>
          <button onClick={logout}>ログアウト</button>
        </>
      )}
    </div>
  );
}

export default Account;