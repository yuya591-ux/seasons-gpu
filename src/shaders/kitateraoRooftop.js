// 窓辺シリーズ番外「北寺尾の屋上、坂の街を一望」。作者の原風景＝急な坂を7割登った先にそびえる
// 7階建てマンション（サンライズ北寺尾を想起）の屋上。柵も枠も無い開けた屋上に立ち、坂の多い
// 平成初期の街を“ほぼ360°”見回す。横浜市鶴見区北寺尾〜獅子ヶ谷の地形と佇まいで再現
// （実在の商標・看板・固有意匠は模さない＝佇まいのみ）。
//  ・坂の住宅地が谷へ下って広がる（見下ろす街＝共有のレイマーチ地面を流用）
//  ・尾根を覆う森（獅子ヶ谷市民の森）
//  ・見回すと現れる平成初期のランドマーク: 大型スーパー（GMSの佇まい・駐車場・屋上看板）／
//    パチンコ屋（縦の塔看板・ネオン）／新装開店の電気屋＋祝賀のアドバルーン（紅白の気球）／
//    小学校・中学校（校舎＋校庭）／学園のグラウンド／公園の池 など（いずれも佇まいのみ）
//  ・足元は柵のない開けた屋上の床。見下ろす/身を乗り出すと坂の路地まで覗ける

import { GROUND_GLSL } from './ground.js'
import { GRADE_GLSL } from './grade.js'
import { BIRDS_GLSL } from './birds.js'
import { GODRAYS_GLSL } from './godrays.js'

export const vertexSource = /* glsl */ `
  attribute vec2 aPosition;
  void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`

const FRAGMENT_BODY = /* glsl */ `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uBright;
  uniform vec2 uPan;
  uniform vec2 uParallax;
  uniform float uReduceMotion;
  uniform float uLowRise;     // 低層住宅地化 0=通常の街 1=低い家並み
  uniform float uWindowOpen;   // 屋上では未使用（互換のため受ける）
  uniform float uGlass;
  uniform float uFlash;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyMid;
  uniform vec3 uHorizon;
  uniform vec3 uSunGlow;
  uniform vec3 uDropTint;

  float h11(float n) { return fract(sin(n) * 43758.5453123); }
  float h21(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float a = h21(i); float b = h21(i + vec2(1.0, 0.0));
    float c = h21(i + vec2(0.0, 1.0)); float d = h21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < OCTAVES; i++) { s += a * vnoise(p); p *= 2.0; a *= 0.5; }
    return s;
  }
//__GROUND__

  // 遠景の森の尾根（市民の森）。空気遠近で青く霞む。
  vec3 forestRidge(vec3 col, vec2 vp, float wx, float baseY, float amp, vec3 fcol) {
    float ridge = baseY + (fbm(vec2(wx * 1.3, 1.7)) - 0.5) * amp;
    float inside = step(vp.y, ridge);
    if (inside < 0.5) return col;
    float canopy = (fbm(vec2(wx * 18.0, vp.y * 14.0)) - 0.5) * 0.18;
    vec3 mc = fcol * (mix(1.08, 0.70, smoothstep(ridge, ridge - 0.18, vp.y)) + canopy);
    mc += uSunGlow * smoothstep(ridge - 0.02, ridge, vp.y) * 0.18;
    return mix(col, mc, inside);
  }

  // 横長の校舎/建物（窓の列）。cxScreen=画面上の中心, w=半幅, top=屋上y, base=足元y。
  vec3 longBuilding(vec3 col, vec2 vp, float cxScreen, float w, float baseY, float topY, vec3 wallC, float nightAmt) {
    float dx = abs(vp.x - cxScreen);
    float on = step(dx, w) * step(baseY, vp.y) * step(vp.y, topY);
    float fy = (vp.y - baseY) / max(topY - baseY, 0.001);
    vec3 wc = wallC * (1.0 - 0.5 * nightAmt);
    // 縦の陰影（上ほど明るく足元は接地影）＋両端のAO＝平らな箱でなく壁に
    wc *= 0.80 + 0.22 * fy;
    wc *= 0.90 + 0.10 * smoothstep(w, w * 0.45, dx);
    // 窓の列（横帯×縦割り）
    float floors = smoothstep(0.25, 0.4, fract(fy * 4.0)) * smoothstep(0.9, 0.75, fract(fy * 4.0));
    float cols = smoothstep(0.2, 0.32, fract((vp.x - cxScreen) * 90.0)) * smoothstep(0.85, 0.72, fract((vp.x - cxScreen) * 90.0));
    float win = floors * cols;
    vec3 winC = mix(wc * 0.8, mix(uSunGlow, vec3(1.0, 0.92, 0.7), 0.3), 0.3 + 0.6 * nightAmt);
    wc = mix(wc, winC, win * 0.7);
    // 陸屋根のパラペット（屋上の縁＝少し暗い帯）で天面を締める
    wc = mix(wc, wallC * 0.58, smoothstep(topY - 0.007, topY - 0.001, vp.y) * step(vp.y, topY));
    wc += uSunGlow * 0.03; // 陽（控えめ）
    return mix(col, wc, on);
  }

  void main() {
    vec2 frag = gl_FragCoord.xy / uResolution.xy;
    float asp = uResolution.x / uResolution.y;
    float t = uTime;
    vec2 p = frag;
    float mo = 1.0 - uReduceMotion;
    float yaw = uPan.x;
    float pitch = uPan.y;
    float ax = (p.x - 0.5) * asp;
    float curve = -0.10 * ax * ax;
    vec2 vp = vec2(p.x, p.y - pitch + curve);
    float sunAz = sin(uTime * 0.012 * mo) * 0.08;

    // 夜度（空が暗いほど1）
    float nightAmt = clamp(1.0 - dot(uSkyTop, vec3(1.2)), 0.0, 1.0);

    // ── 空（広い屋上の空。澄んだ午後〜夕） ──
    vec3 col = mix(uHorizon, uSkyMid, smoothstep(0.43, 0.78, vp.y));
    col = mix(col, uSkyTop, smoothstep(0.74, 1.0, vp.y));
    vec2 sunC = vec2(-0.45 + sunAz - yaw * 0.2, 0.70);
    float sunDist = distance(vec2(ax, vp.y), sunC);
    col += uSunGlow * exp(-sunDist * 3.0) * 0.45;
    col = mix(col, vec3(1.0, 0.97, 0.9), smoothstep(0.05, 0.04, sunDist) * 0.7);
    // 雲
    float cl = fbm(vec2((ax + yaw * 0.16) * 1.2 + t * 0.006 * mo, vp.y * 2.4));
    col = mix(col, mix(uSkyMid, vec3(1.0), 0.5), smoothstep(0.52, 0.72, cl) * smoothstep(0.56, 1.0, vp.y) * 0.4);
    // 薄明光線（god rays）: 夕日から放射する光の筋＝広い屋上の空の立体感
    col = godRays(col, vec2(ax, vp.y), sunC, uSunGlow * 0.14, uTime, smoothstep(0.43, 0.55, vp.y));

    // ── 遠景の森の尾根（市民の森）。ぐるりを囲む丘 ──
    float wx = ax + yaw * 0.55;
    col = forestRidge(col, vp, wx + 3.0, 0.55, 0.09, mix(uDropTint, uSkyMid, 0.5));
    col = forestRidge(col, vp, wx,       0.50, 0.07, mix(uDropTint, uSkyMid, 0.34));

    // ── 坂の住宅地（屋上から見下ろす街。共有のレイマーチ地面を流用） ──
    float gmask;
    vec3 ground = lookDownGround(vp, ax, yaw, uParallax.x, nightAmt, uGlass, gmask);
    col = mix(col, ground, gmask);

    // ── 見回すと現れる当時のランドマーク（方位は本人の記憶に基づく。佇まいのみ・固有名/看板は出さない） ──
    // 基準: 正面(yaw=0)=北。右へ振る(yaw+)=東、左(yaw-)=西。画面中心x = 0.5 + (方位 - yaw)/asp。
    // (北・徒歩1〜2分) 獅子ヶ谷小学校（校舎＋校庭）。近いので大きめ。
    {
      float sx = 0.5 + (0.0 - yaw) / asp;
      float yard = step(abs(vp.x - sx), 0.15) * step(0.434, vp.y) * step(vp.y, 0.458);   // 土の校庭
      col = mix(col, mix(vec3(0.64, 0.47, 0.35), uHorizon * 0.4, 0.3), yard * 0.85);
      col = longBuilding(col, vp, sx - 0.02, 0.092, 0.458, 0.508, mix(vec3(0.72, 0.69, 0.62), uHorizon * 0.4, 0.34), nightAmt);
      // （さらに北奥）二ツ池の水面がちらり
      float pond = step(abs(vp.x - (sx + 0.05)), 0.045) * step(0.47, vp.y) * step(vp.y, 0.482);
      col = mix(col, mix(uSkyMid, uHorizon, 0.4) * 0.92, pond * 0.6);
    }
    // (西すぐ) ユーパリノスの公園＝昔のサッカーのグラウンド（緑の芝＋ゴール）
    {
      float fx = 0.5 + (-1.1 - yaw) / asp;
      float pitchM = step(abs(vp.x - fx), 0.15) * step(0.44, vp.y) * step(vp.y, 0.468);
      col = mix(col, mix(vec3(0.26, 0.44, 0.24), uDropTint, 0.2), pitchM);
      float pl = pitchM * (smoothstep(0.003, 0.0, abs(vp.x - fx)) + smoothstep(0.003, 0.0, abs(vp.y - 0.454)));
      col = mix(col, vec3(0.82, 0.86, 0.82), clamp(pl, 0.0, 1.0) * 0.5);
      float goal = step(abs(abs(vp.x - fx) - 0.14), 0.004) * step(0.45, vp.y) * step(vp.y, 0.464);
      col = mix(col, vec3(0.9, 0.92, 0.9), goal * 0.7);
    }
    // (西〜南西) トップボーイ（ゲーム屋）。グラウンドの左手の箱型の店。
    {
      float gx = 0.5 + (-1.5 - yaw) / asp;
      float shop = step(abs(vp.x - gx), 0.030) * step(0.452, vp.y) * step(vp.y, 0.482);
      col = mix(col, mix(vec3(0.56, 0.50, 0.52), uHorizon * 0.4, 0.25), shop);
      col += mix(uSunGlow, vec3(1.0, 0.7, 0.4), 0.4) * step(abs(vp.x - gx), 0.022)
           * smoothstep(0.482, 0.476, vp.y) * step(0.47, vp.y) * (0.2 + 0.6 * nightAmt); // 店先の灯り
    }
    // (北西) 三ツ池公園（大きめ。3つの池＋緑）
    {
      float kx = 0.5 + (-0.55 - yaw) / asp;
      float park = step(abs(vp.x - kx), 0.16) * step(0.45, vp.y) * step(vp.y, 0.472);
      col = mix(col, mix(vec3(0.22, 0.40, 0.22), uDropTint, 0.3), park * 0.8);
      for (int ip = 0; ip < 3; ip++) {
        float pofs = (float(ip) - 1.0) * 0.06;
        float pw = step(abs(vp.x - (kx + pofs)), 0.026) * step(0.452, vp.y) * step(vp.y, 0.466);
        col = mix(col, mix(uSkyMid, uHorizon, 0.4) * 0.92, pw * 0.7);
      }
    }
    // (東・徒歩2分) 橘学苑（校舎＋テニスコート・グラウンド）
    {
      float tx = 0.5 + (1.1 - yaw) / asp;
      float gr = step(abs(vp.x - tx), 0.11) * step(0.44, vp.y) * step(vp.y, 0.46);
      col = mix(col, mix(vec3(0.40, 0.46, 0.28), uHorizon * 0.4, 0.3), gr * 0.85);
      float cnx = abs(vp.x - (tx - 0.05));
      float court = step(cnx, 0.05) * step(0.46, vp.y) * step(vp.y, 0.476);
      col = mix(col, mix(vec3(0.20, 0.42, 0.34), uHorizon * 0.3, 0.25), court);
      float lines = court * (smoothstep(0.004, 0.0, abs(vp.y - 0.468)) + smoothstep(0.003, 0.0, abs(cnx - 0.025)));
      col = mix(col, vec3(0.85, 0.88, 0.85), clamp(lines, 0.0, 1.0) * 0.6);
      col = longBuilding(col, vp, tx + 0.085, 0.05, 0.46, 0.505, mix(vec3(0.74, 0.72, 0.66), uHorizon * 0.4, 0.25), nightAmt);
    }
    // (東北東) 立花幼稚園（橘のすぐ北。小さな三角屋根の園舎）
    {
      float yx = 0.5 + (0.85 - yaw) / asp;
      float roofY2 = 0.468 + 0.016 * (1.0 - abs(vp.x - yx) / 0.04);
      float kbody = step(abs(vp.x - yx), 0.034) * step(0.452, vp.y) * step(vp.y, 0.468);
      float kroof = step(abs(vp.x - yx), 0.04) * step(0.468, vp.y) * step(vp.y, roofY2);
      col = mix(col, mix(vec3(0.86, 0.80, 0.62), uHorizon * 0.3, 0.2), kbody);   // 明るい園舎
      col = mix(col, mix(vec3(0.74, 0.40, 0.30), uHorizon * 0.3, 0.2), kroof);   // 赤い三角屋根
    }

    // ── 平成初期の街の大箱ランドマーク（佇まいのみ・固有名/文字/商標は一切出さない） ──
    // (北東) 大型スーパー（GMSの佇まい）: 平らな大屋根＋広い駐車場＋屋上看板帯。街いちばんの大箱。
    {
      float sx = 0.5 + (0.40 - yaw) / asp;
      float w = 0.14;
      float lot = step(abs(vp.x - sx), w) * step(0.478, vp.y) * step(vp.y, 0.492);
      col = mix(col, mix(vec3(0.42, 0.42, 0.44), uHorizon * 0.3, 0.25), lot * 0.85);   // 駐車場
      float carCell = floor((vp.x - sx) * 44.0);
      float car = lot * step(0.5, h11(carCell)) * smoothstep(0.006, 0.001, abs(fract((vp.x - sx) * 44.0) - 0.5));
      col = mix(col, 0.42 + 0.4 * cos(carCell * 1.7 + vec3(0.0, 2.0, 4.0)), car * 0.55); // 駐車中の車
      col = longBuilding(col, vp, sx, w, 0.492, 0.516, mix(vec3(0.80, 0.78, 0.73), uHorizon * 0.4, 0.22), nightAmt);
      float sign = step(abs(vp.x - sx), w * 0.72) * step(0.516, vp.y) * step(vp.y, 0.527);
      col = mix(col, mix(vec3(0.88, 0.86, 0.82), uSunGlow, 0.25 + 0.4 * nightAmt), sign * 0.85); // 屋上看板帯
    }
    // (北北西) パチンコ屋: けばけばしい外装＋縦長の塔看板＋夜にちかちか灯る（文字は出さない）
    {
      float px2 = 0.5 + (-0.28 - yaw) / asp;
      col = longBuilding(col, vp, px2, 0.05, 0.47, 0.505, mix(vec3(0.62, 0.50, 0.56), uHorizon * 0.4, 0.2), nightAmt);
      float tower2 = step(abs(vp.x - (px2 + 0.052)), 0.012) * step(0.47, vp.y) * step(vp.y, 0.55);
      float blink = 0.5 + 0.5 * sin(t * 3.0 + vp.y * 60.0);
      vec3 neon = mix(vec3(1.0, 0.3, 0.4), vec3(0.4, 0.7, 1.0), 0.5 + 0.5 * sin(vp.y * 30.0 + t));
      col = mix(col, neon, tower2 * (0.45 + 0.5 * nightAmt) * (0.5 + 0.5 * blink));   // 縦の塔看板
      col += neon * step(abs(vp.x - px2), 0.05) * smoothstep(0.5, 0.47, vp.y) * step(0.47, vp.y) * 0.16 * (0.4 + 0.6 * nightAmt);
    }
    // (東) 新装開店の電気屋＋祝賀のアドバルーン（空に浮かぶ紅白の気球＋下がる垂れ幕。文字は出さない）
    {
      float ex = 0.5 + (0.60 - yaw) / asp;
      col = longBuilding(col, vp, ex, 0.058, 0.47, 0.50, mix(vec3(0.70, 0.72, 0.74), uHorizon * 0.4, 0.2), nightAmt);
      col += mix(vec3(1.0, 0.4, 0.3), vec3(0.3, 0.6, 1.0), step(0.5, fract(vp.x * 120.0))) * step(abs(vp.x - ex), 0.05) * smoothstep(0.49, 0.47, vp.y) * step(0.47, vp.y) * 0.12; // 店先の幟
      float sway = sin(t * 0.5 * mo) * 0.012;
      vec2 bc = vec2(ax - ((0.60 - yaw) + sway), vp.y - 0.60);
      float balloon = smoothstep(0.046, 0.040, length(bc * vec2(1.0, 1.15)));
      vec3 balloonC = mix(vec3(0.93, 0.30, 0.28), vec3(0.96, 0.92, 0.86), step(0.0, sin(atan(bc.y, bc.x) * 6.0))); // 紅白
      col = mix(col, balloonC, balloon);
      col += vec3(1.0) * smoothstep(0.05, 0.0, length(bc - vec2(-0.015, 0.018))) * 0.22;     // 気球のハイライト
      float banner = step(abs(bc.x), 0.012) * step(-0.13, bc.y) * step(bc.y, -0.046);
      col = mix(col, vec3(0.95, 0.93, 0.88), banner * 0.85);
      col = mix(col, vec3(0.86, 0.26, 0.22), banner * step(0.5, fract(bc.y * 30.0)) * 0.7);   // 垂れ幕の紅白段
      float rope = smoothstep(0.003, 0.0, abs(bc.x + (vp.y - 0.60) * 0.04)) * step(0.50, vp.y) * step(vp.y, 0.556);
      col = mix(col, vec3(0.32, 0.30, 0.30), rope * 0.3);
    }
    // (南西) 中学校（小学校より大きい校舎＋広いグラウンド）
    {
      float mx2 = 0.5 + (-0.82 - yaw) / asp;
      float grnd = step(abs(vp.x - mx2), 0.13) * step(0.45, vp.y) * step(vp.y, 0.472);
      col = mix(col, mix(vec3(0.60, 0.45, 0.33), uHorizon * 0.4, 0.3), grnd * 0.85);          // 土のグラウンド
      col = longBuilding(col, vp, mx2 - 0.03, 0.10, 0.472, 0.512, mix(vec3(0.74, 0.71, 0.64), uHorizon * 0.4, 0.3), nightAmt);
    }

    // 地平の霞（遠景を空へなじませる。溶かし過ぎず街と尾根の量感を残す）
    col = mix(col, mix(uHorizon, uSkyMid, 0.4), smoothstep(0.50, 0.43, vp.y) * smoothstep(0.36, 0.45, vp.y) * 0.20);

    // ── 足元: 開けた屋上の床（柵・手すり・枠は無し＝遮るもののない眺め） ──
    // 防水シートのコンクリ床。覗き込み(uParallax)・見下ろし(pitch)で手前にせり上がり、
    // 縁の向こうに坂の街がそのまま覗く（身を乗り出すと下の路地まで）。
    float floorTop = 0.135 + uParallax.y * 0.6 + pitch * 0.75;
    float onFloor = smoothstep(floorTop, floorTop - 0.02, p.y);
    float depthF = max(floorTop - p.y, 0.0);                          // 0=縁 大=手前(足元)
    vec3 floorC = mix(vec3(0.33, 0.33, 0.35), uHorizon * 0.3, 0.18);  // 灰の防水シート
    floorC *= 0.90 + 0.16 * fbm(vec2(p.x * 9.0, depthF * 12.0));      // 汚れ・水たまりのムラ
    // 防水シートの継ぎ目（手前ほど広い格子）
    float seamX = smoothstep(0.05, 0.0, abs(fract(p.x * 7.0 + yaw) - 0.5));
    float seamY = smoothstep(0.04, 0.0, abs(fract(depthF * 9.0) - 0.5));
    floorC = mix(floorC, floorC * 0.78, clamp(max(seamX, seamY), 0.0, 1.0) * 0.4);
    floorC += uSunGlow * smoothstep(floorTop - 0.06, floorTop, p.y) * 0.10; // 縁に夕日
    floorC *= mix(0.55, 1.0, smoothstep(0.0, 0.14, p.y));            // 足元は陰
    col = mix(col, floorC, onFloor);
    // 床の縁の立ち上がりに陽＝屋上に立っている実感（手すりは無し＝開放感）
    col += uSunGlow * smoothstep(0.009, 0.0, abs(p.y - floorTop)) * 0.13;

    // 鳥（はばたきながら弧を描いて屋上の空を渡る）
    col = flyingBirds(col, vec2(ax + yaw * 0.5, vp.y), t, mo);

    col = applyGrade(col, frag);
    // 「かすみを払う」: 水彩のモヤを払い、遠くまで見通す澄んだ眺めに
    vec3 clearV = (col - 0.42) * 1.24 + 0.42;
    clearV = mix(vec3(dot(clearV, vec3(0.299, 0.587, 0.114))), clearV, 1.26);
    col = mix(col, clearV, uWindowOpen);
    col *= uBright;
    col -= max(col - vec3(0.92), 0.0) * 0.5;
    col += (h21(frag * uResolution.xy + t) - 0.5) * 0.007;
    gl_FragColor = vec4(col, 1.0);
  }
`

const QUALITY_DEFINES = {
  soft: '#define OCTAVES 5\n',
  standard: '#define OCTAVES 4\n',
  light: '#define OCTAVES 3\n',
}

export function buildFragment(quality) {
  const defines = QUALITY_DEFINES[quality] || QUALITY_DEFINES.standard
  const body = FRAGMENT_BODY
    .replace('//__GROUND__', GROUND_GLSL)
    .replace('void main()', GRADE_GLSL + '\n' + BIRDS_GLSL + '\n' + GODRAYS_GLSL + '\n  void main()')
  return defines + body
}
