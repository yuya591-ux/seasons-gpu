// 窓辺シリーズの本命「高台の角部屋」。室内に立ち、窓から夕暮れの下町を見下ろす。
// ・室内は翳り、窓の外は明るい（“中にいて外を見ている”コントラスト）
// ・窓枠／桟／窓台で「本物の窓」をかたちづくる
// ・右を向く（uPan.x を増やす）と、隣のマンションの壁が迫って街を遮る＝角部屋の手応え
// 画像は使わず、街も壁も室内もすべて計算で描く。色5値は他情景と共通の名前で受け取る。

import { GLASS_GLSL } from './glass.js'
import { GRADE_GLSL } from './grade.js'
import { GROUND_GLSL } from './ground.js'
import { BIRDS_GLSL } from './birds.js'

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
  uniform vec2 uParallax;    // 身を乗り出す/覗き込む並進視差（近景ほど大きく効かせる）
  uniform float uReduceMotion; // モーション過敏配慮 0=通常 1=動きを止める
  uniform float uLowRise;     // 低層住宅地化 0=通常の街 1=低い家並み
  uniform float uWindowOpen; // 窓を開けた度合い 0=閉(ガラス越し) 1=開(素通し)
  uniform float uSeason;     // 季節 0=春 1=夏 2=秋 3=冬（網戸/結露の出し分け）
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
//__GROUND__

  // 遠景の山なみ（盆地の街を囲む遠山）。3層の稜線、奥ほど青く霞む空気遠近で街が山へ収束する。
  vec3 hills(vec3 col, vec2 p, float wx, float ridgeY, vec3 hcol) {
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float depth = fi / 2.0;                            // 0=奥(遠) .. 1=手前(近)
      float yb = ridgeY + 0.13 - depth * 0.085;          // 奥の尾根ほど高く立つ
      float freq = mix(0.8, 2.0, depth);
      float amp = mix(0.05, 0.12, depth);
      float ridge = yb + (fbm(vec2(wx * freq + fi * 9.0, 0.0)) - 0.5) * amp * 2.0;
      // 遠いほど青く霞むが、空よりは確かに濃いシルエットに（見えるように）
      vec3 haze = mix(uSkyMid, hcol, 0.62);
      vec3 c = mix(haze, hcol, depth);
      c += uSunGlow * smoothstep(0.0, 0.5, wx + 0.4) * (1.0 - depth) * 0.05; // 奥の稜線に残照
      // 冬は稜線の上部が雪化粧（季節と地続きの遠山）
      float cap = step(1.5, uGlass) * smoothstep(ridge - 0.05, ridge - 0.006, p.y) * step(p.y, ridge);
      c = mix(c, vec3(0.90, 0.93, 0.97), cap * 0.72);
      col = mix(col, c, step(p.y, ridge));
    }
    return col;
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
    // 建物の壁面: 黒いシルエットでなく、夕暮れの光を受けた“見える壁”に。
    float facadeVar = 0.85 + 0.30 * h11(cell * 5.3 + 2.0);
    vec3 wallTone = mix(uHorizon, vec3(0.50, 0.46, 0.42), 0.5);   // 暖かいモルタル/壁の色
    vec3 silv = mix(sil, wallTone, 0.6) * facadeVar;
    silv *= 0.93 + 0.07 * step(0.5, fract(fxc * 5.0));           // 縦パネルの目地
    silv += uSunGlow * 0.05 * smoothstep(0.0, 0.6, fx);          // 西日が左から当たる
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
    // 突風（ゆるやかにうねる風）。葉が一斉に流される瞬間を生む＝自然な舞い
    float gust = sin(t * 0.27) * 0.6 + sin(t * 0.11 + 1.3) * 0.4;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float depth = fi * 0.5;                                  // 0:奥 .. 1:手前
      float sc = mix(6.0, 12.0, depth);
      float sp = mix(0.035, 0.08, depth);
      vec2 gp = vec2(p.x * sc * 0.7, p.y * sc);
      gp.y += t * sp * sc;                                      // 落下
      // 横の動き: ゆっくりの蛇行＋突風で流れる＋細かなひらめき
      gp.x += sin(t * 0.5 + fi * 2.0 + p.y * 6.0) * 0.7;
      gp.x += gust * (0.7 + 0.5 * depth) * 1.2;
      gp.x += sin(t * 2.3 + p.y * 13.0 + fi) * 0.10;
      vec2 id = floor(gp);
      vec2 f = fract(gp) - 0.5;
      float n = h21(id + fi * 23.0);
      if (n < 0.82) continue;                                   // ぐっとまばらに（静けさ優先）
      // ひらひら回転（風が強いほど速く舞う）＝木の葉のフラッター
      float ang = t * (1.4 + 1.6 * abs(gust)) * (n - 0.5) * 2.0 + n * 6.2831;
      float ca = cos(ang), sa = sin(ang);
      vec2 rf = vec2(ca * f.x - sa * f.y, sa * f.x + ca * f.y);
      // 横から見た葉は薄く（回転で見え隠れ）＝立体的なひらめき
      float thin = mix(2.2, 1.0, abs(sin(ang)));
      float leaf = smoothstep(0.17, 0.07, length(rf * vec2(1.0, thin)));
      vec3 lc = (mode > 1.5)
        ? mix(vec3(0.98, 0.84, 0.88), vec3(0.95, 0.74, 0.80), n)  // 花びら（淡紅）
        : mix(vec3(0.80, 0.47, 0.22), vec3(0.62, 0.30, 0.17), n); // 紅葉（落ち着いた橙茶）
      lc *= 0.85 + 0.30 * abs(cos(ang));                         // 面の向きで明暗（受光）
      col = mix(col, lc, leaf * (0.20 + 0.26 * depth));
    }
    return col;
  }

  // 窓の外（空・街・隣の建物の壁）。vp=湾曲込みの視界座標, yaw/pitch=見回し。
  vec3 outsideView(vec2 vp, float ax, float yaw, float pitch) {
    // 空（夕暮れ）: 下=茜、上=紫紺
    vec3 col = mix(uSkyMid, uSkyTop, smoothstep(0.52, 1.0, vp.y));
    col = mix(uHorizon, col, smoothstep(0.40, 0.60, vp.y));
    // 太陽のゆるやかな移ろい（街の陰影と同じ位相＝光源が一致）
    float sunAz = sin(uTime * 0.012 * (1.0 - uReduceMotion)) * 0.08;
    float sunY = 0.45 - (sin(uTime * 0.012) * 0.5 + 0.5) * 0.04;       // ゆっくり沈む
    // 地平の残照は西（画面左）ほど明るい＝太陽が西にある気配
    float westBias = 0.6 + 0.8 * smoothstep(0.5 + sunAz, -0.6 + sunAz, ax + yaw * 0.2);
    col += uSunGlow * exp(-abs(vp.y - 0.46) * 7.0) * 0.20 * westBias;
    // 西の低い夕日（やわらかな光球）。沈む太陽の在り処
    col += uSunGlow * exp(-distance(vec2(ax + yaw * 0.2, vp.y), vec2(-0.5 + sunAz, sunY)) * 4.2) * 0.22;

    // 夕焼け雲（2層・立体的。底が夕陽で染まり上面は翳る。ゆっくり流れて形が変わる）
    float cloudT = uTime * (1.0 - uReduceMotion);
    float westWarm = smoothstep(0.3, -0.5, ax + yaw * 0.2 - sunAz);   // 西側ほど夕陽に燃える
    float cloudband = 0.0;                                            // 遠雷フラッシュで参照（雲量）
    for (int L = 0; L < 2; L++) {
      float fl = float(L);
      vec2 cq = vec2(ax * 1.4 + yaw * (0.18 - fl * 0.07) + cloudT * (0.012 - fl * 0.005) + fl * 5.0, vp.y * (2.4 - fl * 0.8));
      vec2 cwarp = vec2(fbm(cq + 2.0), fbm(cq + 5.0)) - 0.5;
      float cl = fbm(cq + cwarp * 0.8);
      float clu = fbm(cq + vec2(0.0, 0.16) + cwarp * 0.8);            // 少し上の密度
      float cb = smoothstep(0.52, 0.70, cl) * smoothstep(0.42, 1.0, vp.y);
      float underlit = smoothstep(-0.06, 0.10, clu - cl);            // 底面ほど夕陽を受ける
      vec3 cloudWarm = mix(uHorizon, uSunGlow, 0.55 + 0.30 * westWarm); // 夕陽に染まる底（西ほど強い）
      vec3 cloudCool = mix(uSkyMid, uSkyTop, 0.4);                   // 翳る上面
      col = mix(col, mix(cloudCool, cloudWarm, underlit), cb * (0.52 - fl * 0.14));
      cloudband = max(cloudband, cb);
    }

    // 雨上がりの虹（雨の情景で、ゆるやかな周期で空が明るむ局面に薄く架かる）。夜には出さない。
    float dayAmtRb = clamp(dot(uSkyTop, vec3(1.6)), 0.0, 1.0);
    float isRain = step(0.5, uGlass) * step(uGlass, 1.5) * dayAmtRb;
    float clearing = smoothstep(0.55, 0.88, sin(uTime * 0.016 * (1.0 - uReduceMotion)) * 0.5 + 0.5);
    if (isRain * clearing > 0.001) {
      vec2 rdv = vec2(ax + yaw * 0.2 - sunAz, vp.y + 0.02);         // 反太陽点（画面下）。ピクセルで真円
      float rd = length(rdv);
      float skyGate = smoothstep(0.50, 0.62, vp.y);                // 高い空にだけ（街の上）
      float t2 = (rd - 0.82) / 0.05;                               // 主虹の帯（-1..1）
      float arc = smoothstep(1.0, 0.0, abs(t2)) * skyGate;
      float hue = t2 * 0.5 + 0.5;                                  // 0=内(紫) .. 1=外(赤)
      vec3 spec = 0.6 + 0.4 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + (1.0 - hue) * 0.85));
      col += spec * arc * isRain * clearing * 0.16;                // 主虹
      float arc2 = smoothstep(1.0, 0.0, abs((rd - 0.92) / 0.04)) * skyGate;
      col += spec.zyx * arc2 * isRain * clearing * 0.06;           // 副虹（淡く・色順は逆）
      col += vec3(0.02, 0.018, 0.014) * clearing * isRain * skyGate; // 空が明るむ
    }

    // 上空（見上げの報酬）: 高い所に薄い巻雲のすじ＋天頂をわずかに締める
    float high = smoothstep(0.72, 1.05, vp.y);
    float cirrus = fbm(vec2(ax * 0.8 + yaw * 0.15 + uTime * 0.004, vp.y * 5.0 - 1.0));
    col = mix(col, mix(col, uSunGlow, 0.22), high * smoothstep(0.5, 0.78, cirrus) * 0.35);
    col *= 1.0 - high * 0.05;

    // 遠雷フラッシュ（空がほのかに白む。雲のあたりを少し強く）
    col += uFlash * (0.10 + 0.16 * cloudband) * vec3(0.85, 0.9, 1.0);

    // 夜の度合い（空が暗いほど1）。月・観覧車・星を夜ほど強く出すための係数
    float nightAmt = clamp(1.0 - dot(uSkyTop, vec3(1.2)), 0.0, 1.0);

    // 月（far なのでゆっくり動く。淡いハロつき）
    vec2 mn = vec2(-0.72, 0.80);
    float md = length(vec2((ax + yaw * 0.10) - mn.x, vp.y - mn.y));
    float moonDisc = smoothstep(0.05, 0.043, md);
    float moonTex = 0.92 + 0.08 * fbm(vec2((ax + yaw * 0.10) * 30.0, vp.y * 30.0));
    col = mix(col, vec3(0.96, 0.95, 0.90) * moonTex, moonDisc * (0.35 + 0.5 * nightAmt));
    col += vec3(0.9, 0.92, 1.0) * exp(-md * 13.0) * (0.05 + 0.10 * nightAmt);

    // 星（夜空に静かに在る。またたかせない＝止まった時間）
    vec2 sg = vec2((ax + yaw * 0.12) * 14.0, vp.y * 14.0);
    vec2 sid = floor(sg);
    float sn = h21(sid + 3.0);
    float star = step(0.95, sn) * smoothstep(0.05, 0.0, length(fract(sg) - 0.5))
               * smoothstep(0.62, 0.85, vp.y);
    col += vec3(0.9, 0.93, 1.0) * star * nightAmt * 0.7;

    // 帰る鳥影（はばたきながら弧を描いて空を渡る）。
    col = flyingBirds(col, vec2(ax + yaw * 0.5, vp.y), uTime, 1.0 - uReduceMotion);

    // 時間とともに窓に灯がともる（夕暮れが深まる郷愁）
    float litRamp = 0.7 + 0.3 * smoothstep(0.0, 90.0, uTime);

    // 奥→手前の住宅街（遠景=低い家＋たまに中層 / 中景=商店街 / 手前=家並み）
    col = hills(col, vp, ax + yaw * 0.30, 0.50, mix(vec3(0.15, 0.21, 0.18), uHorizon, 0.45));
    col = town(col, vp, ax + yaw * 0.45 + uParallax.x * 0.3, 0.46, 0.085, 0.05,
               mix(uDropTint, uHorizon, 0.32), uSunGlow, mix(0.22, 0.45, uIntensity) * litRamp, 1.3, 0.0);

    // 空気遠近の霞: 地平で遠い街並みが空に溶ける（奥行き＝退色＝郷愁）
    float haze = smoothstep(0.54, 0.40, vp.y) * smoothstep(0.30, 0.46, vp.y);
    col = mix(col, mix(uHorizon, uSkyMid, 0.4), haze * 0.40);

    // 街あかりの照り返し（夜の湿った空気に滲む光害のドーム）。夜ほど暖かく明るむ
    float cityHalo = smoothstep(0.74, 0.42, vp.y) * smoothstep(0.30, 0.45, vp.y);
    col += mix(uHorizon, uSunGlow, 0.5) * cityHalo * nightAmt * 0.20;

    // 地平のスカイライン（近い街並み）。足元から下は見下ろす地面が描く。
    col = town(col, vp, ax + yaw * 0.85 + uParallax.x * 0.8, 0.40, 0.14, 0.11,
               mix(uDropTint, uSkyMid, 0.10), uSunGlow, mix(0.32, 0.55, uIntensity) * litRamp, 7.1, 0.5);

    // 遠くの高い建物の赤い灯（点滅させず、静かに灯す。1〜2基）
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      float bx = (h11(fi * 13.0 + 2.0) - 0.5) * 1.8;
      float by = 0.46 + h11(fi * 5.0 + 3.0) * 0.08;
      float bd = length(vec2((ax + yaw * 0.4) - bx, vp.y - by) * vec2(1.0, 1.35));
      col += vec3(0.9, 0.18, 0.12) * (exp(-bd * 160.0) + exp(-bd * 55.0) * 0.16) * (0.35 + 0.35 * nightAmt);
    }

    // 銭湯の煙突（郷愁の主役）。街にすっと立ち、夕空へ細い煙がたなびく。見回しで見つかる1本。
    {
      float cw = ax + yaw * 0.72 + uParallax.x * 0.6;      // 中景の街と同程度に動く
      float cx = cw + 0.16;                                 // やや左寄りに立つ（既定の視界に入る）
      float baseY = 0.42, topY = 0.66;                      // 街の上へすっと抜ける高さ
      float taper = mix(0.014, 0.008, clamp((vp.y - baseY) / (topY - baseY), 0.0, 1.0)); // 上ほど細い
      float onShaft = smoothstep(taper, taper * 0.55, abs(cx))
                    * smoothstep(baseY - 0.005, baseY + 0.01, vp.y)
                    * smoothstep(topY, topY - 0.006, vp.y);
      // 街より暗いシルエット＝空に映える。西日が片側に回り込む
      vec3 brick = mix(uDropTint, mix(uHorizon, vec3(0.42, 0.26, 0.21), 0.5), 0.42);
      brick += uSunGlow * smoothstep(0.0, taper, cx) * 0.14;
      col = mix(col, brick, onShaft);
      col = mix(col, mix(brick, vec3(0.82, 0.82, 0.84), 0.7),
                onShaft * smoothstep(0.014, 0.0, abs(vp.y - (topY - 0.014))));        // 先端の白帯
      // 煙（先端から立ちのぼり、風に流れて空へ溶ける）
      float sy = vp.y - topY;
      float wind = sin(uTime * 0.18) * 0.4 + 0.5;
      float sx = cx - sy * (0.30 + 0.22 * wind) - sin(uTime * 0.25 + sy * 6.0) * 0.025; // 上ほど風で流れる
      float swidth = 0.016 + sy * 0.55;
      float dens = fbm(vec2(sx * 12.0, sy * 6.0 - uTime * 0.28));
      float plume = smoothstep(swidth, 0.0, abs(sx)) * smoothstep(0.0, 0.02, sy)
                  * smoothstep(0.26, 0.015, sy) * smoothstep(0.40, 0.70, dens);
      col = mix(col, mix(uSkyMid, uSunGlow, 0.4) * 1.05, plume * 0.6);
    }

    // 観覧車（川辺の遊園地。ゆっくり回り夜は色とりどりに灯る）。右手の遠景に静かに。
    {
      float wmo = 1.0 - uReduceMotion;
      float asp = uResolution.x / uResolution.y;
      vec2 wd = vec2((ax + yaw * 0.7 - 0.10) / asp, vp.y - 0.56);
      wd.y *= uResolution.y / uResolution.x;            // 画面で真円に
      float wr = length(wd);
      if (wr < 0.22) {
        float PI = 3.14159265;
        float R = 0.15;
        float ang = atan(wd.y, wd.x);
        float rot = uTime * 0.05 * wmo;
        vec3 frame = mix(uDropTint, uHorizon, 0.35);    // 暗い骨組み
        float rim = smoothstep(0.009, 0.0, abs(wr - R));
        float spoke = smoothstep(0.040, 0.0, abs(fract((ang + rot) / (2.0 * PI) * 12.0) - 0.5)) * smoothstep(R, 0.0, wr);
        float hub = smoothstep(0.014, 0.006, wr);
        float leg = smoothstep(0.010, 0.0, abs(abs(wd.x) - (-wd.y) * 0.5)) * step(wd.y, 0.0) * step(-0.20, wd.y); // 支柱(A字)
        col = mix(col, frame, clamp(rim + spoke * 0.55 + hub + leg, 0.0, 1.0) * 0.7);
        // ゴンドラ（リム上・等間隔・回転。夜は色とりどりに灯る）
        float gN = 12.0;
        float gA = (ang + rot) / (2.0 * PI) * gN;
        float gondola = smoothstep(0.30, 0.0, abs(fract(gA) - 0.5) * 2.0) * smoothstep(0.020, 0.006, abs(wr - R));
        vec3 gcol = mix(uSunGlow, 0.55 + 0.45 * cos(floor(gA) * 1.3 + vec3(0.0, 2.1, 4.2)), nightAmt);
        col += gcol * gondola * (0.35 + 0.85 * nightAmt);
      }
    }

    // 地平の継ぎ目をなじませる: 立体の近景街と2Dの遠景スカイラインの境を霞で溶かす
    float seam = smoothstep(0.505, 0.44, vp.y) * smoothstep(0.40, 0.455, vp.y);
    col = mix(col, mix(uHorizon, uSkyMid, 0.5), seam * 0.45);

    // ── 見下ろす街並み（地面のパース投影＝本当に高所から下を眺めている） ──
    float gmask;
    vec3 ground = lookDownGround(vp, ax, yaw, uParallax.x, nightAmt, uGlass, gmask);
    col = mix(col, ground, gmask);

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

    // 自分の建物の外壁（真下を覗くと、窓台の外側に自分の壁が下へ続く＝乗り出して覗く実感）
    float lookDown = smoothstep(0.06, 0.32, pitch);
    if (lookDown > 0.001) {
      float ledgeY = -0.06 + 0.40 * lookDown + uParallax.y * 0.6;   // 壁の上端(庇)。見下ろすほどせり上がる
      float onWall = smoothstep(ledgeY, ledgeY - 0.015, p.y);       // ledge より下＝自分の壁
      float streak = fbm(vec2(p.x * 9.0, p.y * 2.2)) * 0.4 + fbm(vec2(p.x * 30.0, p.y * 0.6)) * 0.14; // 縦の雨だれ汚れ
      vec3 myWall = mix(vec3(0.085, 0.082, 0.092), vec3(0.155, 0.135, 0.125), streak); // 手前で暗い暖灰コンクリ
      myWall += uSunGlow * 0.05 * smoothstep(ledgeY - 0.10, ledgeY, p.y);  // 庇のすぐ下に残照の回り込み
      // 庇/外側の窓台（壁の上端の水平の縁。残照を受けて明るい線）
      float eave = smoothstep(0.013, 0.0, abs(p.y - ledgeY));
      outside = mix(outside, myWall, onWall);
      outside = mix(outside, uSunGlow * 0.35 + vec3(0.06, 0.055, 0.05), eave * 0.6 * lookDown);
    }

    vec4 wall = neighborWall(p, vp, ax, yaw);
    outside = mix(outside, wall.rgb, wall.a);

    // 窓の外に舞う紅葉/花びら（ガラスの外をひらひら）。アパーチャ内だけに乗る
    outside = foliageOverlay(outside, p, t, uFoliage);
    // 窓の外に降る雨/雪（ガラス面の現象）。アパーチャ内だけに乗せる
    outside = applyGlass(outside, p, t, uGlass);

    // ── 窓のアパーチャ（室内に切られた窓の開口） ──
    // 窓枠は最も手前。見回しに少し、覗き込み(uParallax)に大きく連動して動く＝身を乗り出して窓枠の脇を覗く。
    vec2 wp = p + vec2(yaw, pitch) * 0.012 + uParallax * 2.4;
    float winL = 0.135, winR = 0.865, winB = 0.135, winT = 0.895;
    // 開口（角を少し丸める）
    float ax0 = smoothstep(winL, winL + 0.012, wp.x) * smoothstep(winR, winR - 0.012, wp.x);
    float ay0 = smoothstep(winB, winB + 0.012, wp.y) * smoothstep(winT, winT - 0.012, wp.y);
    float aperture = ax0 * ay0;

    // 桟（窓を上下2枚＋中央の縦框で田の字に近い割り付け）
    float barV = smoothstep(0.006, 0.0, abs(wp.x - 0.5)) * aperture;          // 中央の縦框（細く）
    float barH = smoothstep(0.006, 0.0, abs(wp.y - 0.52)) * aperture;         // 中央の横框（細く）
    float bars = clamp(max(barV, barH), 0.0, 1.0);

    // ── 窓ガラスの映り込み（透明感優先。昼はほぼ素通し、夜・暗い空でだけ室内が淡く映る） ──
    // 窓を開けるとガラスの映り・埃・網戸・結露が消え、素通しの澄んだ景色になる。
    float glassOn = 1.0 - uWindowOpen;
    float nightRefl = clamp(1.0 - dot(uSkyTop, vec3(1.2)), 0.0, 1.0);
    // 中央ほどクリアに（縁に近いほどガラスの映りが乗る＝視線の中心は透き通る）
    float edgeClear = smoothstep(0.30, 0.46, max(abs(wp.x - 0.5), abs(wp.y - 0.5)));
    float reflAmt = (0.010 + 0.02 * smoothstep(0.45, 1.0, wp.y) + 0.10 * nightRefl) * aperture * (0.5 + 0.5 * edgeClear) * glassOn;
    vec3 roomRefl = uSunGlow * (0.06 + 0.14 * nightRefl) + vec3(0.012, 0.011, 0.015);
    roomRefl += uSunGlow * 0.12 * smoothstep(0.72, 1.0, wp.y) * nightRefl;          // 天井灯の映り
    roomRefl += uSunGlow * 0.06 * smoothstep(0.03, 0.0, abs(wp.y - 0.40)) * nightRefl; // 室内の横帯（棚など）
    outside = mix(outside, outside * (0.94 - 0.12 * nightRefl) + roomRefl, reflAmt);

    // 窓ガラスの拭き筋・埃（縁寄り・明るい空でだけ淡く。中央は出さず透き通らせる）。
    float gLuma = dot(outside, vec3(0.299, 0.587, 0.114));
    float streak = fbm(vec2(wp.x * 4.0, wp.y * 26.0)) - 0.5;  // 縦に伸びる拭き筋
    float dust = fbm(vec2(wp.x * 9.0, wp.y * 9.0)) - 0.5;     // まだらな埃
    float film = (streak * 0.55 + dust * 0.45) * smoothstep(0.42, 0.82, gLuma) * aperture * edgeClear * glassOn;
    outside += uSunGlow * max(film, 0.0) * 0.035;            // 光を受けた埃がうっすら
    outside -= max(-film, 0.0) * 0.014;                     // 拭き筋のわずかな陰
    // 窓を開けると外気が澄んで景色が明るく鮮やかに（ガラスの減衰・くすみが消える）
    outside *= 1.0 + uWindowOpen * 0.08;
    outside = mix(vec3(dot(outside, vec3(0.299, 0.587, 0.114))), outside, 1.0 + uWindowOpen * 0.16);

    // ── 季節で変わる窓ガラスの状態（網戸＝夏／結露＝冬） ──
    // 網戸（夏・雨雪でないとき）: 細かな格子。明るい背景でだけ薄く見え、景色をほんのり和らげる。
    float summerScreen = step(0.5, uSeason) * step(uSeason, 1.5) * step(uGlass, 0.5) * aperture * glassOn;
    if (summerScreen > 0.001) {
      // 細い縦横の糸（網戸）。明るい背景でだけ薄く見え、景色をほんのり和らげる。
      float wireX = smoothstep(0.16, 0.0, abs(fract(wp.x * 95.0 * asp) - 0.5));
      float wireY = smoothstep(0.16, 0.0, abs(fract(wp.y * 95.0) - 0.5));
      float wire = max(wireX, wireY);
      float bright = smoothstep(0.42, 0.82, gLuma);
      outside *= 1.0 - summerScreen * 0.045;                 // 網戸ごしの微かな減光
      outside -= summerScreen * (0.4 + 0.6 * bright) * wire * 0.04; // 糸の影（明るい所ほど見える）
    }
    // 結露（冬・雪）: 縁ほど曇り、暖かい中央は晴れる。曇りを縦に晴らす水滴の筋。
    float winterCond = (step(2.5, uSeason) + step(1.5, uGlass)) * aperture * glassOn;
    if (winterCond > 0.001) {
      float dc = distance(wp, vec2(0.5, 0.52));
      float fog = clamp(smoothstep(0.15, 0.42, dc) + smoothstep(0.32, 0.13, wp.y) * 0.45, 0.0, 1.0);
      // 伝う水滴（数本。曇りを晴らして奥が明るく覗く）
      float colId = floor(wp.x * 12.0);
      float dripX = fract(wp.x * 12.0) - 0.5;
      float dActive = step(0.72, h21(vec2(colId, 3.0)));
      float dHead = fract(h21(vec2(colId, 7.0)) + uTime * 0.015 * (1.0 - uReduceMotion));
      float trail = smoothstep(0.06, 0.0, abs(dripX)) * smoothstep(0.0, 0.05, dHead - (1.0 - (wp.y - winB) / (winT - winB))) * dActive;
      fog *= 1.0 - trail * 0.9;                              // 水滴が通った筋は曇りが晴れる
      vec3 fogCol = mix(outside, vec3(0.80, 0.84, 0.90), 0.7);
      outside = mix(outside, fogCol, fog * winterCond * 0.6);
      outside += vec3(0.04) * trail * winterCond * 0.4;      // 晴れた筋は少し明るい
    }

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

    // 窓枠（サッシ本体）。開口の縁の内側にハイライト。桟は黒でなく暖かいアルミ灰
    vec3 sashCol = mix(vec3(0.14, 0.13, 0.13), vec3(0.32, 0.30, 0.29), nearWin);

    // 合成: 外（アパーチャ内）／室内（外側）／桟・サッシ（最前面）
    vec3 col = mix(interior, outside, aperture);

    // 桟の断面の丸み＋方向のある陰影（西日が左/上に当たる＝アルミサッシの立体）
    vec3 sashLit = sashCol * 1.45 + uSunGlow * 0.05;
    vec3 sashSh  = sashCol * 0.60;
    vec3 vCol = mix(sashSh, sashLit, smoothstep(-0.004, 0.004, 0.5 - wp.x));  // 縦框: 西(左)が明るい
    vec3 hCol = mix(sashSh, sashLit, smoothstep(-0.004, 0.004, wp.y - 0.52)); // 横框: 上が明るい
    col = mix(col, hCol, barH * 0.9);
    col = mix(col, vCol, barV * 0.9);

    // クレセント錠（中央の召し合わせに小さな金具。鈍く光るアルミ）
    vec2 lk = (wp - vec2(0.5, 0.52)) * vec2(1.0, asp);                        // アスペクト補正で丸める
    float lockBody = smoothstep(0.016, 0.010, length(lk * vec2(0.65, 1.7))) * aperture; // 縦長のレバー
    float lockBase = smoothstep(0.011, 0.006, length(lk)) * aperture;                   // 台座
    vec3 metal = vec3(0.52, 0.52, 0.55) + uSunGlow * 0.18 * smoothstep(0.004, -0.006, lk.x);
    col = mix(col, metal, max(lockBody, lockBase) * 0.85);
    col += vec3(0.9, 0.9, 0.92) * smoothstep(0.0035, 0.0, length(lk - vec2(-0.005, -0.004))) * 0.5 * aperture; // ハイライト点

    // ガラスの斜めの映り込み（窓ガラス特有の一条の光。ごく淡く・上半分に）
    float sheen = smoothstep(0.07, 0.0, abs((wp.x - 0.5) + (wp.y - 0.5) * 0.6 - 0.16)) * smoothstep(0.35, 0.9, wp.y);
    col += uSunGlow * sheen * 0.05 * aperture * glassOn;

    // 雪が桟と窓台の上に積もる（uGlass==2=雪のときだけ）
    if (uGlass > 1.5) {
      float bumpy = (fbm(vec2(wp.x * 38.0, 3.0)) - 0.5) * 0.008; // 雪面のでこぼこ
      float capMull = smoothstep(0.024, 0.004, abs(wp.y - (0.527 + bumpy))) * step(wp.y, 0.529); // 横框の上
      float capSill = smoothstep(0.030, 0.006, abs(wp.y - (winB + 0.020 + bumpy))) * step(wp.y, winB + 0.022)
                    * step(winL - 0.02, wp.x) * step(wp.x, winR + 0.02); // 窓台の上
      float snowCap = clamp(max(capMull, capSill), 0.0, 1.0) * aperture;
      col = mix(col, vec3(0.92, 0.94, 0.99), snowCap * 0.9);
    }

    // ── 窓辺の室内（“部屋に居て外を眺めている”最後のピース） ──
    // レースカーテン（両脇に寄せた薄手。やわらかく揺れ光を透かす。中央は開けて見える）
    // 窓を開けると外気でカーテンが大きく揺れる（そよ風）
    float curtSway = (sin(uTime * 0.4) * 0.008 + sin(uTime * 0.19 + 1.0) * 0.005) * (1.0 + uWindowOpen * 2.5);
    float cwid = 0.19 * (1.0 - uWindowOpen * 0.55); // 窓を開けるとカーテンを脇へ寄せる
    float gatherL = smoothstep(winL + cwid, winL - 0.01, wp.x - curtSway);
    float gatherR = smoothstep(winR - cwid, winR + 0.01, wp.x + curtSway);
    float gather = max(gatherL, gatherR);
    float folds = 0.55 + 0.45 * sin(wp.x * 95.0 + sin(wp.y * 3.0 + uTime * 0.25) * 1.4); // 縦の襞＋ゆらぎ
    float vext = smoothstep(winT + 0.03, winT - 0.02, wp.y) * smoothstep(winB - 0.08, winB + 0.05, wp.y);
    float laceA = gather * vext * (0.24 + 0.18 * folds);
    vec3 lace = mix(uSunGlow, vec3(0.96, 0.94, 0.90), 0.55) * (0.72 + 0.28 * folds);
    col = mix(col, lace, laceA);

    // 窓辺の観葉植物（左下にそっと。外光に透ける葉のシルエットと鉢）
    vec2 plBase = vec2(winL + 0.125, winB + 0.012);
    vec2 plc = wp - plBase;
    float plant = 0.0;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      float a = (-0.7 + fi * 0.26) + sin(uTime * 0.5 + fi) * 0.045;    // 葉の角度（そよぐ）
      vec2 dir = vec2(sin(a), cos(a));
      float along = dot(plc, dir);
      float perp = dot(plc, vec2(dir.y, -dir.x));
      float w = 0.020 * clamp(1.0 - along / 0.135, 0.0, 1.0);          // 先細り
      float blade = step(0.0, along) * smoothstep(0.135, 0.0, along) * smoothstep(w, 0.0, abs(perp));
      plant = max(plant, blade);
    }
    vec3 leafCol = mix(vec3(0.07, 0.12, 0.06), uSunGlow * 0.4, 0.22);  // 暗い葉＋外光の透け
    col = mix(col, leafCol, plant * 0.88);
    float pot = step(abs(wp.x - plBase.x), 0.040 - (wp.y - winB) * 0.18)
              * step(winB - 0.02, wp.y) * step(wp.y, winB + 0.032);     // 鉢（小さな台形）
    col = mix(col, mix(vec3(0.13, 0.09, 0.07), uSunGlow * 0.3, 0.2), pot * 0.88);

    // 室内全体のごく弱い周辺減光（奥行き）
    float vig = 1.0 - 0.34 * smoothstep(0.40, 1.25, distance(p, vec2(0.5, 0.52)));
    col *= vig;

    col = applyGrade(col, frag); // 全情景共通の「記憶の風景」グレード＋水彩
    // 窓を開けたら水彩のモヤを払い、視界をくっきり晴らす（コントラスト＋発色を上げる）
    vec3 clearV = (col - 0.42) * 1.22 + 0.42;
    clearV = mix(vec3(dot(clearV, vec3(0.299, 0.587, 0.114))), clearV, 1.24);
    col = mix(col, clearV, uWindowOpen);
    col *= uBright;
    col -= max(col - vec3(0.92), 0.0) * 0.5; // 白とび防止
    col += (h21(frag * uResolution.xy + t) - 0.5) * 0.007;
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
  const body = FRAGMENT_BODY
    // 地面・鳥の関数は outsideView より前に定義する必要がある（outsideView から呼ぶため）
    .replace('//__GROUND__', GROUND_GLSL + '\n' + BIRDS_GLSL)
    .replace('void main()', GLASS_GLSL + '\n' + GRADE_GLSL + '\n  void main()')
  return defines + body
}
