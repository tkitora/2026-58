
export type LatLngLiteral = { lat: number; lng: number };

export type Answers = "奈良県" | "北海道" | "OTHER";

export type Question = {
  panoLatLng: google.maps.LatLng;   // StreetView地点
  prefName: string | null;          // 都道府県
};

export type AnswerResult = {
  ok: boolean;
  correctPref: string | null;
  correctLatLng: google.maps.LatLng;
};