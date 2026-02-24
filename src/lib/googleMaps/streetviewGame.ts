// src/lib/googleMaps/streetviewGame.ts
import type { Answers, AnswerResult, Question } from "./types";

export function createStreetViewGame() {
  const sv = new google.maps.StreetViewService();
  const geocoder = new google.maps.Geocoder();

  async function geocodeViewport(address: string): Promise<google.maps.LatLngBounds> {
    const res = await geocoder.geocode({ address, region: "JP" });
    const first = res.results?.[0];
    if (!first?.geometry?.viewport) throw new Error("Geocode failed");
    return first.geometry.viewport;
  }

  function randomPointInBounds(bounds: google.maps.LatLngBounds) {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const lat = sw.lat() + Math.random() * (ne.lat() - sw.lat());
    const lng = sw.lng() + Math.random() * (ne.lng() - sw.lng());
    return new google.maps.LatLng(lat, lng);
  }

  function randomLatLngInJapanBox() {
    const lat = 24 + Math.random() * (46 - 24);
    const lng = 123 + Math.random() * (146 - 123);
    return new google.maps.LatLng(lat, lng);
  }

  async function getPrefectureName(latLng: google.maps.LatLng): Promise<string | null> {
    const res = await geocoder.geocode({ location: latLng });
    const first = res.results?.[0];
    if (!first) return null;
    const pref = first.address_components.find((c) =>
      c.types.includes("administrative_area_level_1")
    );
    return pref?.long_name ?? null;
  }

  type SafePanoData = {
  pano: string;
  latLng: google.maps.LatLng;
};

async function getPanoramaNear(
  loc: google.maps.LatLng,
  radius: number
): Promise<SafePanoData> {
  const res = await sv.getPanorama({ location: loc, radius });
  const data = res.data;

  const pano = data?.location?.pano;
  const latLng = data?.location?.latLng;

  if (!pano || !latLng) throw new Error("No pano location/latLng");

  return { pano, latLng };
}

  /**
   * newView: 「新しいStreetViewを出す」ロジック
   * - mode: "NARA" なら奈良限定、"DOU" なら北海道限定、"OTHER" ならそれ以外
   * - panorama: 渡すと、ここで setPano までやる（UI側が楽）
   */
  async function newView(params: {
    mode: "NARA" | "DOU" | "OTHER";
    panorama?: google.maps.StreetViewPanorama;
    maxTries?: number;
  }): Promise<Question> {
    const { mode, panorama, maxTries = mode === "NARA" ? 40 : 80 } = params;

    if (mode === "NARA") {
      const bounds = await geocodeViewport("奈良県, 日本");

      for (let tries = 0; tries < maxTries; tries++) {
        const loc = randomPointInBounds(bounds);
        try {
          const data = await getPanoramaNear(loc, 5000);
            const latLng = data.latLng;
            if (!bounds.contains(latLng)) continue;

            const pref = await getPrefectureName(latLng);
            if (pref !== "奈良県") continue;

            if (panorama) {
              panorama.setPano(data.pano);
              panorama.setVisible(true);
            }

          return { panoLatLng: latLng, prefName: pref };
        } 
        catch {
          // try next
        }
      }
      throw new Error("奈良県内でStreet Viewが見つからなかった");
    }else if(mode === "DOU") {
      const bounds = await geocodeViewport("北海道, 日本");
      for (let tries = 0; tries < maxTries; tries++) {
        const loc = randomPointInBounds(bounds);
        try {
          const data = await getPanoramaNear(loc, 5000);
            const latLng = data.latLng;
            if (!bounds.contains(latLng)) continue;

            const pref = await getPrefectureName(latLng);
            if (pref !== "北海道") continue;

            if (panorama) {
              panorama.setPano(data.pano);
              panorama.setVisible(true);
            }

          return { panoLatLng: latLng, prefName: pref };
        } 
        catch {
          // try next
        }
      }
      throw new Error("北海道内でStreet Viewが見つからなかった");
    }

    // NOT_NARA
    for (let tries = 0; tries < maxTries; tries++) {
      const loc = randomLatLngInJapanBox();
      try {
        const data = await getPanoramaNear(loc, 10000);
        const latLng = data.latLng;
        const pref = await getPrefectureName(latLng);

        if (pref && pref !== "奈良県" && pref !== "北海道") {
          if (panorama) {
            panorama.setPano(data.pano);
            panorama.setVisible(true);
          }
          return { panoLatLng: latLng, prefName: pref };
        }
      } 
      catch {
        // try next
      }
    }
    throw new Error("奈良以外のStreet View地点が見つからなかった");
  }

  /**
   * checkResult: 答え合わせ（UI非依存）
   */
  function checkResult(question: Question, userSays: Answers): AnswerResult {
    console.log("正解データ:", question.prefName);
    console.log("ユーザー入力:", userSays);
    let isCorrect = false;
    if(userSays === "OTHER"){
      isCorrect = (question.prefName !== "奈良県" && question.prefName !== "北海道");
    }else{
      isCorrect = (question.prefName === userSays);
    }
    return {
      ok: isCorrect,
      correctPref: question.prefName,
      correctLatLng: question.panoLatLng,
    };
  }

  /**
   * 結果マップ描画（answerMapDivに描画）
   */
  function renderAnswerMap(answerMapDiv: HTMLElement, result: AnswerResult) {
    const map = new google.maps.Map(answerMapDiv, {
      center: result.correctLatLng,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    new google.maps.Marker({
      map,
      position: result.correctLatLng,
      title: `正解: ${result.correctPref ?? "不明"}`,
    });

    return map;
  }

  return { newView, checkResult, renderAnswerMap };
}