// 窓辺シリーズ番外「北寺尾の屋上、谷戸を一望」。作者が馴染んだ7階建てマンション（サンライズ北寺尾を想起）の
// 屋上の抜けた区画から、開けた空の下で周囲を見回す“ほぼ360°”のパノラマ。横浜市鶴見区北寺尾〜獅子ヶ谷の
// 昭和後期〜平成初期の風景を、地形と佇まいで再現する（実在の商標・看板・固有意匠は模さない）。
//  ・坂の住宅地が谷へ広がる（見下ろす街＝共有のレイマーチ地面を流用）
//  ・尾根を覆う森（獅子ヶ谷市民の森）
//  ・見回すと現れるランドマーク: 小学校（校舎＋校庭）／学園のテニスコート・グラウンド／
//    サッカーのグラウンド＋その左手のゲーム屋（いずれも佇まいのみ・固有名は出さない）
//  ・足元は屋上のパラペットと手すり（窓でなく開けた屋上）

import { GROUND_GLSL } from './ground.js'
import { GRADE_GLSL } from './grade.js'

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
    vec3 wc = wallC * (1.0 - 0.5 * nightAmt);
    // 窓の列（横帯×縦割り）
    float fy = (vp.y - baseY) / max(topY - baseY, 0.001);
    float floors = smoothstep(0.25, 0.4, fract(fy * 4.0)) * smoothstep(0.9, 0.75, fract(fy * 4.0));
    float cols = smoothstep(0.2, 0.32, fract((vp.x - cxScreen) * 90.0)) * smoothstep(0.85, 0.72, fract((vp.x - cxScreen) * 90.0));
    float win = floors * cols;
    vec3 winC = mix(wc * 0.8, mix(uSunGlow, vec3(1.0, 0.92, 0.7), 0.3), 0.3 + 0.6 * nightAmt);
    wc = mix(wc, winC, win * 0.8);
    wc += uSunGlow * 0.06; // 陽
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

    // ── 遠景の森の尾根（市民の森）。ぐるりを囲む丘 ──
    float wx = ax + yaw * 0.55;
    col = forestRidge(col, vp, wx + 3.0, 0.55, 0.09, mix(uDropTint, uSkyMid, 0.5));
    col = forestRidge(col, vp, wx,       0.50, 0.07, mix(uDropTint, uSkyMid, 0.34));

    // ── 坂の住宅地（屋上から見下ろす街。共有のレイマーチ地面を流用） ──
    float gmask;
    vec3 ground = lookDownGround(vp, ax, yaw, uParallax.x, nightAmt, uGlass, gmask);
    col = mix(col, ground, gmask);

    // ── 見回すと現れる当時のランドマーク（佇まいのみ。固有の看板・名称は出さない） ──
    // 各ランドマークは“世界の方位”に固定。画面上の中心 = 方位 - yaw。地平の少し上に建つ。
    // (1) 小学校（校舎＋校庭）。やや左後ろの方位。
    {
      float sx = 0.5 + (-0.9 - yaw) / asp;            // 画面x（方位-0.9）
      col = longBuilding(col, vp, sx, 0.085, 0.45, 0.50, mix(vec3(0.78, 0.74, 0.66), uHorizon * 0.4, 0.25), nightAmt);
      // 校庭（土の広場＝淡い赤茶の帯）
      float yard = step(abs(vp.x - (sx + 0.02)), 0.10) * step(0.43, vp.y) * step(vp.y, 0.452);
      col = mix(col, mix(vec3(0.62, 0.45, 0.34), uHorizon * 0.4, 0.3), yard * 0.8);
    }
    // (2) 学園のグラウンド＋テニスコート。右手前の方位。
    {
      float tx = 0.5 + (0.7 - yaw) / asp;
      // グラウンド（草＋土）
      float gr = step(abs(vp.x - tx), 0.12) * step(0.435, vp.y) * step(vp.y, 0.46);
      col = mix(col, mix(vec3(0.40, 0.46, 0.28), uHorizon * 0.4, 0.3), gr * 0.85);
      // テニスコート（コートの面＋白線。緑〜青の硬式コート）
      float cnx = abs(vp.x - (tx - 0.05));
      float court = step(cnx, 0.045) * step(0.452, vp.y) * step(vp.y, 0.468);
      vec3 courtC = mix(vec3(0.20, 0.42, 0.34), uHorizon * 0.3, 0.25);
      col = mix(col, courtC, court);
      float lines = court * (smoothstep(0.004, 0.0, abs(vp.y - 0.460)) + smoothstep(0.003, 0.0, abs(cnx - 0.02)));
      col = mix(col, vec3(0.85, 0.88, 0.85), clamp(lines, 0.0, 1.0) * 0.6);
      // 校舎
      col = longBuilding(col, vp, tx + 0.08, 0.05, 0.45, 0.495, mix(vec3(0.74, 0.72, 0.66), uHorizon * 0.4, 0.25), nightAmt);
    }
    // (3) サッカーのグラウンド（緑の芝＋ゴール）＋左手にゲーム屋。正面やや右の方位。
    {
      float fx = 0.5 + (0.1 - yaw) / asp;
      float pitchM = step(abs(vp.x - fx), 0.14) * step(0.44, vp.y) * step(vp.y, 0.466);
      vec3 pitchC = mix(vec3(0.26, 0.44, 0.24), uDropTint, 0.2);   // 芝のグラウンド
      col = mix(col, pitchC, pitchM);
      // 白線（センター/タッチ）
      float pl = pitchM * (smoothstep(0.003, 0.0, abs(vp.x - fx)) + smoothstep(0.003, 0.0, abs(vp.y - 0.453)));
      col = mix(col, vec3(0.82, 0.86, 0.82), clamp(pl, 0.0, 1.0) * 0.5);
      // ゴール（両端に小さな白枠）
      float goal = step(abs(abs(vp.x - fx) - 0.13), 0.004) * step(0.448, vp.y) * step(vp.y, 0.462);
      col = mix(col, vec3(0.9, 0.92, 0.9), goal * 0.7);
      // ゲーム屋（グラウンド左手の箱型の店。看板は描かず佇まいだけ）
      float sx2 = fx - 0.20;
      float shop = step(abs(vp.x - sx2), 0.028) * step(0.45, vp.y) * step(vp.y, 0.475);
      vec3 shopC = mix(vec3(0.55, 0.50, 0.52), uHorizon * 0.4, 0.25);
      col = mix(col, shopC, shop);
      // 店先の小さな灯り（夜ほど）
      col += mix(uSunGlow, vec3(1.0, 0.7, 0.4), 0.4) * step(abs(vp.x - sx2), 0.02) * smoothstep(0.475, 0.47, vp.y) * step(0.467, vp.y) * (0.2 + 0.6 * nightAmt);
    }

    // 地平の霞（遠景を空へなじませる）
    col = mix(col, mix(uHorizon, uSkyMid, 0.4), smoothstep(0.50, 0.43, vp.y) * smoothstep(0.36, 0.45, vp.y) * 0.35);

    // ── 足元: 屋上のパラペット（立ち上がり）と手すり（開けた屋上＝窓でない） ──
    // 屋上の床のコンクリ笠木が手前に。覗き込み(uParallax)・見下ろし(pitch)でせり上がる。
    float paraTop = 0.20 + uParallax.y * 0.5 + pitch * 0.5;
    float onPara = smoothstep(paraTop, paraTop - 0.015, p.y);
    vec3 paraC = mix(vec3(0.46, 0.44, 0.43), uHorizon * 0.3, 0.22);   // コンクリの笠木（明るめで存在感）
    paraC *= 0.88 + 0.12 * fbm(vec2(p.x * 16.0, p.y * 5.0));          // 汚れ・ムラ
    paraC += uSunGlow * smoothstep(paraTop - 0.04, paraTop, p.y) * 0.16; // 上端に陽
    paraC *= mix(0.7, 1.0, smoothstep(0.0, 0.10, p.y));              // 足元は陰
    col = mix(col, paraC, onPara);
    // 笠木の上端のハイライト（縁の立ち上がり）
    col += uSunGlow * smoothstep(0.010, 0.0, abs(p.y - paraTop)) * 0.18;
    // 手すり（笠木の上に水平のパイプ＋支柱）
    float railY = paraTop + 0.045;
    float rail = smoothstep(0.006, 0.0, abs(p.y - railY));
    float post = smoothstep(0.005, 0.0, abs(fract((p.x + yaw * 0.3) * 7.0) - 0.5)) * step(p.y, railY) * step(paraTop + 0.005, p.y);
    col = mix(col, vec3(0.16, 0.16, 0.18), clamp(max(rail, post * 0.85), 0.0, 1.0) * 0.8 * step(p.y, railY + 0.008));

    // 鳥影
    for (int bi = 0; bi < 2; bi++) {
      float bfi = float(bi);
      float bx = fract(t * 0.010 * mo + bfi * 0.4) * 2.6 - 1.3;
      float by = 0.70 + bfi * 0.03 + sin(t * 0.3 + bfi) * 0.012;
      vec2 bp = vec2((ax + yaw * 0.5) - bx, vp.y - by); bp.x = abs(bp.x);
      float wing = smoothstep(0.009, 0.0, abs(bp.y - bp.x * 0.4)) * step(bp.x, 0.020);
      col = mix(col, col * 0.55, wing * 0.55);
    }

    col = applyGrade(col, frag);
    col *= uBright;
    col -= max(col - vec3(0.92), 0.0) * 0.5;
    col += (h21(frag * uResolution.xy + t) - 0.5) * 0.012;
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
    .replace('void main()', GRADE_GLSL + '\n  void main()')
  return defines + body
}
