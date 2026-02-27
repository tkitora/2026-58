// src/lib/googleMaps/streetviewGame.ts
import type { Answers, AnswerResult, Question } from "./types";

// 指定したミリ秒だけ待つ関数
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    
    // 州・県（administrative_area_level_1）を取得
    const pref = first.address_components.find((c) =>
      c.types.includes("administrative_area_level_1")
    )?.long_name;
    
    // 国（country）を取得
    const country = first.address_components.find((c) =>
      c.types.includes("country")
    )?.long_name;

    if (!pref) return null;

    // もし国名が取得できて、かつ「日本」じゃなければ、国名をくっつけて返す
    if (country && country !== "日本" && country !== "Japan") {
      return `${country} : ${pref}`;
    }

    return pref; // 日本の場合は今まで通り県名だけを返す
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

//段階的に半径を広げて最寄りのストリートビューを探す関数
async function getPanoramaProgressive(
  loc: google.maps.LatLng,
  radii: number[] = [500, 2000, 10000, 50000] // 最大50kmまで探す
): Promise<{ pano: string; latLng: google.maps.LatLng }> {
  for (const radius of radii) {
    try {
      const res = await sv.getPanorama({ location: loc, radius });
      if (res.data?.location?.pano && res.data?.location?.latLng) {
        return {
          pano: res.data.location.pano,
          latLng: res.data.location.latLng
        };
      }
    } catch (e) {
      await sleep(300);
    }
  }
  throw new Error("指定した範囲内にストリートビューが見つかりませんでした");
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
    const { mode, panorama, maxTries = mode === "NARA" || mode === "DOU" ? 40 : 80 } = params;

    if (mode === "NARA") {
      const bounds = await geocodeViewport("奈良県, 日本");

      for (let tries = 0; tries < maxTries; tries++) {
        const loc = randomPointInBounds(bounds);
        try {
          const data = await getPanoramaNear(loc, 5000);
            const latLng = data.latLng;
            if (!bounds.contains(latLng)) {
              await sleep(300);
              continue;
            }

            const pref = await getPrefectureName(latLng);
            if (pref !== "奈良県") {
              await sleep(300); // 連続でAPI叩くとエラーになることがあるので少し待つ
              continue;
            }

            if (panorama) {
              panorama.setPano(data.pano);
              panorama.setVisible(true);
            }

          return { panoLatLng: latLng, prefName: pref };
        } 
        catch (e) {
          await sleep(300); // 連続でAPI叩くとエラーになることがあるので少し待つ
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
            if (!bounds.contains(latLng)) {
              await sleep(300);
              continue;
            }

            const pref = await getPrefectureName(latLng);
            if (pref !== "北海道") {
              await sleep(300); // 連続でAPI叩くとエラーになることがあるので少し待つ
              continue;
            }

            if (panorama) {
              panorama.setPano(data.pano);
              panorama.setVisible(true);
            }

          return { panoLatLng: latLng, prefName: pref };
        } 
        catch (e) {
          await sleep(300); // 連続でAPI叩くとエラーになることがあるので少し待つ
          // try next
        }
      }
      throw new Error("北海道内でStreet Viewが見つからなかった");
    }

// NOT_NARA（それ以外！の時）
    const otherTargets = [
      "青森県, 日本", "岩手県, 日本", "宮城県, 日本", "秋田県, 日本", "山形県, 日本", "福島県, 日本",
      "茨城県, 日本", "栃木県, 日本", "群馬県, 日本", "埼玉県, 日本", "千葉県, 日本", "神奈川県, 日本",
      "新潟県, 日本", "富山県, 日本", "石川県, 日本", "福井県, 日本", "山梨県, 日本", "長野県, 日本", "岐阜県, 日本",
      "静岡県, 日本", "愛知県, 日本", "三重県, 日本", "滋賀県, 日本", "京都府, 日本", "大阪府, 日本", "兵庫県, 日本",
      "和歌山県, 日本", "鳥取県, 日本", "島根県, 日本", "岡山県, 日本", "広島県, 日本", "山口県, 日本",
      "徳島県, 日本", "香川県, 日本", "愛媛県, 日本", "高知県, 日本",
      "福岡県, 日本", "佐賀県, 日本", "熊本県, 日本", "大分県, 日本", "宮崎県, 日本", 
      "東京都八王子市, 日本", "東京都奥多摩町, 日本", "長崎県佐世保市, 日本", "鹿児島県霧島市, 日本", "沖縄県名護市, 日本",
      "ソウル, 大韓民国", "釜山, 大韓民国", "台北, 台湾", "台中, 台湾"
    ];

    const target = otherTargets[Math.floor(Math.random() * otherTargets.length)];
    const bounds = await geocodeViewport(target);

    for (let tries = 0; tries < maxTries; tries++) {
      // 陸地の枠内でピンを刺す
      const loc = randomPointInBounds(bounds); 
      try {
        const data = await getPanoramaProgressive(loc, [1000, 5000, 20000, 50000]);
        const latLng = data.latLng;
        const pref = await getPrefectureName(latLng);

        if (pref && !pref.includes("奈良県") && !pref.includes("北海道")) {
          if (panorama) {
            panorama.setPano(data.pano);
            panorama.setVisible(true);
          }
          return { panoLatLng: latLng, prefName: pref };
        } else {
          await sleep(300);
        }
      } 
      catch (e) {
        await sleep(300);
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