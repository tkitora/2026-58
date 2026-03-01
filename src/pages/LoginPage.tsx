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
    <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-cover px-3 sm:px-6 py-6 flex flex-col">
      <Header backTo="/account" />

      {/* Headerの下を中央寄せ */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-3xl bg-white/80 backdrop-blur border-b border-gray-200 rounded-2xl p-5 sm:p-10 md:p-14 lg:p-20">
          <div className="flex items-center justify-center py-4">
            <button
              className="w-full sm:w-auto rounded-xl px-4 sm:px-6 py-3 text-base sm:text-xl font-medium text-gray-700 bg-white/60 hover:bg-gray-100 active:scale-95 hover:shadow-sm transition"
              onClick={signInWithGoogle}
            >
              Googleでログイン
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;