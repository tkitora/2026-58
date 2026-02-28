// ルームのステータス
export type RoomStats = 'waiting' | 'playing';

// プレイヤーのステータス
export type PlayerStats = 'active' | 'left';

// roomテーブルの型
export interface RoomData {
  roomid: string;
  name: string;      // あいことば
  host_id: string;   // ホストのplayerid
  stats: RoomStats;
  amount: number;    // 問題数
  timeLimit: number; // 制限時間
  now: number;       // 現在の問題番号
  lat: number | null;
  long: number | null;
  pano: string | null;
  answers: string[]; // 例: ['奈良県', '北海道', ...]
  update_at: string;
}

// playersテーブルの型
export interface PlayerData {
  playerid: string;
  roomid: string;
  name: string;
  join_at: string;
  answers: number[]; // 0:奈良, 1:道, 2:他, 3:未回答
  stats: PlayerStats;
}