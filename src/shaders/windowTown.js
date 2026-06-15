// 情景「窓辺の下町」シリーズの主役シェーダー。
// 高台のアパートの一室の窓から見た、夕暮れの下町を多層パララックスで描く。
// 指スワイプで見回す（uPan）。瓦屋根・団地・電柱電線・灯る窓で郷愁を出す。画像は使わない。
// パレットの5色は他の情景と共通の名前で受け取り、ここでは空・残照・建物・窓灯りとして解釈する。

import { GLASS_GLSL } from './glass.js'
import { GRADE_GLSL } from './grade.js'
import { GROUND_GLSL } from './ground.js'

export const vertexSource = /* glsl */ `
  attribute vec2 aPosition;
  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const FRAGMENT_BODY = /* glsl */ `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uIntensity;  // 街の灯りの多さ 0..1
  uniform float uBright;
  uniform vec2 uPan;         // 見回し（指スワイプ）
  uniform vec2 uParallax;    // 身を乗り出す/覗き込む並進視差（近景ほど大きく）
  uniform float uReduceMotion; // モーション過敏配慮 0=通常 1=動きを止める
  uniform float uWindowOpen; // 窓を開けた度合い 0=閉(ガラス越し) 1=開(素通し)
  uniform float uSeason;     // 季節 0=春 1=夏 2=秋 3=冬
  uniform vec3 uSkyTop;      // 天頂（暮れの紫紺）
  uniform vec3 uSkyMid;      // 中空
  uniform vec3 uHorizon;     // 地平（茜）
  uniform vec3 uSunGlow;     // 残照・窓の灯り色
  uniform vec3 uDropTint;    // 建物のシルエット基色
  uniform float uGlass;      // 窓ガラスの現象 0=なし 1=雨 2=雪
  uniform float uFlash;      // 遠雷フラッシュ 0..1

  float h11(float n) { return fract(sin(n) * 43758.5453123); }

  float h21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = h21(i);
    float b = h21(i + vec2(1.0, 0.0));
    float c = h21(i + vec2(0.0, 1.0));
    float d = h21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < OCTAVES; i++) {
      s += a * vnoise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return s;
  }
//__GROUND__

  // 遠景の山なみ（盆地の街を囲む遠山）。3層の稜線、奥ほど青く霞む空気遠近。
  vec3 hills(vec3 col, vec2 p, float wx, float ridgeY, vec3 hcol) {
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float depth = fi / 2.0;
      float yb = ridgeY + 0.14 - depth * 0.085;
      float freq = mix(0.8, 2.1, depth);
      float amp = mix(0.06, 0.14, depth);
      float ridge = yb + (fbm(vec2(wx * freq + fi * 9.0, 0.0)) - 0.5) * amp * 2.0;
      vec3 haze = mix(uSkyMid, hcol, 0.62);
      vec3 c = mix(haze, hcol, depth);
      c += uSunGlow * smoothstep(0.0, 0.5, wx + 0.4) * (1.0 - depth) * 0.05;
      // 冬は稜線の上部が雪化粧
      float cap = step(1.5, uGlass) * smoothstep(ridge - 0.05, ridge - 0.006, p.y) * step(p.y, ridge);
      c = mix(c, vec3(0.90, 0.93, 0.97), cap * 0.72);
      col = mix(col, c, step(p.y, ridge));
    }
    return col;
  }

  // 街レイヤー（建物のシルエット＋灯る窓＋たまにTVアンテナ）を col に重ねる。
  // floorY = 建物の足元の高さ。これより下は塗らず通り（地面）に譲る＝見下ろしで無限に伸びない。
  vec3 town(
    vec3 col, vec2 p, float wx, float ridgeY, float cw, float amp,
    vec3 sil, vec3 light, float winLit, float winCols, float winRows, float seed, float antennaAmt, float floorY
  ) {
    float u = wx / cw + seed;
    float cell = floor(u);
    float fx = fract(u);
    float r = h11(cell * 1.37 + 3.1);
    float bw = 0.60 + 0.32 * h11(cell * 2.11 + 7.7);
    float bh = 0.05 + r * amp;
    float gap = step(bw, fx); // 1 = 建物の間（すき間）
    float roofType = h11(cell * 3.7 + 1.0);
    // 屋根: 平らな陸屋根（団地・ビル）が主、たまに瓦の三角屋根
    float peak = (roofType > 0.62) ? (0.5 - abs(fx - bw * 0.5) / max(bw, 0.001)) * amp * 0.7 : 0.0;
    float ridge = ridgeY + (gap > 0.5 ? -0.03 : bh + peak);
    float body = step(p.y, ridge) * step(floorY, p.y); // 足元(floorY)より下は地面に譲る
    // 建物の壁面: 黒いシルエットでなく、夕暮れの光を受けた“見える壁”に
    float facadeVar = 0.85 + 0.30 * h11(cell * 5.3 + 2.0);
    vec3 wallTone = mix(uHorizon, vec3(0.50, 0.46, 0.42), 0.5);
    vec3 silv = mix(sil, wallTone, 0.55) * facadeVar;
    silv *= 0.93 + 0.07 * step(0.5, fract(fx * 5.0)); // 縦パネルの目地
    col = mix(col, silv, body);

    // 窓のグリッド（建物本体のみ・三角屋根の頂部は除く）
    if (body > 0.5 && gap < 0.5) {
      vec2 wc = vec2(wx * winCols, p.y * winRows);
      vec2 wid = floor(wc);
      vec2 wf = fract(wc);
      float rect = step(0.18, wf.x) * step(wf.x, 0.82) * step(0.24, wf.y) * step(wf.y, 0.86);
      float below = step(p.y, ridgeY + bh - 0.012); // 屋根の少し下から窓
      float lit = step(1.0 - winLit, h21(wid + seed));
      lit *= 0.78 + 0.22 * sin(uTime * 1.3 + h21(wid) * 33.0); // ちらつき
      vec3 wcol = mix(silv * 1.25, light, lit);
      col = mix(col, wcol, rect * below * 0.9);
    }

    // TVアンテナ（昭和の郷愁）。陸屋根にたまに立つ。
    if (antennaAmt > 0.0 && gap < 0.5 && roofType <= 0.62) {
      float ax = abs(fx - bw * 0.5);
      float hasA = step(h11(cell * 7.7 + 4.0), antennaAmt);
      float mh = 0.045 + 0.02 * h11(cell + 8.0);
      float mast = step(ridge, p.y) * step(p.y, ridge + mh) * step(ax, 0.006);
      float bar = step(abs(p.y - (ridge + mh * 0.72)), 0.004) * step(ax, 0.03)
                + step(abs(p.y - (ridge + mh * 0.5)), 0.004) * step(ax, 0.022);
      col = mix(col, sil * 0.35, hasA * clamp(mast + bar, 0.0, 1.0) * 0.85);
    }
    return col;
  }

  void main() {
    vec2 frag = gl_FragCoord.xy / uResolution.xy;
    float asp = uResolution.x / uResolution.y;
    float t = uTime;
    vec2 p = frag;
    // 一人称の視界。横スワイプ=首を振る(ヨー)、縦=見上げ/見下ろし(ピッチ)。
    // 各レイヤーをほぼ一律に回し、向いた方向の景色が現れるようにする（広角の周辺は湾曲）。
    float yaw = uPan.x;
    float pitch = uPan.y;
    float ax = (p.x - 0.5) * asp;        // 画面内の水平角（中心0）
    float curve = -0.10 * ax * ax;       // 広角の周辺で地平がゆるく湾曲
    vec2 vp = vec2(p.x, p.y - pitch + curve);

    // 空（夕暮れ）: 下=茜、上=紫紺
    vec3 col = mix(uSkyMid, uSkyTop, smoothstep(0.52, 1.0, vp.y));
    col = mix(uHorizon, col, smoothstep(0.42, 0.62, vp.y));
    // 太陽のゆるやかな移ろい（街の陰影と同じ位相＝光源が一致）
    float sunAz = sin(uTime * 0.012 * (1.0 - uReduceMotion)) * 0.08;
    float sunY = 0.47 - (sin(uTime * 0.012) * 0.5 + 0.5) * 0.04;
    float westBias = 0.6 + 0.8 * smoothstep(0.5 + sunAz, -0.6 + sunAz, ax + yaw * 0.2);
    col += uSunGlow * exp(-abs(vp.y - 0.5) * 7.0) * 0.22 * westBias;
    col += uSunGlow * exp(-distance(vec2(ax + yaw * 0.2, vp.y), vec2(-0.5 + sunAz, sunY)) * 4.2) * 0.22; // 西の低い夕日

    // 夕焼け雲（2層・立体的。底が夕陽で染まり上面は翳る。ゆっくり流れて形が変わる）
    float cloudT = t * (1.0 - uReduceMotion);
    float westWarm = smoothstep(0.3, -0.5, ax + yaw * 0.2 - sunAz);
    float cloudband = 0.0;
    for (int L = 0; L < 2; L++) {
      float fl = float(L);
      vec2 cq = vec2(ax * 1.4 + yaw * (0.18 - fl * 0.07) + cloudT * (0.012 - fl * 0.005) + fl * 5.0, vp.y * (2.4 - fl * 0.8));
      vec2 cwarp = vec2(fbm(cq + 2.0), fbm(cq + 5.0)) - 0.5;
      float cl = fbm(cq + cwarp * 0.8);
      float clu = fbm(cq + vec2(0.0, 0.16) + cwarp * 0.8);
      float cb = smoothstep(0.52, 0.70, cl) * smoothstep(0.44, 1.0, vp.y);
      float underlit = smoothstep(-0.06, 0.10, clu - cl);
      vec3 cloudWarm = mix(uHorizon, uSunGlow, 0.55 + 0.30 * westWarm);
      vec3 cloudCool = mix(uSkyMid, uSkyTop, 0.4);
      col = mix(col, mix(cloudCool, cloudWarm, underlit), cb * (0.52 - fl * 0.14));
      cloudband = max(cloudband, cb);
    }

    // 遠雷フラッシュ: 夜空と雲がほのかに白む（雷鳴に同期）
    col += uFlash * (0.10 + 0.18 * cloudband) * vec3(0.82, 0.88, 1.0);

    // 奥→手前。回転はほぼ一律（手前ほどごくわずかに大きく＝自然な奥行き）
    col = hills(col, vp, ax + yaw * 0.30, 0.55, mix(vec3(0.15, 0.21, 0.18), uHorizon, 0.45));
    col = town(col, vp, ax + yaw * 0.45 + uParallax.x * 0.3, 0.50, 0.10, 0.06,
               mix(uDropTint, uHorizon, 0.32), uSunGlow, mix(0.25, 0.5, uIntensity), 60.0, 78.0, 1.3, 0.0, 0.40);

    // 空気遠近の霞: 地平のあたりで遠い街並みが空に溶ける（奥行き）
    float haze = smoothstep(0.60, 0.44, vp.y) * smoothstep(0.34, 0.50, vp.y);
    col = mix(col, mix(uHorizon, uSkyMid, 0.4), haze * 0.40);

    // 街あかりの照り返し（夜の湿った空気に滲む光害のドーム）
    float nightAmt = clamp(1.0 - dot(uSkyTop, vec3(1.2)), 0.0, 1.0);
    float cityHalo = smoothstep(0.78, 0.46, vp.y) * smoothstep(0.34, 0.50, vp.y);
    col += mix(uHorizon, uSunGlow, 0.5) * cityHalo * nightAmt * 0.20;

    col = town(col, vp, ax + yaw * 0.85 + uParallax.x * 0.8, 0.42, 0.16, 0.13,
               mix(uDropTint, uSkyMid, 0.10), uSunGlow, mix(0.40, 0.70, uIntensity), 34.0, 40.0, 7.1, 0.22, 0.33);
    col = town(col, vp, ax + yaw * 1.28 + uParallax.x * 1.4, 0.30, 0.26, 0.18,
               uDropTint * 0.82, uSunGlow, mix(0.50, 0.85, uIntensity), 18.0, 22.0, 19.3, 0.5, 0.20);

    // 地平の継ぎ目をなじませる: 立体の近景街と2Dの遠景スカイラインの境を霞で溶かす
    float seam = smoothstep(0.505, 0.44, vp.y) * smoothstep(0.40, 0.455, vp.y);
    col = mix(col, mix(uHorizon, uSkyMid, 0.5), seam * 0.5);

    // 高層ビルの赤色航空障害灯（ゆっくり点滅）
    for (int bi = 0; bi < 3; bi++) {
      float bfi = float(bi);
      float bx = (h11(bfi * 13.0 + 2.0) - 0.5) * 2.0;
      float by = 0.50 + h11(bfi * 5.0 + 3.0) * 0.12;
      float bd = length(vec2((ax + yaw * 0.4) - bx, vp.y - by) * vec2(1.0, 1.35));
      float bl = smoothstep(0.45, 0.55, fract(t * 0.5 + bfi * 0.37));
      col += vec3(1.0, 0.12, 0.08) * (exp(-bd * 150.0) + exp(-bd * 45.0) * 0.22) * bl * 0.85;
    }

    // ── 見下ろす街並み（地面のパース投影＝本当に高所から下を眺めている） ──
    float gmask;
    vec3 ground = lookDownGround(vp, ax, yaw, uParallax.x, nightAmt, uGlass, gmask);
    col = mix(col, ground, gmask);

    // 自分の建物の外壁（真下を覗くと、窓の下に自分の壁が続く＝乗り出して覗く実感）
    float lookDown = smoothstep(0.06, 0.32, pitch);
    if (lookDown > 0.001) {
      float ledgeY = -0.04 + 0.40 * lookDown + uParallax.y * 0.6;     // 壁の上端(庇)。見下ろすほどせり上がる
      float onWall = smoothstep(ledgeY, ledgeY - 0.015, p.y);
      float streak = fbm(vec2(p.x * 9.0, p.y * 2.2)) * 0.4 + fbm(vec2(p.x * 30.0, p.y * 0.6)) * 0.14;
      vec3 myWall = mix(vec3(0.085, 0.082, 0.092), vec3(0.155, 0.135, 0.125), streak);
      myWall += uSunGlow * 0.05 * smoothstep(ledgeY - 0.10, ledgeY, p.y);
      float eave = smoothstep(0.013, 0.0, abs(p.y - ledgeY));
      col = mix(col, myWall, onWall);
      col = mix(col, uSunGlow * 0.35 + vec3(0.06, 0.055, 0.05), eave * 0.6 * lookDown);
    }

    // 電線（手前・郷愁）。地平より上にだけ垂れる（見下ろし時は視界の外へ）。
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float wireVp = 0.64 + fi * 0.035 + sin((ax + yaw * 1.5 + uParallax.x * 1.6) * 2.2 + fi * 1.7) * 0.012;
      float yl = wireVp + pitch - curve; // vp→画面y（見上げで下、見下ろしで上へ逃げる）
      col = mix(col, vec3(0.02, 0.02, 0.04), smoothstep(0.0035, 0.0, abs(p.y - yl)) * 0.8 * step(0.43, wireVp));
    }

    // 窓ガラスの現象（雨・雪）を窓のガラス面に重ねる。窓を開けると素通しで消える。
    col = mix(applyGlass(col, p, t, uGlass), col, uWindowOpen);
    // 窓を開けると外気が澄んで景色が明るく鮮やかに
    col *= 1.0 + uWindowOpen * 0.08;
    col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.0 + uWindowOpen * 0.16);

    // レースカーテン（両脇。下町の窓辺にも室内の気配。中央は開けて見える）
    float curtSway = (sin(t * 0.4) * 0.008 + sin(t * 0.19 + 1.0) * 0.005) * (1.0 + uWindowOpen * 2.5);
    float cwid = 0.17 * (1.0 - uWindowOpen * 0.55);
    float gatherL = smoothstep(0.05 + cwid, 0.05, p.x - curtSway);
    float gatherR = smoothstep(0.95 - cwid, 0.95, p.x + curtSway);
    float gather = max(gatherL, gatherR);
    float curtFolds = 0.55 + 0.45 * sin(p.x * 95.0 + sin(p.y * 3.0 + t * 0.25) * 1.4);
    vec3 lace = mix(uSunGlow, vec3(0.96, 0.94, 0.90), 0.55) * (0.72 + 0.28 * curtFolds);
    col = mix(col, lace, gather * (0.22 + 0.16 * curtFolds));

    // 窓枠（最前景のサッシ・固定）
    float mx = 0.05, my = 0.05;
    float fr = max(max(step(p.x, mx), step(1.0 - mx, p.x)), max(step(p.y, my), step(1.0 - my, p.y)));
    float inner =
      smoothstep(mx, mx + 0.045, p.x) * smoothstep(mx, mx + 0.045, 1.0 - p.x) *
      smoothstep(my, my + 0.045, p.y) * smoothstep(my, my + 0.045, 1.0 - p.y);
    col *= mix(0.84, 1.0, inner);            // 枠の内側を少し翳らせる
    col = mix(col, vec3(0.05, 0.045, 0.06), fr); // サッシ本体

    col = applyGrade(col, frag); // 全情景共通の「記憶の風景」グレード＋水彩
    // 窓を開けたら水彩のモヤを払い、視界をくっきり晴らす
    vec3 clearV = (col - 0.42) * 1.22 + 0.42;
    clearV = mix(vec3(dot(clearV, vec3(0.299, 0.587, 0.114))), clearV, 1.24);
    col = mix(col, clearV, uWindowOpen);
    col *= uBright;
    col -= max(col - vec3(0.9), 0.0) * 0.5;  // 白とび防止
    col += (h21(frag * uResolution.xy + t) - 0.5) * 0.012;
    gl_FragColor = vec4(col, 1.0);
  }
`

const QUALITY_DEFINES = {
  soft: '#define OCTAVES 5\n',
  standard: '#define OCTAVES 4\n',
  light: '#define OCTAVES 3\n',
}

/** 品質に応じたフラグメントシェーダー文字列を組み立てる。ガラス現象の関数を main 直前に挿入する。 */
export function buildFragment(quality) {
  const defines = QUALITY_DEFINES[quality] || QUALITY_DEFINES.standard
  const body = FRAGMENT_BODY
    .replace('//__GROUND__', GROUND_GLSL) // 地面関数は town/main より前に定義する必要がある
    .replace('void main()', GLASS_GLSL + '\n' + GRADE_GLSL + '\n  void main()')
  return defines + body
}
