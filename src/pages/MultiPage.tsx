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

    // ★ 名前の入力がなければデフォルト値を設定
    const finalPlayerName = playerNameInput.trim() || "名無しのゲッサー";

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("room").delete().lt("update_at", yesterday);

      const { data: room, error: roomError } = await supabase
        .from("room")
        .select("*")
        .eq("name", roomNameInput.trim())
        .maybeSingle();

      if (roomError) throw roomError;

      const newPlayerId = crypto.randomUUID();
      let targetRoomId = "";

      if (room) {
        // ★ 部屋にいるアクティブなプレイヤーを確認
        const { data: activePlayers } = await supabase
          .from("players")
          .select("playerid")
          .eq("roomid", room.roomid)
          .eq("stats", "active");

        // ★ 誰もいない（全員退出済み）の場合はホスト権限を奪取して部屋を初期化・再利用
        if (!activePlayers || activePlayers.length === 0) {
          targetRoomId = room.roomid;
          await supabase.from("room").update({
            host_id: newPlayerId,
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
          host_id: newPlayerId,
          stats: "waiting",
        });
        if (insertRoomError) throw insertRoomError;
      }

      const { error: insertPlayerError } = await supabase.from("players").insert({
        playerid: newPlayerId,
        roomid: targetRoomId,
        name: finalPlayerName, // ★ 確定した名前を使用
        stats: "active",
      });

      if (insertPlayerError) throw insertPlayerError;

      sessionStorage.setItem("roomid", targetRoomId);
      sessionStorage.setItem("playerid", newPlayerId);

      navigate("/multiroom");

    } catch (error: any) {
      console.error(error);
      setErrorMsg("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }} className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover">
      <Header backTo="/mainpage" />
      <div className="w-2/3 mx-auto bg-white/80 backdrop-blur border-2 border-black p-20 mt-10 rounded-xl shadow-sm">
        <h1 className="text-6xl md:text-7xl font-bold text-center mb-12">
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
        
        <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
          <div className="w-full">
            <label className="block text-xl font-bold mb-2 text-gray-700">あいことばはなんですか？</label>
            <input
              type="text"
              className="w-full border-2 border-gray-400 rounded-lg px-4 py-3 text-xl focus:outline-none focus:border-amber-500"
              value={roomNameInput}
              onChange={(e) => setRoomNameInput(e.target.value)}
              placeholder="あいことば"
              maxLength={20}
            />
          </div>

          <div className="w-full">
            <label className="block text-xl font-bold mb-2 text-gray-700">おなまえはなんですか？</label>
            <input
              type="text"
              className="w-full border-2 border-gray-400 rounded-lg px-4 py-3 text-xl focus:outline-none focus:border-amber-500"
              value={playerNameInput}
              onChange={(e) => setPlayerNameInput(e.target.value)}
              placeholder="名無しのゲッサー"
              maxLength={15}
            />
          </div>

          {errorMsg && <p className="text-red-600 font-bold">{errorMsg}</p>}

          <button
            onClick={handleJoin}
            disabled={isLoading}
            className={`w-full py-4 mt-4 rounded-xl text-2xl font-bold text-white transition ${
              isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-amber-500 hover:bg-amber-600 active:scale-95 shadow-md"
            }`}
          >
            {isLoading ? "入室中..." : "OK！"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MultiPage;