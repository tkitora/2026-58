import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase-oauth/supabase";
import { Header } from "../index";

function MultiPage() {
  const navigate = useNavigate();
  const [roomNameInput, setRoomNameInput] = useState("");
  const [playerNameInput, setPlayerNameInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ログイン中の場合はプロフィールから名前を取得して初期値にセット
  useEffect(() => {
    const fetchSessionName = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data } = await supabase.from("profiles").select("name").eq("id", session.user.id).maybeSingle();
        if (data?.name) {
          setPlayerNameInput(data.name);
        }
      }
    };
    fetchSessionName();
  }, []);

  const handleJoin = async () => {
    if (!roomNameInput.trim()) {
      setErrorMsg("あいことばを入力してください。");
      return;
    }

    const finalPlayerName = playerNameInput.trim() || "名無しのゲッサー";

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // 1. 古い部屋と「古いゲストプレイヤー」の掃除
      await supabase.from("room").delete().lt("update_at", yesterday);
      await supabase.from("players").delete().eq("is_guest", true).lt("join_at", yesterday);

      // 2. ログイン状態の確認とID/フラグの決定
      const { data: authData } = await supabase.auth.getSession();
      const user = authData.session?.user;

      // ログインしていれば固定ID、そうでなければランダムID
      const playerId = user ? user.id : crypto.randomUUID();
      const isGuest = !user;

      // 3. 部屋の取得とホスト権限の確認
      const { data: room, error: roomError } = await supabase
        .from("room")
        .select("*")
        .eq("name", roomNameInput.trim())
        .maybeSingle();

      if (roomError) throw roomError;

      let targetRoomId = "";

      if (room) {
        // 部屋にいるアクティブなプレイヤーを確認
        const { data: activePlayers } = await supabase
          .from("players")
          .select("playerid")
          .eq("roomid", room.roomid)
          .eq("stats", "active");

        // 誰もいない（全員退出済み）の場合はホスト権限を奪取して部屋を初期化・再利用
        if (!activePlayers || activePlayers.length === 0) {
          targetRoomId = room.roomid;
          await supabase.from("room").update({
            host_id: playerId,
            stats: "waiting",
            now: 1,
            answers: []
          }).eq("roomid", targetRoomId);
        } else {
          if (room.stats === "playing") {
            setErrorMsg("今はそのあいことばは使えません。");
            setIsLoading(false);
            return;
          }
          targetRoomId = room.roomid;
        }
      } else {
        targetRoomId = crypto.randomUUID();
        const { error: insertRoomError } = await supabase.from("room").insert({
          roomid: targetRoomId,
          name: roomNameInput.trim(),
          host_id: playerId,
          stats: "waiting",
        });
        if (insertRoomError) throw insertRoomError;
      }

      // 4. プレイヤー情報の UPSERT (更新または挿入)
      const { error: upsertPlayerError } = await supabase.from("players").upsert({
        playerid: playerId,
        roomid: targetRoomId,
        name: finalPlayerName,
        stats: "active",
        is_guest: isGuest,
        answers: [], // 過去の回答データをリセット
        join_at: new Date().toISOString() // ゲスト削除判定用に更新日時をセット
      });

      if (upsertPlayerError) throw upsertPlayerError;

      sessionStorage.setItem("roomid", targetRoomId);
      sessionStorage.setItem("playerid", playerId);

      navigate("/multiroom");

    } catch (error: any) {
      console.error(error);
      setErrorMsg("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-cover px-3 sm:px-6 py-6">
      {/* ★共通幅の白枠コンテナ */}
      <div className="w-full max-w-3xl mx-auto">
        {/* Headerもこの幅の中に入る */}
        <Header backTo="/mainpage" />

        {/* メイン（Headerと同じ横幅になる） */}
        <div className="bg-white/80 backdrop-blur border-2 border-black rounded-xl shadow-sm p-5 sm:p-10 md:p-14 lg:p-20 mt-4">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-center mb-6 sm:mb-10 md:mb-12">
            {"ならげっさー！".split("").map((char, i) => (
              <span
                key={i}
                className="inline-block animate-wave"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                {char}
              </span>
            ))}
          </h1>

          <div className="flex flex-col items-center gap-5 sm:gap-6 w-full max-w-md mx-auto">
            <div className="w-full">
              <label className="block text-base sm:text-xl font-bold mb-2 text-gray-700">
                あいことばはなんですか？
              </label>
              <input
                type="text"
                className="w-full border-2 border-gray-400 rounded-lg px-4 py-3 text-base sm:text-xl focus:outline-none focus:border-amber-500"
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                placeholder="あいことば"
                maxLength={20}
              />
            </div>

            <div className="w-full">
              <label className="block text-base sm:text-xl font-bold mb-2 text-gray-700">
                おなまえはなんですか？
              </label>
              <input
                type="text"
                className="w-full border-2 border-gray-400 rounded-lg px-4 py-3 text-base sm:text-xl focus:outline-none focus:border-amber-500"
                value={playerNameInput}
                onChange={(e) => setPlayerNameInput(e.target.value)}
                placeholder="名無しのゲッサー"
                maxLength={15}
              />
            </div>

            {errorMsg && (
              <p className="text-red-600 font-bold text-sm sm:text-base text-center">
                {errorMsg}
              </p>
            )}

            <button
              onClick={handleJoin}
              disabled={isLoading}
              className={[
                "w-full py-3 sm:py-4 mt-2 sm:mt-4 rounded-xl font-bold text-white transition",
                "text-xl sm:text-2xl",
                isLoading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-amber-500 hover:bg-amber-600 active:scale-95 shadow-md",
              ].join(" ")}
            >
              {isLoading ? "入室中..." : "OK！"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MultiPage;