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
  uniform float uFoliage;    // 季節の舞い 0=なし 1=紅葉 2=花びら
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

  // 住宅街の一区画。cell ごとに建物タイプ（一軒家/商店/アパート/中層/空き地）を抽選し、
  // 屋根・高さ・灯りを描き分ける。profile: 1=手前の家並み, 0.5=中景の商店街, 0=遠景。
  vec3 town(
    vec3 col, vec2 p, float wx, float ridgeY, float cw, float amp,
    vec3 sil, vec3 light, float winLit, float seed, float profile
  ) {
    float u = wx / cw + seed;
    float cell = floor(u);
    float fx = fract(u);
    float bt = h11(cell * 9.1 + seed * 2.0);          // タイプ抽選
    float bw = 0.58 + 0.34 * h11(cell * 2.11 + 7.7);  // 間口

    // 空き地（抜け）: 手前ほど多い。住宅街は隙間がある＝密度の緩急
    float emptyTh = mix(0.06, 0.18, profile);
    float isEmpty = step(bt, emptyTh);
    float t2 = clamp((bt - emptyTh) / (1.0 - emptyTh), 0.0, 1.0);
    // 手前ほど一軒家が多い住宅街。中層は遠景にだけ、ごくたまに突き出るアクセント。
    float houseTh = mix(0.42, 0.70, profile);
    float aptHi = houseTh + 0.18;
    float isShop  = step(houseTh, t2) * step(t2, aptHi) * step(0.35, profile); // 商店（看板の灯り）
    float isHouse = step(t2, houseTh);                              // 一軒家（低・三角屋根）
    float isApt   = step(aptHi, t2) * step(t2, 0.93);              // アパート/長屋（2階建て）
    float isMid   = step(0.93, t2) * (1.0 - step(0.3, profile));   // 中層は遠景のみ・まれ
    isApt += (1.0 - step(0.35, profile)) * step(houseTh, t2) * step(t2, aptHi); // 遠景は商店枠→アパート
    isApt += step(0.93, t2) * step(0.3, profile);                  // 手前/中景の最上枠→アパート（中層化させない）

    float gap = max(step(bw, fx), isEmpty);
    float fxc = clamp(fx / max(bw, 0.001), 0.0, 1.0);
    float d = abs(fxc - 0.5);

    // 高さ: 住宅は低く、アパートは2階建て、中層だけ高い（遠景のみ）
    float bh = amp * (isHouse * 0.5 + isShop * 0.42 + isApt * 0.6 + isMid * 1.7) + 0.025;
    float peak = isHouse * (0.5 - d) * amp * 0.55;                   // 切妻屋根
    float ridge = ridgeY + (gap > 0.5 ? -0.04 : bh + max(peak, 0.0));
    float body = step(p.y, ridge) * (1.0 - gap);
    vec3 silv = sil * (0.80 + 0.34 * h11(cell * 5.3 + 2.0));
    col = mix(col, silv, body);

    // 一軒家の屋根を「いぶし瓦の青灰」に塗り分ける（壁より暗い＝住宅らしさの決め手）
    float wallTop = ridgeY + bh;
    float roofMask = isHouse * step(p.y, ridge) * step(wallTop - 0.006, p.y) * (1.0 - gap);
    vec3 roofCol = mix(vec3(0.17, 0.19, 0.25), uHorizon * 0.35, 0.3);
    col = mix(col, roofCol, roofMask);
    // 瓦のテカリ（屋根の稜線に夕日が片側だけ乗る）
    float roofBand = smoothstep(0.012, 0.0, abs(p.y - ridge)) * roofMask;
    col += uSunGlow * roofBand * 0.20 * smoothstep(0.2, 0.85, fx);

    if (body > 0.5) {
      float vfrac = (p.y - ridgeY) / max(ridge - ridgeY, 0.02);      // 0=base 1=屋根
      float cols = isHouse * 2.0 + isShop * 3.0 + isApt * 4.0 + isMid * 5.0 + 1.0;
      float rows = isHouse * 2.0 + isShop * 2.0 + isApt * 3.0 + isMid * 8.0 + 1.0;
      vec2 wc = vec2(fxc * cols, vfrac * rows);
      vec2 wid = floor(wc); vec2 wf = fract(wc);
      float rect = step(0.22, wf.x) * step(wf.x, 0.78) * step(0.28, wf.y) * step(wf.y, 0.84);
      float litR = h21(wid + cell + seed);
      float lit = step(1.0 - winLit, litR);
      lit *= 0.9 + 0.1 * sin(uTime * 0.7 + litR * 33.0);            // ちらつきは控えめに
      vec3 wcol = mix(silv * 1.18, light, lit);
      float onWall = max(1.0 - isHouse, step(p.y, wallTop + 0.004)); // 一軒家は窓を壁だけに
      col = mix(col, wcol, rect * 0.9 * onWall);

      // 商店の看板帯（1階の高さに横長の発光。暖色 or 白を抽選。文字は描かない）
      float band = isShop * smoothstep(0.06, 0.0, abs(vfrac - 0.20)) * step(0.08, fxc) * step(fxc, 0.92);
      vec3 signCol = mix(uSunGlow, vec3(0.85, 0.92, 1.0), step(0.5, h11(cell + 5.0)));
      col = mix(col, signCol, band * 0.85);
    }

    // 屋上の貯水タンク/物干し（アパート・中層の陸屋根に小さく）
    float tank = (isApt + isMid) * step(p.y, ridge + 0.025) * step(ridge, p.y)
               * step(abs(fxc - 0.5), 0.10) * (1.0 - gap);
    col = mix(col, uDropTint * 0.5, tank * 0.7);
    return col;
  }

  // 季節の舞い: 紅葉/花びらが窓の外をひらひら落ちる（3層・回転・横揺れ）
  vec3 foliageOverlay(vec3 col, vec2 p, float t, float mode) {
    if (mode < 0.5) return col;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float depth = fi * 0.5;
      float sc = mix(6.0, 12.0, depth);
      float sp = mix(0.035, 0.08, depth);
      vec2 gp = vec2(p.x * sc * 0.7, p.y * sc);
      gp.y += t * sp * sc;                                   // 落下
      gp.x += sin(t * 0.5 + fi * 2.0 + p.y * 7.0) * 0.9;     // 横揺れ
      vec2 id = floor(gp);
      vec2 f = fract(gp) - 0.5;
      float n = h21(id + fi * 23.0);
      if (n < 0.74) continue;                                // ぐっとまばらに（静けさ優先）
      float ang = t * 1.6 * (n - 0.5) * 2.0 + n * 6.2831;    // 回転
      float ca = cos(ang), sa = sin(ang);
      vec2 rf = vec2(ca * f.x - sa * f.y, sa * f.x + ca * f.y);
      float leaf = smoothstep(0.16, 0.08, length(rf * vec2(1.0, 2.2))); // 小さめの葉
      vec3 lc = (mode > 1.5)
        ? mix(vec3(0.98, 0.84, 0.88), vec3(0.95, 0.74, 0.80), n)  // 花びら（淡紅）
        : mix(vec3(0.78, 0.46, 0.22), vec3(0.64, 0.32, 0.18), n); // 紅葉（落ち着いた橙茶）
      col = mix(col, lc, leaf * (0.24 + 0.30 * depth));
    }
    return col;
  }

  // 窓の外（空・街・隣の建物の壁）。vp=湾曲込みの視界座標, yaw/pitch=見回し。
  vec3 outsideView(vec2 vp, float ax, float yaw, float pitch) {
    // 空（夕暮れ）: 下=茜、上=紫紺
    vec3 col = mix(uSkyMid, uSkyTop, smoothstep(0.52, 1.0, vp.y));
    col = mix(uHorizon, col, smoothstep(0.40, 0.60, vp.y));
    col += uSunGlow * exp(-abs(vp.y - 0.46) * 7.0) * 0.20;

    // 夕焼け雲（立体的に。底が夕陽で染まり、上面は翳る＝下からの光）
    vec2 cq = vec2(ax * 1.4 + yaw + uTime * 0.008, vp.y * 2.4);
    vec2 cwarp = vec2(fbm(cq + 2.0), fbm(cq + 5.0)) - 0.5;
    float cl = fbm(cq + cwarp * 0.7);
    float clu = fbm(cq + vec2(0.0, 0.18) + cwarp * 0.7);      // 少し上の密度
    float cloudband = smoothstep(0.50, 0.72, cl) * smoothstep(0.42, 0.98, vp.y);
    float underlit = smoothstep(-0.05, 0.08, clu - cl);       // 底面ほど夕陽を受ける
    vec3 cloudWarm = mix(uHorizon, uSunGlow, 0.6);            // 夕陽に染まる底
    vec3 cloudCool = mix(uSkyMid, uSkyTop, 0.4);             // 翳る上面
    col = mix(col, mix(cloudCool, cloudWarm, underlit), cloudband * 0.5);

    // 上空（見上げの報酬）: 高い所に薄い巻雲のすじ＋天頂をわずかに締める
    float high = smoothstep(0.72, 1.05, vp.y);
    float cirrus = fbm(vec2(ax * 0.8 + yaw * 0.7 + uTime * 0.004, vp.y * 5.0 - 1.0));
    col = mix(col, mix(col, uSunGlow, 0.22), high * smoothstep(0.5, 0.78, cirrus) * 0.35);
    col *= 1.0 - high * 0.05;

    // 遠雷フラッシュ（空がほのかに白む。雲のあたりを少し強く）
    col += uFlash * (0.10 + 0.16 * cloudband) * vec3(0.85, 0.9, 1.0);

    // 夜の度合い（空が暗いほど1）。月・観覧車・星を夜ほど強く出すための係数
    float nightAmt = clamp(1.0 - dot(uSkyTop, vec3(1.2)), 0.0, 1.0);

    // 月（far なのでゆっくり動く。淡いハロつき）
    vec2 mn = vec2(-0.72, 0.80);
    float md = length(vec2((ax + yaw * 0.85) - mn.x, vp.y - mn.y));
    float moonDisc = smoothstep(0.05, 0.043, md);
    float moonTex = 0.92 + 0.08 * fbm(vec2((ax + yaw * 0.85) * 30.0, vp.y * 30.0));
    col = mix(col, vec3(0.96, 0.95, 0.90) * moonTex, moonDisc * (0.35 + 0.5 * nightAmt));
    col += vec3(0.9, 0.92, 1.0) * exp(-md * 13.0) * (0.05 + 0.10 * nightAmt);

    // 星（夜空に静かに在る。またたかせない＝止まった時間）
    vec2 sg = vec2((ax + yaw * 0.8) * 14.0, vp.y * 14.0);
    vec2 sid = floor(sg);
    float sn = h21(sid + 3.0);
    float star = step(0.95, sn) * smoothstep(0.05, 0.0, length(fract(sg) - 0.5))
               * smoothstep(0.62, 0.85, vp.y);
    col += vec3(0.9, 0.93, 1.0) * star * nightAmt * 0.7;

    // 帰る鳥影（ごくたまに、ゆっくり）。2羽だけ＝静けさを保つ
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      float bx = fract(uTime * 0.008 + fi * 0.5) * 2.6 - 1.3;
      float byb = 0.66 + fi * 0.05 + sin(uTime * 0.25 + fi) * 0.010;
      vec2 bp = vec2((ax + yaw * 0.9) - bx, vp.y - byb);
      bp.x = abs(bp.x);
      float wing = smoothstep(0.009, 0.0, abs(bp.y - bp.x * 0.4)) * step(bp.x, 0.020);
      col = mix(col, col * 0.55, wing * 0.5);
    }

    // 時間とともに窓に灯がともる（夕暮れが深まる郷愁）
    float litRamp = 0.7 + 0.3 * smoothstep(0.0, 90.0, uTime);

    // 奥→手前の住宅街（遠景=低い家＋たまに中層 / 中景=商店街 / 手前=家並み）
    col = hills(col, vp, ax + yaw * 0.92, 0.50, mix(vec3(0.15, 0.21, 0.18), uHorizon, 0.45));
    col = town(col, vp, ax + yaw * 0.96, 0.46, 0.085, 0.05,
               mix(uDropTint, uHorizon, 0.32), uSunGlow, mix(0.22, 0.45, uIntensity) * litRamp, 1.3, 0.0);

    // 空気遠近の霞: 地平で遠い街並みが空に溶ける（奥行き＝退色＝郷愁）
    float haze = smoothstep(0.54, 0.40, vp.y) * smoothstep(0.30, 0.46, vp.y);
    col = mix(col, mix(uHorizon, uSkyMid, 0.4), haze * 0.40);

    col = town(col, vp, ax + yaw * 1.02, 0.40, 0.14, 0.11,
               mix(uDropTint, uSkyMid, 0.10), uSunGlow, mix(0.32, 0.55, uIntensity) * litRamp, 7.1, 0.5);
    col = town(col, vp, ax + yaw * 1.12, 0.32, 0.20, 0.15,
               uDropTint * 0.82, uSunGlow, mix(0.30, 0.55, uIntensity) * litRamp, 19.3, 1.0);

    // 電柱・電線（昭和の住宅街の象徴）。数本だけ、静かに
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float yl = 0.31 + fi * 0.018 + sin((ax + yaw * 1.12) * 2.0 + fi * 1.7) * 0.010;
      col = mix(col, vec3(0.03, 0.03, 0.04), smoothstep(0.0028, 0.0, abs(vp.y - yl)) * 0.7);
    }
    float poleW = ax + yaw * 1.12;
    float pole = step(abs(fract(poleW / 0.5) - 0.5), 0.010) * step(vp.y, 0.40) * step(0.27, vp.y)
               * step(0.5, h11(floor(poleW / 0.5) + 11.0));
    col = mix(col, vec3(0.03, 0.03, 0.04), pole * 0.7);

    // 遠くの高い建物の赤い灯（点滅させず、静かに灯す。1〜2基）
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      float bx = (h11(fi * 13.0 + 2.0) - 0.5) * 1.8;
      float by = 0.46 + h11(fi * 5.0 + 3.0) * 0.08;
      float bd = length(vec2((ax + yaw) - bx, vp.y - by) * vec2(1.0, 1.35));
      col += vec3(0.9, 0.18, 0.12) * (exp(-bd * 160.0) + exp(-bd * 55.0) * 0.16) * (0.35 + 0.35 * nightAmt);
    }

    // ── 見下ろす通り（手前の道路。下を向くと画面に広がる。車は置かず静かに） ──
    float streetTop = 0.27;
    float st = smoothstep(streetTop, streetTop - 0.07, vp.y); // 1 = 通りの領域（帯を広く）
    {
      float depth = clamp((streetTop - vp.y) / 0.5, 0.0, 1.0);     // 0=手前 1=奥(消失点)
      float vanish = yaw * 0.12;
      float persX = (ax - vanish) / max(1.0 - depth * 0.8, 0.14);  // 消失点へ収束
      // 濡れたアスファルト（奥は霞む）
      vec3 road = mix(vec3(0.05, 0.05, 0.062), uHorizon * 0.12, depth * 0.8);
      // センターライン（破線・奥ほど詰まる＝パース）
      float center = step(abs(persX), 0.02) * step(0.45, fract(depth * 20.0)) * (1.0 - depth * 0.5);
      road = mix(road, vec3(0.6, 0.58, 0.5), center * 0.5);
      // 店先・自販機の灯り（道の両脇から、奥へ点列）
      float sx = ax + yaw * 1.18;
      float cellW = 0.052;
      float shopCell = floor(sx / cellW);
      float fxs = fract(sx / cellW) - 0.5;
      float shopLit = step(0.30, h11(shopCell + 7.0));
      float isVend = step(0.85, h11(shopCell + 9.0));
      float sy = 0.10 + h11(shopCell + 2.0) * 0.03;
      vec3 shopHue = mix(uSunGlow, vec3(1.0, 0.55, 0.38), step(0.5, h11(shopCell + 5.0)));
      shopHue = mix(shopHue, vec3(0.82, 0.92, 1.0), isVend);
      float sign = smoothstep(0.028, 0.0, abs(vp.y - sy)) * smoothstep(0.42, 0.0, abs(fxs));
      road += shopHue * sign * (shopLit + isVend) * 0.8;
      // 濡れた路面に縦に伸びる灯りの反射
      float refl = smoothstep(0.30, 0.0, abs(fxs)) * smoothstep(sy - 0.01, -0.12, vp.y);
      road += shopHue * refl * (shopLit + isVend) * 0.32;
      // 通り沿いの街灯
      float lampPh = fract(sx / 0.16) - 0.5;
      float lampY = 0.155 + h11(floor(sx / 0.16) + 3.0) * 0.02;
      float dl = length(vec2(lampPh * 0.16, vp.y - lampY) * vec2(1.0, 1.4));
      road += uSunGlow * (exp(-dl * 40.0) + exp(-dl * 11.0) * 0.3) * 0.85;
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

    // 窓の外に舞う紅葉/花びら（ガラスの外をひらひら）。アパーチャ内だけに乗る
    outside = foliageOverlay(outside, p, t, uFoliage);
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

    // 雪が桟と窓台の上に積もる（uGlass==2=雪のときだけ）
    if (uGlass > 1.5) {
      float bumpy = (fbm(vec2(wp.x * 38.0, 3.0)) - 0.5) * 0.008; // 雪面のでこぼこ
      float capMull = smoothstep(0.024, 0.004, abs(wp.y - (0.527 + bumpy))) * step(wp.y, 0.529); // 横框の上
      float capSill = smoothstep(0.030, 0.006, abs(wp.y - (winB + 0.020 + bumpy))) * step(wp.y, winB + 0.022)
                    * step(winL - 0.02, wp.x) * step(wp.x, winR + 0.02); // 窓台の上
      float snowCap = clamp(max(capMull, capSill), 0.0, 1.0) * aperture;
      col = mix(col, vec3(0.92, 0.94, 0.99), snowCap * 0.9);
    }

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
