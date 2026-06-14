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

    // ねぐらへ帰る鳥影（ゆっくり横切る小さなV字）。夕・朝の郷愁
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float bx = fract(uTime * 0.012 + fi * 0.27) * 2.6 - 1.3;       // 横移動
      float byb = 0.64 + fi * 0.035 + sin(uTime * 0.3 + fi) * 0.012; // 高さ（はばたき）
      vec2 bp = vec2((ax + yaw * 0.9) - bx, vp.y - byb);
      bp.x = abs(bp.x);
      float wing = smoothstep(0.010, 0.0, abs(bp.y - bp.x * 0.4)) * step(bp.x, 0.022);
      col = mix(col, col * 0.5, wing * 0.6);
    }

    // 奥→手前の街（高台から見下ろすので低めの地平）
    col = hills(col, vp, ax + yaw * 0.92, 0.48, mix(vec3(0.15, 0.21, 0.18), uHorizon, 0.45));
    col = town(col, vp, ax + yaw * 0.96, 0.44, 0.10, 0.05,
               mix(uDropTint, uHorizon, 0.32), uSunGlow, mix(0.30, 0.55, uIntensity), 60.0, 78.0, 1.3);

    // 空気遠近の霞: 地平のあたりで遠い街並みが空に溶ける（奥行き）
    float haze = smoothstep(0.52, 0.40, vp.y) * smoothstep(0.30, 0.46, vp.y);
    col = mix(col, mix(uHorizon, uSkyMid, 0.4), haze * 0.28);

    col = town(col, vp, ax + yaw * 1.02, 0.36, 0.16, 0.12,
               mix(uDropTint, uSkyMid, 0.10), uSunGlow, mix(0.45, 0.75, uIntensity), 34.0, 40.0, 7.1);
    col = town(col, vp, ax + yaw * 1.10, 0.24, 0.26, 0.17,
               uDropTint * 0.82, uSunGlow, mix(0.55, 0.9, uIntensity), 18.0, 22.0, 19.3);

    // 高層ビルの赤色航空障害灯（ゆっくり点滅）。日本の夜景の郷愁の決め手
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float bx = (h11(fi * 13.0 + 2.0) - 0.5) * 2.2;       // 世界上の横位置
      float by = 0.40 + h11(fi * 5.0 + 3.0) * 0.12;        // スカイライン上の高さ
      float wxr = ax + yaw * (1.0 + fi * 0.02);
      float d = length(vec2(wxr - bx, vp.y - by) * vec2(1.0, 1.35));
      float blink = smoothstep(0.45, 0.55, fract(uTime * 0.5 + fi * 0.37)); // ゆっくり点滅
      float beacon = exp(-d * 150.0) + exp(-d * 45.0) * 0.22;
      col += vec3(1.0, 0.12, 0.08) * beacon * blink * 0.9;
    }

    // ── 手前の商店街（見下ろす通り）。最下部に道・店の灯り・反射 ──
    float streetTop = 0.205;
    float st = smoothstep(streetTop, streetTop - 0.025, vp.y); // 1 = 通りの領域
    {
      float sx = ax + yaw * 1.18;                 // 通りは最も手前＝速く流れる
      float cellW = 0.052;
      float shopCell = floor(sx / cellW);
      float fxs = fract(sx / cellW) - 0.5;
      float sr = h11(shopCell + 7.0);
      float shopLit = step(0.30, sr);             // 多くの店が灯る商店街
      float sy = 0.105 + h11(shopCell + 2.0) * 0.04;
      // 店先の暖色グロー（提灯/看板を様式的に。固有名は出さない）
      vec3 shopHue = mix(uSunGlow, vec3(1.0, 0.55, 0.38), step(0.5, h11(shopCell + 5.0)));
      float sign = smoothstep(0.03, 0.0, abs(vp.y - sy)) * smoothstep(0.42, 0.0, abs(fxs));
      // 道路（暗く濡れて、灯りを縦に映す）
      vec3 road = mix(vec3(0.035, 0.035, 0.045), uHorizon * 0.10, 0.5);
      road += shopHue * sign * shopLit * 0.85;
      float refl = smoothstep(0.30, 0.0, abs(fxs)) * smoothstep(sy - 0.01, -0.08, vp.y);
      road += shopHue * refl * shopLit * 0.22;
      // 通り沿いの街灯
      float lampPh = fract(sx / 0.16) - 0.5;
      float lampY = 0.165 + h11(floor(sx / 0.16) + 3.0) * 0.02;
      float dl = length(vec2(lampPh * 0.16, vp.y - lampY) * vec2(1.0, 1.4));
      road += uSunGlow * (exp(-dl * 40.0) + exp(-dl * 11.0) * 0.3) * 0.9;
      // 通りを流れる車のヘッドライト（ゆっくり横切る）＋濡れた道の反射
      float carW = mix(-1.4, 1.4, fract(uTime * 0.045));
      float cd = length(vec2(sx - carW, (vp.y - 0.10) * 2.6));
      road += vec3(1.0, 0.93, 0.78) * exp(-cd * 26.0) * 0.85;
      road += vec3(1.0, 0.93, 0.78) * smoothstep(0.16, 0.0, abs(sx - carW)) * smoothstep(0.10, -0.06, vp.y) * 0.10;
      col = mix(col, road, st);
    }

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

    // マンションの面: 各戸にベランダ（手すり＋奥の陰）・窓・室外機
    vec2 cell = vec2(wx * 5.5, vp.y * 9.0 + 1.0); // 1セル=1戸
    vec2 cid = floor(cell); vec2 cf = fract(cell);
    float unitR = h21(cid + 41.0);
    float win = step(0.16, cf.x) * step(cf.x, 0.84) * step(0.46, cf.y) * step(cf.y, 0.86);
    float lit = step(0.86, unitR);
    vec3 wcol = mix(vec3(0.05, 0.05, 0.065), uSunGlow * 0.8, lit);
    float railing = smoothstep(0.035, 0.0, abs(cf.y - 0.32));        // 横手すりの線
    float balconyShade = step(0.05, cf.y) * step(cf.y, 0.44);        // 手すり下の陰
    float ac = step(0.30, cf.x) * step(cf.x, 0.55) * step(0.10, cf.y) * step(cf.y, 0.26)
             * step(0.5, h21(cid + 7.0));                            // 室外機（たまに）
    concrete = mix(concrete, concrete * 0.6, balconyShade * 0.5);    // ベランダ奥の陰
    concrete = mix(concrete, wcol, win * 0.85);                      // 窓
    concrete = mix(concrete, vec3(0.10, 0.10, 0.12), railing * 0.45); // 手すり
    concrete = mix(concrete, vec3(0.04, 0.04, 0.05), ac * 0.8);      // 室外機

    // 建物の角（左端＝こちらに近い稜線）。すぐ右は陰、稜線自体はかすかに光を受ける
    concrete *= mix(0.5, 1.0, smoothstep(0.0, 0.06, wx));
    concrete += vec3(0.08, 0.09, 0.11) * smoothstep(0.012, 0.0, wx);
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

    // ── 窓ガラスのうっすらした映り込み（“ガラス越し”の実在感。上ほど室内の暖色が乗る） ──
    float reflAmt = (0.025 + 0.05 * smoothstep(0.35, 1.0, wp.y)) * aperture;
    outside = mix(outside, outside * 0.86 + uSunGlow * 0.10 + vec3(0.015, 0.015, 0.02), reflAmt);

    // ── 室内（翳った壁・窓の見込み(reveal)・窓台・床に落ちる窓あかり） ──
    // 室内は暗い暖色グレー（窓を主役にするため翳らせる）。窓に近い壁ほど外光を受けて明るい。
    vec3 wallCol = mix(vec3(0.032, 0.028, 0.032), uHorizon * 0.12, 0.45);
    // アパーチャ縁から室内側への距離（負＝窓の外側＝室内）
    float edgeDist = min(min(wp.x - winL, winR - wp.x), min(wp.y - winB, winT - wp.y));
    float intoRoom = clamp(-edgeDist, 0.0, 0.5);
    float nearWin = smoothstep(0.30, 0.0, intoRoom);
    // 見込み（窓の縁のすぐ内側が壁の厚みで陰る＝開口の立体感）
    float reveal = smoothstep(0.0, 0.03, intoRoom) * smoothstep(0.14, 0.035, intoRoom);
    vec3 interior = wallCol * (0.42 + 0.75 * nearWin);
    interior += uSunGlow * nearWin * 0.05;
    interior *= 1.0 - reveal * 0.5;
    // 窓台（下の見込み＝水平面で外光を受けて明るい）
    float sillBand = smoothstep(winB, winB - 0.05, wp.y) * step(winL - 0.03, wp.x) * step(wp.x, winR + 0.03);
    interior = mix(interior, uSunGlow * 0.30 + vec3(0.045, 0.04, 0.045), sillBand * 0.6);
    // 窓の下の床に落ちる窓あかり（窓幅の内側で、手前へ向かって淡く減衰）
    float floorGlow = smoothstep(winB, winB - 0.34, wp.y)
                    * smoothstep(winL - 0.04, winL + 0.14, wp.x)
                    * smoothstep(winR + 0.04, winR - 0.14, wp.x);
    interior += uSunGlow * floorGlow * 0.05;

    // 窓枠（サッシ本体）。開口の縁の内側にハイライト
    vec3 sashCol = mix(vec3(0.05, 0.05, 0.06), vec3(0.15, 0.15, 0.17), nearWin);

    // 合成: 外（アパーチャ内）／室内（外側）／桟・サッシ（最前面）
    vec3 col = mix(interior, outside, aperture);
    col = mix(col, sashCol, bars * 0.96);

    // 室内全体のごく弱い周辺減光（奥行き）
    float vig = 1.0 - 0.34 * smoothstep(0.40, 1.25, distance(p, vec2(0.5, 0.52)));
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
