import { supabase } from "../lib/supabase-oauth/supabase";
import { Header } from '../index';

function Login() {
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // ここが Supabase Dashboard の Redirect URLs に許可されている必要あり
        redirectTo: `${window.location.origin}/authCallback`,
      },
    });
    if (error) alert(error.message);
  };

  return (
    <div style={{ padding: 24 }} className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover">
      <Header backTo="/account"></Header>
      <div className="w-2/3 bg-white/80 backdrop-blur mx-auto border-b border-gray-200 p-20">
        <div className="flex mx-auto max-w-5xl items-center justify-between px-6 py-4">
          <button className="rounded-xl px-3 py-2 m-auto text-xl font-medium text-gray-700 hover:bg-gray-100 active:scale-75 hover:shadow-sm transition" onClick={signInWithGoogle}>
            Googleでログイン
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;