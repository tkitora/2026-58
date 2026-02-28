import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase-oauth/supabase";
import type { Session } from "@supabase/supabase-js";
import { Link } from "react-router-dom";
import { Header } from "../index";

type ShopItem = {
  id: string;
  type: string;
  name: string;
  price: number;
  created_at?: string;
};

type CosmetickRow = {
  id: string;
  nowcosme: string | null;
  runcosme: string[] | null;
  buyed: string[] | null;
};

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

  // -----------------------------
  // 追加：デコレーション編集関連
  // -----------------------------
  const [tab, setTab] = useState<"icon" | "run">("icon");
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [cosmetick, setCosmetick] = useState<CosmetickRow | null>(null);
  const [loadingCosmetick, setLoadingCosmetick] = useState(false);

  const [decoSaving, setDecoSaving] = useState(false);
  const [decoInfo, setDecoInfo] = useState<string | null>(null);
  const [decoError, setDecoError] = useState<string | null>(null);

  const userId = session?.user?.id ?? null;

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

  // -----------------------------
  // 追加：shopitems & cosmetick 読み込み
  // -----------------------------
  useEffect(() => {
    const fetchItems = async () => {
      setLoadingItems(true);
      const { data, error } = await supabase
        .from("shopitems")
        .select("id,type,name,price,created_at")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("fetch shopitems error:", error);
        // accountのerrorTextとは分ける（UIが混ざらないように）
        setDecoError("ショップアイテムの取得に失敗しました。");
        setItems([]);
      } else {
        setItems((data ?? []) as ShopItem[]);
      }
      setLoadingItems(false);
    };

    fetchItems();
  }, []);

  useEffect(() => {
    const fetchCosmetick = async () => {
      if (!userId) return;

      setLoadingCosmetick(true);
      setDecoError(null);
      setDecoInfo(null);

      const { data, error } = await supabase
        .from("cosmetick")
        .select("id, nowcosme, runcosme, buyed")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("fetch cosmetick error:", error);
        setCosmetick(null);
        setDecoError("デコレーション情報の取得に失敗しました。");
        setLoadingCosmetick(false);
        return;
      }

      if (!data) {
        // 初回は作成
        const { data: ins, error: insErr } = await supabase
          .from("cosmetick")
          .insert({ id: userId, nowcosme: null, runcosme: [], buyed: [] })
          .select("id, nowcosme, runcosme, buyed")
          .single();

        if (insErr) {
          console.error("insert cosmetick error:", insErr);
          setCosmetick(null);
          setDecoError("デコレーション情報の初期作成に失敗しました。");
        } else {
          setCosmetick(ins as CosmetickRow);
        }
      } else {
        setCosmetick(data as CosmetickRow);
      }

      setLoadingCosmetick(false);
    };

    fetchCosmetick();
  }, [userId]);

  const buyedSet = useMemo(() => new Set(cosmetick?.buyed ?? []), [cosmetick?.buyed]);
  const runSet = useMemo(() => new Set(cosmetick?.runcosme ?? []), [cosmetick?.runcosme]);

  const ownedIconItems = useMemo(() => {
    // buyed[] に入ってて type="icon"
    return items.filter((it) => it.type === "icon" && buyedSet.has(it.id));
  }, [items, buyedSet]);

  const ownedRunItems = useMemo(() => {
    // buyed[] に入ってて type="run"
    return items.filter((it) => it.type === "run" && buyedSet.has(it.id));
  }, [items, buyedSet]);

  const selectNowCosme = async (itemId: string) => {
    if (!userId) return;
    if (!cosmetick) return;

    setDecoSaving(true);
    setDecoError(null);
    setDecoInfo(null);

    try {
      // 購入済みチェック（念のため）
      if (!buyedSet.has(itemId)) {
        setDecoError("未購入のアイテムは設定できません。");
        return;
      }

      const { data, error } = await supabase
        .from("cosmetick")
        .update({ nowcosme: itemId })
        .eq("id", userId)
        .select("id, nowcosme, runcosme, buyed")
        .single();

      if (error) throw error;

      setCosmetick(data as CosmetickRow);
      setDecoInfo("アイコンを変更しました。");
    } catch (e: any) {
      console.error("selectNowCosme error:", e);
      setDecoError("アイコンの変更に失敗しました。");
    } finally {
      setDecoSaving(false);
    }
  };

  const toggleRunCosme = async (itemId: string) => {
    if (!userId) return;
    if (!cosmetick) return;

    setDecoSaving(true);
    setDecoError(null);
    setDecoInfo(null);

    try {
      if (!buyedSet.has(itemId)) {
        setDecoError("未購入のアイテムは設定できません。");
        return;
      }

      const current = cosmetick.runcosme ?? [];
      const exists = current.includes(itemId);
      const next = exists ? current.filter((x) => x !== itemId) : [...current, itemId];

      const { data, error } = await supabase
        .from("cosmetick")
        .update({ runcosme: next })
        .eq("id", userId)
        .select("id, nowcosme, runcosme, buyed")
        .single();

      if (error) throw error;

      setCosmetick(data as CosmetickRow);
      setDecoInfo(exists ? "マスコットを外しました。" : "マスコットを追加しました。");
    } catch (e: any) {
      console.error("toggleRunCosme error:", e);
      setDecoError("マスコットの変更に失敗しました。");
    } finally {
      setDecoSaving(false);
    }
  };

  // -----------------------------
  // UI
  // -----------------------------
  const DecoPanel = () => {
    // 未ログイン時は出さない（要件に合わせて：購入済みを使うため）
    if (!session) return null;

    const isBusy = loadingItems || loadingCosmetick || decoSaving;

    const tabBtn = (key: "icon" | "run", label: string) => {
      const active = tab === key;
      return (
        <button
          onClick={() => setTab(key)}
          className={
            "rounded-xl px-4 py-2 text-lg font-medium transition shadow-sm " +
            (active
              ? "bg-gray-900 text-white"
              : "bg-white/70 text-gray-700 hover:bg-gray-100 active:scale-95")
          }
        >
          {label}
        </button>
      );
    };

    const Card = ({
      item,
      active,
      badgeText,
      onClick,
    }: {
      item: ShopItem;
      active: boolean;
      badgeText: string | null;
      onClick: () => void;
    }) => {
      // hoverは常に付ける（クリック可否に関わらず）
      const cardClass =
        "rounded-2xl border p-4 shadow-sm transition hover:shadow-lg hover:-translate-y-0.5 " +
        (active ? "border-yellow-500 bg-yellow-50/70" : "border-gray-200 bg-white/70");

      return (
        <button type="button" onClick={onClick} className={cardClass}>
          <div className="flex items-start justify-between gap-3 text-left">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">{item.name}</p>
                {badgeText && (
                  <span className="text-xs px-2 py-1 rounded bg-yellow-200 text-yellow-900 font-semibold">
                    {badgeText}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-700">type: {item.type}</p>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-700">
                price: <span className="font-bold">{item.price}</span>
              </p>
              <p className="text-xs text-gray-500">クリックで変更</p>
            </div>
          </div>
        </button>
      );
    };

    const now = cosmetick?.nowcosme ?? null;

    return (
      <div className="w-2/3 mx-auto bg-white/80 backdrop-blur border-b border-gray-200 p-10 mt-6">
        <div className="mx-auto max-w-5xl px-6 py-4 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-2xl font-semibold">デコレーション</p>

            <div className="text-right">
              {isBusy && <p className="text-sm text-gray-600">読込中...</p>}
              {decoInfo && <p className="text-sm text-green-700">{decoInfo}</p>}
              {decoError && <p className="text-sm text-red-600">{decoError}</p>}
            </div>
          </div>

          {/* タブ */}
          <div className="flex items-center gap-3">
            {tabBtn("icon", "アイコン")}
            {tabBtn("run", "マスコット")}
          </div>

          {/* コンテンツ */}
          {tab === "icon" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-700">
                購入済みの <span className="font-semibold">icon</span> アイテムから選択できます。
              </p>

              {ownedIconItems.length === 0 ? (
                <p className="text-gray-700">購入済みのアイコンアイテムがありません。</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ownedIconItems.map((it) => (
                    <Card
                      key={it.id}
                      item={it}
                      active={now === it.id}
                      badgeText={now === it.id ? "使用中" : null}
                      onClick={() => {
                        if (decoSaving) return;
                        // クリックで nowcosme を変更
                        selectNowCosme(it.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-700">
                購入済みの <span className="font-semibold">run</span> アイテムを追加/削除できます。
              </p>

              {ownedRunItems.length === 0 ? (
                <p className="text-gray-700">購入済みのマスコットアイテムがありません。</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ownedRunItems.map((it) => {
                    const usingNow = runSet.has(it.id);
                    return (
                      <Card
                        key={it.id}
                        item={it}
                        active={usingNow}
                        badgeText={usingNow ? "使用中" : null}
                        onClick={() => {
                          if (decoSaving) return;
                          // クリックで runcosme の追加/削除
                          toggleRunCosme(it.id);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover py-6 px-5">
      <Header backTo="/mainpage"></Header>

      {!session ? (
        <div className="w-2/3 mx-auto bg-white/80 backdrop-blur border-b border-gray-200 p-20">
          <div className="flex mx-auto max-w-5xl items-center justify-between px-6 py-4">
            {/* 左：アイコンとメール */}
            <div className="relative flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <img
                  className="border-2 border-black rounded-xl w-24 h-24 object-cover bg-white opacity-70"
                  src="/src/assets/default_icon.png"
                  alt="avatar"
                />

                <div className="flex flex-col gap-2">
                  <button className="rounded px-4 py-2 bg-gray-400 text-white cursor-not-allowed" disabled>
                    アイコン変更
                  </button>

                  <p className="text-sm text-gray-600">ログインするとアイコンの変更が出来ます</p>
                </div>
              </div>
            </div>

            {/* 中：名前変更 */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-xl">現在のユーザー名: 名無しのゲッサ―</p>

              <div className="flex items-center gap-2">
                <input
                  className="border border-gray-300 rounded px-3 py-2 bg-gray-200 text-gray-500 cursor-not-allowed"
                  value="名無しのゲッサ―"
                  disabled
                />

                <button className="rounded px-4 py-2 bg-gray-400 text-white cursor-not-allowed" disabled>
                  変更
                </button>
              </div>

              <p className="text-sm text-gray-600">※ログインすると名前の変更が可能になります</p>
            </div>

            {/* 右：ログインボタン */}
            <Link
              className="inline-flex items-center rounded-xl px-4 py-2 text-xl font-medium bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition shadow-sm hover:shadow-lg"
              to="/login"
            >
              ログイン
            </Link>
          </div>
        </div>
      ) : (
        <>
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

          {/* 追加：デコレーション編集エリア */}
          <DecoPanel />
        </>
      )}
    </div>
  );
}

export default Account;