import { supabase } from "../lib/supabase-oauth/supabase";

function Login() {
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // ここが Supabase Dashboard の Redirect URLs に許可されている必要あり
        redirectTo: `${window.location.origin}/AuthCallback`,
      },
    });
    if (error) alert(error.message);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Login</h1>
      <button onClick={signInWithGoogle}>Googleでログイン</button>
    </div>
  );
}

export default Login;