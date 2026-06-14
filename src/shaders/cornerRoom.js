// 窓辺シリーズの本命「高台の角部屋」。室内に立ち、窓から夕暮れの下町を見下ろす。
// ・室内は翳り、窓の外は明るい（“中にいて外を見ている”コントラスト）
// ・窓枠／桟／窓台で「本物の窓」をかたちづくる
// ・右を向く（uPan.x を増やす）と、隣のマンションの壁が迫って街を遮る＝角部屋の手応え
// 画像は使わず、街も壁も室内もすべて計算で描く。色5値は他情景と共通の名前で受け取る。

import { GLASS_GLSL } from './glass.js'
import { GRADE_GLSL } from './grade.js'

export const vertexSource = /* glsl */ `
  attribute vec2 aPosition;
  void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`

const FRAGMENT_BODY = /* glsl */ `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uIntensity;  // 街あかりの多さ 0..1
  uniform float uBright;
  uniform vec2 uPan;         // 見回し（x=ヨー, y=ピッチ）
  uniform float uGlass;      // 窓ガラスの現象 0=なし 1=雨 2=雪
  uniform float uFlash;      // 遠雷フラッシュ 0..1
  uniform vec3 uSkyTop;      // 天頂（暮れの紫紺）
  uniform vec3 uSkyMid;      // 中空
  uniform vec3 uHorizon;     // 地平（茜）
  uniform vec3 uSunGlow;     // 残照・窓あかり色
  uniform vec3 uDropTint;    // 建物のシルエット基色

  float h11(float n) { return fract(sin(n) * 43758.5453123); }
  float h21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float a = h21(i); float b = h21(i + vec2(1.0, 0.0));
    float c = h21(i + vec2(0.0, 1.0)); float d = h21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0; float a = 0.5;
    for (int i = 0; i < OCTAVES; i++) { s += a * vnoise(p); p *= 2.0; a *= 0.5; }
    return s;
  }

  // 遠い緑の稜線
  vec3 hills(vec3 col, vec2 p, float wx, float ridgeY, vec3 hcol) {
    float h = ridgeY + (fbm(vec2(wx * 1.3 + 5.0, 0.0)) - 0.5) * 0.10;
    return mix(col, hcol, step(p.y, h));
  }

  // 街レイヤー（建物のシルエット＋灯る窓）。windowTown を踏襲しつつ角部屋向けに調整。
  vec3 town(
    vec3 col, vec2 p, float wx, float ridgeY, float cw, float amp,
    vec3 sil, vec3 light, float winLit, float winCols, float winRows, float seed
  ) {
    float u = wx / cw + seed;
    float cell = floor(u);
    float fx = fract(u);
    float r = h11(cell * 1.37 + 3.1);
    float bw = 0.60 + 0.32 * h11(cell * 2.11 + 7.7);
    float bh = 0.05 + r * amp;
    float gap = step(bw, fx);
    float roofType = h11(cell * 3.7 + 1.0);
    float peak = (roofType > 0.66) ? (0.5 - abs(fx - bw * 0.5) / max(bw, 0.001)) * amp * 0.6 : 0.0;
    float ridge = ridgeY + (gap > 0.5 ? -0.03 : bh + peak);
    float body = step(p.y, ridge);
    vec3 silv = sil * (0.82 + 0.34 * h11(cell * 5.3 + 2.0));
    col = mix(col, silv, body);

    if (body > 0.5 && gap < 0.5) {
      vec2 wc = vec2(wx * winCols, p.y * winRows);
      vec2 wid = floor(wc);
      vec2 wf = fract(wc);
      float rect = step(0.18, wf.x) * step(wf.x, 0.82) * step(0.24, wf.y) * step(wf.y, 0.86);
      float below = step(p.y, ridgeY + bh - 0.012);
      float lit = step(1.0 - winLit, h21(wid + seed));
      lit *= 0.78 + 0.22 * sin(uTime * 1.3 + h21(wid) * 33.0);
      vec3 wcol = mix(silv * 1.25, light, lit);
      col = mix(col, wcol, rect * below * 0.9);
    }
    return col;
  }

  // 窓の外（空・街・隣の建物の壁）。vp=湾曲込みの視界座標, yaw/pitch=見回し。
  vec3 outsideView(vec2 vp, float ax, float yaw, float pitch) {
    // 空（夕暮れ）: 下=茜、上=紫紺
    vec3 col = mix(uSkyMid, uSkyTop, smoothstep(0.52, 1.0, vp.y));
    col = mix(uHorizon, col, smoothstep(0.40, 0.60, vp.y));
    col += uSunGlow * exp(-abs(vp.y - 0.46) * 7.0) * 0.20;

    // 夕焼け雲
    float cl = fbm(vec2(ax * 1.6 + yaw + uTime * 0.008, vp.y * 2.2));
    float cloudband = smoothstep(0.52, 0.82, cl) * smoothstep(0.44, 0.95, vp.y);
    col = mix(col, mix(uHorizon, uSunGlow, 0.45), cloudband * 0.4);

    // 遠雷フラッシュ（空がほのかに白む。雲のあたりを少し強く）
    col += uFlash * (0.10 + 0.16 * cloudband) * vec3(0.85, 0.9, 1.0);

    // 奥→手前の街（高台から見下ろすので低めの地平）
    col = hills(col, vp, ax + yaw * 0.92, 0.48, mix(vec3(0.15, 0.21, 0.18), uHorizon, 0.45));
    col = town(col, vp, ax + yaw * 0.96, 0.44, 0.10, 0.05,
               mix(uDropTint, uHorizon, 0.32), uSunGlow, mix(0.30, 0.55, uIntensity), 60.0, 78.0, 1.3);
    col = town(col, vp, ax + yaw * 1.02, 0.36, 0.16, 0.12,
               mix(uDropTint, uSkyMid, 0.10), uSunGlow, mix(0.45, 0.75, uIntensity), 34.0, 40.0, 7.1);
    col = town(col, vp, ax + yaw * 1.10, 0.24, 0.26, 0.17,
               uDropTint * 0.82, uSunGlow, mix(0.55, 0.9, uIntensity), 18.0, 22.0, 19.3);

    // 街あかりの点（手前の通り沿い）
    float lx = ax + yaw * 1.10;
    float lcell = floor(lx / 0.22);
    float lph = fract(lx / 0.22);
    float ly = 0.075 + h11(lcell + 3.0) * 0.02;
    float dl = length(vec2((lph - 0.5) * 0.22, vp.y - ly) * vec2(1.0, 1.3));
    float lamp = exp(-dl * 42.0) + exp(-dl * 12.0) * 0.35;
    col += uSunGlow * lamp * step(vp.y, 0.16) * 0.9;

    return col;
  }

  // 隣のマンションの壁（角部屋の右手）。world = ax + yaw。右を向くと迫り出して街を遮る。
  // 戻り: rgb=壁色, a=被覆マスク(0..1)
  vec4 neighborWall(vec2 p, vec2 vp, float ax, float yaw) {
    float world = ax + yaw * 1.12;       // 壁は手前なので少し速く動く
    float edge = 1.18;                    // 壁の左端（これより右が壁）。正面では見えない
    float cover = smoothstep(edge - 0.04, edge + 0.06, world);
    if (cover <= 0.001) return vec4(0.0);

    // コンクリの素地（こちらを向く陰の面なので暗く・やや青みのグレー）。縦の雨だれ汚れ。
    float wx = world - edge;
    float stain = fbm(vec2(wx * 5.0, p.y * 1.2)) * 0.5 + fbm(vec2(wx * 22.0, p.y * 0.5)) * 0.18;
    vec3 concrete = mix(vec3(0.12, 0.125, 0.145), vec3(0.075, 0.08, 0.10), stain);
    // 夕暮れの残照が上端だけにかすかに回り込む
    concrete += uSunGlow * 0.05 * smoothstep(0.6, 1.0, vp.y);

    // 規則的な小窓（多くは暗く、ごく一部だけ灯る）
    vec2 wc = vec2(wx * 11.0, vp.y * 18.0 + 2.0);
    vec2 wid = floor(wc); vec2 wf = fract(wc);
    float rect = step(0.26, wf.x) * step(wf.x, 0.74) * step(0.30, wf.y) * step(wf.y, 0.80);
    float lit = step(0.90, h21(wid + 41.0));
    vec3 wcol = mix(vec3(0.05, 0.05, 0.065), uSunGlow * 0.8, lit);
    concrete = mix(concrete, wcol, rect * 0.8);

    // 建物の角（左端＝こちらに近い稜線）を陰らせて立体に
    concrete *= mix(0.55, 1.0, smoothstep(0.0, 0.07, wx));
    return vec4(concrete, cover);
  }

  void main() {
    vec2 frag = gl_FragCoord.xy / uResolution.xy;
    float asp = uResolution.x / uResolution.y;
    float t = uTime;
    vec2 p = frag;

    float yaw = uPan.x;
    float pitch = uPan.y;
    float ax = (p.x - 0.5) * asp;
    float curve = -0.08 * ax * ax;            // 広角の周辺で地平がゆるく湾曲
    vec2 vp = vec2(p.x, p.y - pitch + curve);

    // ── 窓の外（街＋空＋隣の壁） ──
    vec3 outside = outsideView(vp, ax, yaw, pitch);
    vec4 wall = neighborWall(p, vp, ax, yaw);
    outside = mix(outside, wall.rgb, wall.a);

    // 窓の外に降る雨/雪（ガラス面の現象）。アパーチャ内だけに乗せる
    outside = applyGlass(outside, p, t, uGlass);

    // ── 窓のアパーチャ（室内に切られた窓の開口） ──
    // 窓は viewer に対して固定。少しだけ見回しに連動して視差（手前の枠がゆっくり動く）
    vec2 wp = p + vec2(yaw, pitch) * 0.012;
    float winL = 0.135, winR = 0.865, winB = 0.135, winT = 0.895;
    // 開口（角を少し丸める）
    float ax0 = smoothstep(winL, winL + 0.012, wp.x) * smoothstep(winR, winR - 0.012, wp.x);
    float ay0 = smoothstep(winB, winB + 0.012, wp.y) * smoothstep(winT, winT - 0.012, wp.y);
    float aperture = ax0 * ay0;

    // 桟（窓を上下2枚＋中央の縦框で田の字に近い割り付け）
    float barV = smoothstep(0.010, 0.0, abs(wp.x - 0.5)) * aperture;          // 中央の縦框
    float barH = smoothstep(0.010, 0.0, abs(wp.y - 0.52)) * aperture;         // 中央の横框
    float bars = clamp(max(barV, barH), 0.0, 1.0);

    // ── 室内（翳った壁・窓台・天井ぎわ） ──
    // 室内の基調は暗い暖色グレー。窓からの光が床と窓台にこぼれる。
    vec3 wallCol = mix(vec3(0.05, 0.045, 0.05), uHorizon * 0.16, 0.5);
    // 窓まわりの内壁の陰影（開口に近いほど窓あかりを受けて明るい）
    float nearWin = smoothstep(0.32, 0.0, min(min(wp.x - winL + 0.0, winR - wp.x), min(wp.y - winB, winT - wp.y)));
    vec3 interior = wallCol * (0.7 + 0.6 * nearWin);
    interior += uSunGlow * nearWin * 0.06;

    // 窓台（下のサッシの厚み）。開口のすぐ下に明るい桟
    float sill = smoothstep(winB, winB - 0.022, wp.y) * smoothstep(winB - 0.055, winB - 0.03, wp.y);
    interior = mix(interior, uSunGlow * 0.4 + vec3(0.06), sill * 0.8);

    // 窓枠（サッシ本体）。開口の縁
    float frameInner = max(ax0 * ay0, 0.0);
    float sash = (1.0 - frameInner);
    // サッシは暗いアルミ。内側の縁にハイライト
    vec3 sashCol = mix(vec3(0.06, 0.06, 0.07), vec3(0.16, 0.16, 0.18), nearWin);

    // 合成: まず外（アパーチャ内）と室内（外側）
    vec3 col = mix(interior, outside, aperture);
    // 桟・サッシを最前面に（暗いアルミ＋内側ハイライト）
    col = mix(col, sashCol, bars * 0.96);

    // 室内全体のごく弱い周辺減光（奥行き）
    float vig = 1.0 - 0.30 * smoothstep(0.40, 1.25, distance(p, vec2(0.5, 0.52)));
    col *= vig;

    col = applyGrade(col); // 全情景共通の「記憶の風景」グレード
    col *= uBright;
    col -= max(col - vec3(0.92), 0.0) * 0.5; // 白とび防止
    col += (h21(frag * uResolution.xy + t) - 0.5) * 0.012;
    gl_FragColor = vec4(col, 1.0);
  }
`

const QUALITY_DEFINES = {
  soft: '#define OCTAVES 5\n',
  standard: '#define OCTAVES 4\n',
  light: '#define OCTAVES 3\n',
}

/** 品質に応じたフラグメントシェーダー文字列を組み立てる。ガラス現象とグレードを main 直前に挿入。 */
export function buildFragment(quality) {
  const defines = QUALITY_DEFINES[quality] || QUALITY_DEFINES.standard
  const body = FRAGMENT_BODY.replace('void main()', GLASS_GLSL + '\n' + GRADE_GLSL + '\n  void main()')
  return defines + body
}
