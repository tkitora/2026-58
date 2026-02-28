import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase-oauth/supabase";
import { Header } from "../index";

type PresencePlayer = {
  playerid: string;
  name: string;
};

function MultiRoom() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState<string>("");
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<PresencePlayer[]>([]);
  
  const [amount, setAmount] = useState(5);
  const [timeLimit, setTimeLimit] = useState(30);

  const roomId = sessionStorage.getItem("roomid");
  const playerId = sessionStorage.getItem("playerid");

  useEffect(() => {
    if (!roomId || !playerId) {
      navigate("/multi");
      return;
    }

    let isMounted = true;
    let presenceChannel: ReturnType<typeof supabase.channel>;
    let dbChannel: ReturnType<typeof supabase.channel>;

    const initRoom = async () => {
      // 1. 部屋情報と自分の情報の取得
      const { data: roomData, error: roomError } = await supabase
        .from("room")
        .select("name, host_id")
        .eq("roomid", roomId)
        .single();

      if (roomError || !roomData) {
        if (isMounted) navigate("/multi");
        return;
      }

      if (isMounted) {
        setRoomName(roomData.name);
        setIsHost(roomData.host_id === playerId);
      }

      const { data: playerData } = await supabase
        .from("players")
        .select("name")
        .eq("playerid", playerId)
        .single();
        
      const myName = playerData?.name || "名無しのゲッサー";

      // 2. Presence用チャンネル（参加者の同期専用）
      presenceChannel = supabase.channel(`presence_${roomId}`, {
        config: { presence: { key: playerId } },
      });

      presenceChannel
        .on("presence", { event: "sync" }, () => {
          if (!isMounted) return;
          const state = presenceChannel.presenceState<PresencePlayer>();
          const activePlayers = Object.values(state).flatMap((p) => p);
          setPlayers(activePlayers);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && isMounted) {
            await presenceChannel.track({ playerid: playerId, name: myName });
          }
        });

      // 3. DB監視用チャンネル（ゲーム開始の検知専用）
      dbChannel = supabase.channel(`db_${roomId}`);
      dbChannel
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "room" },
          (payload: any) => {
            if (!isMounted) return;
            // React側で自分の部屋のプレイ開始を検知
            if (payload.new.roomid === roomId && payload.new.stats === "playing") {
              navigate("/multigame");
            }
          }
        )
        .subscribe();
    };

    initRoom();

    return () => {
      isMounted = false;
      if (presenceChannel) supabase.removeChannel(presenceChannel);
      if (dbChannel) supabase.removeChannel(dbChannel);
    };
  }, [navigate, roomId, playerId]);

  const handleStartGame = async () => {
    if (!roomId) return;
    
    const { error } = await supabase
      .from("room")
      .update({
        amount: amount,
        timeLimit: timeLimit,
        stats: "playing",
        now: 1,
        answers: [],
      })
      .eq("roomid", roomId);

    if (error) {
      alert("ゲームの開始に失敗しました。");
      console.error(error);
    } else {
      navigate("/multigame");
    }
  };

  return (
    <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover py-6 px-5">
      <Header backTo="/multi" />
      <div className="w-full max-w-4xl mx-auto mt-10 bg-white/80 backdrop-blur border-2 border-black rounded-xl p-10 shadow-sm flex flex-col md:flex-row gap-10">
        
        <div className="flex-1">
          <h2 className="text-3xl font-bold mb-2">あいことば: <span className="text-amber-600">{roomName}</span></h2>
          <p className="text-gray-600 mb-6 border-b border-gray-300 pb-2">参加者 {players.length} 人</p>
          
          <ul className="space-y-3">
            {players.map((p) => (
              <li key={p.playerid} className="text-xl font-bold px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm flex items-center gap-3">
                <span className="text-2xl">👤</span> {p.name}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex-1 bg-gray-50 border-2 border-gray-300 rounded-xl p-8 flex flex-col justify-center">
          {isHost ? (
            <div className="flex flex-col gap-6">
              <h3 className="text-2xl font-bold text-center border-b border-gray-300 pb-3">ルーム設定</h3>
              
              <div>
                <label className="block text-lg font-bold mb-2 text-gray-700">問題数</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  className="w-full border-2 border-gray-400 rounded-lg px-4 py-2 text-xl"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-lg font-bold mb-2 text-gray-700">制限時間</label>
                <select
                  className="w-full border-2 border-gray-400 rounded-lg px-4 py-2 text-xl"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                >
                  <option value={10}>10秒</option>
                  <option value={15}>15秒</option>
                  <option value={20}>20秒</option>
                  <option value={30}>30秒</option>
                </select>
              </div>

              <button
                onClick={handleStartGame}
                className="w-full py-4 mt-4 rounded-xl text-2xl font-bold text-white bg-amber-500 hover:bg-amber-600 active:scale-95 shadow-md transition"
              >
                ゲームを開始する！
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-6xl mb-6 animate-pulse">⏳</div>
              <h3 className="text-2xl font-bold text-gray-700">
                ホストがゲームを開始するのを<br />待っています...
              </h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MultiRoom;