import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase-oauth/supabase";
import type { Session } from "@supabase/supabase-js";
import { Link } from "react-router-dom";
import { Header } from "../index";

function Account() {
  const [session, setSession] = useState<Session | null>(null);

  const [nameInput, setNameInput] = useState<string>("");
  const [profileName, setProfileName] = useState<string>("");

  // 追加：DBのアバターURL
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  // UI用（DB側制限が本命だけど、UXとして残してOK）
  const [cooldown, setCooldown] = useState<number>(0);

  const [saving, setSaving] = useState<boolean>(false);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // ファイル input を押すため（任意）
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const errorMessage = (msg: string) => {
    // 10秒制限（RLS）に引っかかったときのメッセージを置換
    if (msg.includes("row-level security policy") && msg.includes("USING expression")) {
      return "変更が早すぎます。10秒ほど待ってからもう一度押してください。";
    }
    return "保存に失敗しました。もう一度お試しください。";
  };

  // DBからプロフィール取得（name + avatar_url）
  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user?.id) return;

      setLoadingProfile(true);
      setErrorText(null);

      const { data, error, status } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", session.user.id)
        .maybeSingle();

      console.log("fetchProfile:", { status, data, error });

      if (error) {
        setErrorText(error.message);
        setProfileName("");
        setNameInput("");
        setAvatarUrl("");
      } else {
        const n = data?.name ?? "";
        setProfileName(n);
        setNameInput(n);

        // DBが空なら、セッション（Google）由来をフォールバック表示（表示だけ）
        const meta: any = session.user.user_metadata;
        const fallback =
          meta?.avatar_url ?? meta?.picture ?? meta?.image_url ?? meta?.profile_picture ?? "";

        setAvatarUrl(data?.avatar_url ?? fallback ?? "");
      }

      setLoadingProfile(false);
    };

    fetchProfile();
  }, [session?.user?.id]);

  const renderName = () => {
    if (loadingProfile) return "名前取得中...";
    return profileName || "(未設定)";
  };

  // 保存（名前）
  const saveName = async () => {
    if (!session?.user?.id) return;
    if (cooldown > 0) return;

    setSaving(true);
    setErrorText(null);

    const { data, error, status } = await supabase
      .from("profiles")
      .upsert({ id: session.user.id, name: nameInput }, { onConflict: "id" })
      .select("id, name, updated_at")
      .single();

    console.log("saveName(upsert):", { status, data, error });

    if (error) {
      console.log("raw error:", error);
      setErrorText(errorMessage(error.message));
      setSaving(false);
      return;
    }

    setProfileName(data.name ?? "");
    setCooldown(10);
    setSaving(false);
  };

  // 画像アップロード → Storage → 公開URL取得 → profiles.avatar_url 更新
  const onPickAvatar = async (file: File) => {
    if (!session?.user?.id) return;
    if (cooldown > 0) return;

    setSaving(true);
    setErrorText(null);

    try {
      // 1) ファイルパス生成
      const ext = file.name.split(".").pop() || "png";
      const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;

      // 2) Storageへアップロード（public bucket: images）
      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) throw uploadError;

      // 3) 公開URLを取得
      const { data: pub } = supabase.storage.from("images").getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      // 4) DB更新（※RLSの10秒制限に注意）
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", session.user.id);

      if (updErr) throw updErr;

      // 5) 反映
      setAvatarUrl(publicUrl);
      setCooldown(10);
    } catch (e: any) {
      console.error("avatar upload error:", e);
      setErrorText(errorMessage(e?.message ?? "Upload failed"));
    } finally {
      setSaving(false);
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ざっくり画像だけ許可
    if (!file.type.startsWith("image/")) {
      setErrorText("画像ファイルを選んでください。");
      e.target.value = "";
      return;
    }

    // 例: 5MB制限（任意）
    const maxMb = 5;
    if (file.size > maxMb * 1024 * 1024) {
      setErrorText(`画像が大きすぎます（最大 ${maxMb}MB）。`);
      e.target.value = "";
      return;
    }

    await onPickAvatar(file);
    e.target.value = ""; // 同じファイルを再選択できるように
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div
      style={{ padding: 24 }}
      className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover"
    >
      <Header backTo="/mainpage"></Header>

      {!session ? (
        <div className="w-2/3 mx-auto bg-white/80 backdrop-blur border-b border-gray-200 p-20">
          <div className="flex mx-auto max-w-5xl items-center justify-between px-6 py-4">
            <p className="text-xl ">未ログインです</p>
            <Link
              to="/login"
              className="rounded-xl px-3 py-2 text-xl font-medium text-gray-700 hover:bg-gray-100 active:scale-75 hover:shadow-sm transition"
            >
              ログインへ
            </Link>
          </div>
        </div>
      ) : (
        <div className="w-2/3 mx-auto bg-white/80 backdrop-blur border-b border-gray-200 p-20">
          <div className="flex mx-auto max-w-5xl items-center justify-between px-6 py-4">
            {/* 左：アイコンとメール */}
            <div className="relative flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <img
                  className="border-2 border-black rounded-xl w-24 h-24 object-cover bg-white"
                  src={avatarUrl || "/src/assets/default-avatar.png"}
                  alt="avatar"
                />

                <div className="flex flex-col gap-2">
                  <button
                    className="rounded px-4 py-2 bg-gray-800 text-white disabled:opacity-50 hover:bg-gray-900 active:scale-75 transition shadow-sm hover:shadow-lg"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving || cooldown > 0}
                  >
                    {cooldown > 0 ? `あと ${cooldown} 秒` : "アイコン変更"}
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onFileChange}
                  />

                  <p className="text-sm text-gray-600">{session.user.email}</p>
                </div>
              </div>

              {loadingProfile && <p className="text-sm text-gray-600">プロフィール読込中...</p>}
            </div>

            {/* 中：名前変更 */}
            <div className="flex flex-col items-center gap-3">
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

              {errorText && <p className="text-red-600 text-sm">{errorText}</p>}
            </div>

            {/* 右：ログアウト */}
            <button
              className="inline-flex items-center rounded-xl px-4 py-2 text-xl font-medium bg-gray-800 text-white hover:bg-gray-900 active:scale-75 transition shadow-sm hover:shadow-lg"
              onClick={logout}
            >
              ログアウト
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Account;