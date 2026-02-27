import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase-oauth/supabase";
import type { Session } from "@supabase/supabase-js";
import { Link } from "react-router-dom";
import { Header } from "../index"; 

function Account() {
  const [session, setSession] = useState<Session | null>(null);

  const [nameInput, setNameInput] = useState<string>("");
  const [profileName, setProfileName] = useState<string>("");

  // UI用（DB側制限が本命だけど、UXとして残してOK）
  const [cooldown, setCooldown] = useState<number>(0);

  const [saving, setSaving] = useState<boolean>(false);
  const [loadingName, setLoadingName] = useState<boolean>(false);
  const [nameError, setNameError] = useState<string | null>(null);


  // セッション取得 + 監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // クールダウンカウント（UI用）
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  // DBから名前取得
  useEffect(() => {
    const fetchName = async () => {
      if (!session?.user?.id) return;

      setLoadingName(true);
      setNameError(null);

      const { data, error, status } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", session.user.id)
        .maybeSingle(); // ★行が無い可能性に備える

      console.log("fetchName:", { status, data, error });

      if (error) {
        setNameError(error.message);
        setProfileName("");
        setNameInput("");
      } else {
        const n = data?.name ?? "";
        setProfileName(n);
        setNameInput(n);
      }

      setLoadingName(false);
    };

    fetchName();
  }, [session?.user?.id]);



  const errorMessage = (msg: string) => {
    // 10秒制限（RLS）に引っかかったときのメッセージを置換
    if (msg.includes('row-level security policy') && msg.includes('USING expression')) {
      return '変更が早すぎます。10秒ほど待ってからもう一度押してください。';
    }
    return '保存に失敗しました。もう一度お試しください。';
  };
  // 保存（upsert：無ければ作る、あれば更新）
  const saveName = async () => {
    if (!session?.user?.id) return;
    if (cooldown > 0) return; // 連打防止（UI用。DB側制限が本命）

    setSaving(true);
    setNameError(null);

    const { data, error, status } = await supabase
      .from("profiles")
      .upsert(
        { id: session.user.id, name: nameInput }, // ★ id 必須
        { onConflict: "id" }
      )
      .select("id, name, updated_at")
      .single(); // ★1行返る想定（id=PKなので）

    console.log("saveName(upsert):", { status, data, error });

    if (error) {
      console.log("raw error:", error); 
      setNameError(errorMessage(error.message));
      setSaving(false);
      return;
    }

    // DBの値で反映
    setProfileName(data.name ?? "");
    setCooldown(10); // 10秒スタート（UI用）
    setSaving(false);
  };

  const renderName = () => {
    if (loadingName) return "名前取得中...";
    return profileName || "(未設定)";
  };


  const logout = async () => {
    await supabase.auth.signOut();
  };
  

  return (
    <div style={{ padding: 24 }} className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover">
      <Header backTo="/mainpage"></Header>
      {!session ? (
        <div className="w-2/3 mx-auto bg-white/80 backdrop-blur border-b border-gray-200 p-20">
          <div className="flex mx-auto max-w-5xl items-center justify-between px-6 py-4">
            <p className="text-xl ">
              未ログインです
            </p>
            <Link to="/login" className="rounded-xl px-3 py-2 text-xl font-medium text-gray-700 hover:bg-gray-100 active:scale-75 hover:shadow-sm transition">
              ログインへ
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="w-2/3 mx-auto bg-white/80 backdrop-blur border-b border-gray-200 p-20">
            <div className="flex mx-auto max-w-5xl items-center justify-between px-6 py-4">
              <div className="relative flex flex-col gap-3">
                <img
                  className="border-2 border-black rounded-xl"
                  src={session.user.user_metadata?.avatar_url}
                  alt="avatar"
                />
                <p className="mt-3 text-sm text-gray-600">
                  {session.user.email}
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 ">
                <p className="text-xl">現在のユーザー名: {renderName()}</p>

                <div className="flex items-center gap-2">
                  <input
                    className="border border-gray-300 rounded px-3 py-2"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="名前を入力"
                  />

                  <button
                    className="rounded px-4 py-2 bg-gray-800 text-white disabled:opacity-50 hover:bg-gray-900 active:scale-75 transition shadow-sm hover:shadow-lg"
                    onClick={saveName}
                    disabled={saving || cooldown > 0}
                  >
                    {cooldown > 0 ? `あと ${cooldown} 秒` : saving ? "保存中..." : "変更"}
                  </button>
                </div>

                {nameError && <p className="text-red-600 text-sm">{nameError}</p>}
              </div>
              <button
                className="inline-flex items-center rounded-xl px-4 py-2 text-xl font-medium bg-gray-800 text-white hover:bg-gray-900 active:scale-75 transition shadow-sm hover:shadow-lg"
                onClick={logout}
              >
                ログアウト
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Account;