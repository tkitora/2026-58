import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase-oauth/supabase";
import { Header } from "../index";

type Player = {
  playerid: string;
  name: string;
};

function MultiRoom() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState<string>("");
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  
  const [amount, setAmount] = useState(5);
  const [timeLimit, setTimeLimit] = useState(30);

  const roomId = sessionStorage.getItem("roomid");
  const playerId = sessionStorage.getItem("playerid");

  // クロージャの罠回避・画面遷移判定用のRef
  const isHostRef = useRef(false);
  const isStartingRef = useRef(false);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    if (!roomId || !playerId) {
      navigate("/multi");
      return;
    }

    let isMounted = true;
    let dbChannel: ReturnType<typeof supabase.channel>;

    const initRoom = async () => {
      await supabase.from("players").update({ stats: "active", roomid: roomId }).eq("playerid", playerId);
      const { data: roomData, error: roomError } = await supabase
        .from("room")
        .select("name, host_id, stats")
        .eq("roomid", roomId)
        .single();

      if (roomError || !roomData || roomData.stats === "deleted") {
        if (isMounted) navigate("/multi");
        return;
      }

      if (isMounted) {
        setRoomName(roomData.name);
        setIsHost(roomData.host_id === playerId);
      }

      const { data: initialPlayers } = await supabase
        .from("players")
        .select("playerid, name")
        .eq("roomid", roomId)
        .eq("stats", "active");

      if (isMounted && initialPlayers) {
        setPlayers(initialPlayers);
      }

      const uniqueDbTopic = `db_${roomId}_${Date.now()}`;
      dbChannel = supabase.channel(uniqueDbTopic);
      
      dbChannel
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "room" }, (payload: any) => {
            if (!isMounted) return;
            if (payload.new.roomid === roomId) {
              if (payload.new.stats === "playing") {
                isStartingRef.current = true;
                navigate("/multigame");
              } else if (payload.new.stats === "deleted") {
                // ホストが抜けて部屋が解散された場合
                alert("ホストが退出したため、部屋が解散されました。");
                navigate("/multi");
              }
            }
          }
        )
        // ★修正1: イベントを "*" にし、INSERTとUPDATEの両方で入退室を正確に判定する
        .on("postgres_changes", { event: "*", schema: "public", table: "players" }, (payload: any) => {
            if (!isMounted) return;
            
            const eventType = payload.eventType;
            
            // データが完全に削除された場合
            if (eventType === "DELETE") {
               setPlayers((prev) => prev.filter(p => p.playerid !== payload.old.playerid));
               return;
            }

            const newPlayer = payload.new;
            
            // 現在の部屋にいるアクティブなプレイヤーなら追加
            if (newPlayer.roomid === roomId && newPlayer.stats === "active") {
              setPlayers((prev) => {
                if (prev.some(p => p.playerid === newPlayer.playerid)) return prev;
                return [...prev, { playerid: newPlayer.playerid, name: newPlayer.name }];
              });
            } 
            // 部屋から出た（roomidがnullになった、別になった、statsがleftになった）なら削除
            else {
              setPlayers((prev) => prev.filter(p => p.playerid !== newPlayer.playerid));
            }
          }
        )
        .subscribe();
    };

    initRoom();

    // ★ 退出・ブラウザ閉じ対策のクリーンアップ関数
    const handleLeave = () => {
      if (!isStartingRef.current && roomId && playerId) {
        // ★修正2: statsをleftにするだけでなく、roomid を null にして完全に部屋から切り離す（ゴースト化防止）
        supabase.from("players").update({ stats: "left", roomid: null }).eq("playerid", playerId).then();
        if (isHostRef.current) {
          supabase.from("room").update({ stats: "deleted" }).eq("roomid", roomId).then();
        }
      }
    };

    window.addEventListener("beforeunload", handleLeave);

    return () => {
      isMounted = false;
      if (dbChannel) supabase.removeChannel(dbChannel);
      handleLeave(); // コンポーネント破棄（戻るボタンなど）時にも実行
      window.removeEventListener("beforeunload", handleLeave);
    };
  }, [navigate, roomId, playerId]);

  const handleStartGame = async () => {
    if (!roomId) return;
    
    isStartingRef.current = true; // 自分が開始ボタンを押したフラグ

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