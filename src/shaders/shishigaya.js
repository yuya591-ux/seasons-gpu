// 窓辺シリーズ「鶴見・獅子ヶ谷の谷戸」。出身地（横浜市鶴見区獅子ヶ谷）の昭和後期〜平成初期の
// 谷戸（やと）の風景を、丘の住宅の窓から見渡す画として再現する。実在の商標・看板・固有意匠は
// 模さず、地形と佇まいを写す:
//  ・尾根を覆う森＝獅子ヶ谷市民の森（マツ・ヒノキの鬱蒼とした北斜面）
//  ・谷底の田んぼ＝かつての水田（空を映す）と畦道、せせらぎ、畑
//  ・斜面に登る瓦屋根の住宅地（坂の多い宅地化）
//  ・茅葺の古民家＝横溝屋敷（主屋の寄棟茅葺＋長屋門＋屋敷林）を谷の主役に
// パレットの5色: 空(top/mid/horizon)・陽(sunGlow)・森の深緑(dropTint)。

import { GLASS_GLSL } from './glass.js'
import { GRADE_GLSL } from './grade.js'
import { BIRDS_GLSL } from './birds.js'

export const vertexSource = /* glsl */ `
  attribute vec2 aPosition;
  void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`

const FRAGMENT_BODY = /* glsl */ `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uIntensity;  // 谷の賑わい/灯りの多さ 0..1
  uniform float uBright;
  uniform vec2 uPan;
  uniform vec2 uParallax;
  uniform float uReduceMotion;
  uniform float uWindowOpen;
  uniform float uGlass;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyMid;
  uniform vec3 uHorizon;
  uniform vec3 uSunGlow;
  uniform vec3 uDropTint;     // 森の深緑

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

  // 森に覆われた尾根（市民の森）。稜線＋森の塊のテクスチャ。lit=陽の当たる強さ。
  vec3 forestRidge(vec3 col, vec2 vp, float wx, float baseY, float rough, float amp,
                   vec3 fcol, float lit, float tex) {
    float ridge = baseY + (fbm(vec2(wx * rough, 1.7)) - 0.5) * amp;
    float inside = step(vp.y, ridge);
    if (inside < 0.5) return col;
    float belowTop = smoothstep(ridge, ridge - 0.30, vp.y);     // 0=稜線 1=麓
    vec3 mc = fcol * mix(1.10, 0.66, belowTop);
    if (tex > 0.01) {
      // 木々の塊（こんもりした樹冠の陰影）
      float canopy = fbm(vec2(wx * 22.0, vp.y * 16.0)) - 0.5;
      mc *= 1.0 + canopy * 0.22 * tex;
      mc += uSunGlow * smoothstep(ridge - 0.02, ridge, vp.y) * lit * 0.30; // 朝陽が梢に
    }
    return mix(col, mc, inside);
  }

  // 茅葺の寄棟屋根（横溝屋敷の主屋）。中心 cx、足元 baseY、幅 w、棟までの高さ h。
  vec3 thatchRoof(vec3 col, vec2 vp, float cx, float baseY, float w, float h, vec3 lightC) {
    float dx = (vp.x - cx);
    // 寄棟: 中央が一番高く、左右へ台形に下がる。屋根面（茅葺）と妻面。
    float roofTopY = baseY + h * (1.0 - smoothstep(0.0, w, abs(dx)) * 0.45); // 棟から軒へ
    float onRoof = step(vp.y, roofTopY) * step(baseY, vp.y) * step(abs(dx), w);
    // 茅葺の素地（褐色がかった灰。葺き目の縦筋）
    vec3 thatch = mix(vec3(0.42, 0.36, 0.27), uHorizon * 0.5, 0.30);
    thatch *= 0.9 + 0.1 * sin(dx * 120.0);                       // 葺き目
    thatch *= mix(0.78, 1.06, smoothstep(-w, w, dx));            // 片側に陽
    thatch += lightC * smoothstep(roofTopY - 0.006, roofTopY, vp.y) * 0.18; // 棟に光
    // 厚い軒（下端の陰）
    thatch *= mix(0.7, 1.0, smoothstep(baseY, baseY + 0.02, vp.y));
    col = mix(col, thatch, onRoof);
    return col;
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
    float curve = -0.09 * ax * ax;
    vec2 vp = vec2(p.x, p.y - pitch + curve);

    // 太陽のゆるやかな移ろい（朝の光）
    float sunAz = sin(uTime * 0.012 * mo) * 0.08;

    // ── 空（澄んだ朝〜昼。下=淡い茜、上=青） ──
    vec3 col = mix(uHorizon, uSkyMid, smoothstep(0.52, 0.82, vp.y));
    col = mix(col, uSkyTop, smoothstep(0.78, 1.0, vp.y));
    vec2 sunC = vec2(-0.42 + sunAz - yaw * 0.18, 0.74);
    float sunDist = distance(vec2(ax, vp.y), sunC);
    col += uSunGlow * exp(-sunDist * 3.2) * 0.5;
    col = mix(col, vec3(1.0, 0.97, 0.9), smoothstep(0.05, 0.04, sunDist) * 0.7);
    // 横にたなびく雲（朝の高層雲）
    float cl = fbm(vec2((ax + yaw * 0.16) * 1.3 + t * 0.006 * mo, vp.y * 2.6));
    float cloud = smoothstep(0.52, 0.72, cl) * smoothstep(0.6, 1.0, vp.y);
    col = mix(col, mix(uSkyMid, vec3(1.0), 0.5), cloud * 0.4);

    // ── 市民の森（尾根を覆う森）。奥ほど青く霞む3層 ──
    float worldX = ax + yaw * 0.5;
    col = forestRidge(col, vp, worldX + 4.0, 0.66, 1.0, 0.10, mix(uDropTint, uSkyMid, 0.55), 0.10, 0.0);
    col = forestRidge(col, vp, worldX + 1.0, 0.62, 1.4, 0.12, mix(uDropTint, uSkyMid, 0.32), 0.16, 0.5);
    col = forestRidge(col, vp, worldX,       0.585, 2.0, 0.13, mix(uDropTint, vec3(0.10, 0.16, 0.10), 0.30), 0.22, 1.0);

    // 谷霧（朝、谷あいに薄くたなびく）
    float mist = smoothstep(0.50, 0.44, vp.y) * smoothstep(0.36, 0.46, vp.y);
    float mistTex = fbm(vec2((ax + yaw * 0.4) * 2.2 + t * 0.012 * mo, vp.y * 6.0));
    col = mix(col, vec3(0.92, 0.93, 0.95), mist * smoothstep(0.35, 0.7, mistTex) * mix(0.2, 0.5, uIntensity));

    // ── 向かいの斜面の住宅地（瓦屋根が斜面に登る＋木立＋畑） ──
    // 斜面帯: vp.y 0.44(谷寄り) 〜 0.585(森の麓)
    float slopeLo = 0.44, slopeHi = 0.585;
    if (vp.y > slopeLo - 0.01 && vp.y < slopeHi + 0.01) {
      float slopeT = clamp((vp.y - slopeLo) / (slopeHi - slopeLo), 0.0, 1.0); // 0=谷 1=麓
      // 斜面の地（畑・草地のモザイク）
      vec2 hg = vec2((worldX) * 7.0, vp.y * 26.0);
      vec2 hi = floor(hg);
      float field = h21(hi + 3.0);
      vec3 ground = mix(vec3(0.30, 0.34, 0.20), vec3(0.42, 0.38, 0.26), field);     // 畑/草地
      ground = mix(ground, mix(uDropTint, vec3(0.2, 0.3, 0.15), 0.4), step(0.6, field) * 0.5); // 木立
      ground = mix(ground, uSkyMid, slopeT * 0.18);                                 // 麓へ霞む
      col = mix(col, ground, smoothstep(slopeLo - 0.01, slopeLo + 0.01, vp.y));
      // 斜面に散らばる小さな住宅（瓦の切妻＋壁）。緑の合間に建つ＝坂の住宅地。
      // 奥(麓)ほど小さく密に見えるよう、行(vp.y)ごとに段違いに置く。
      vec2 cg = vec2(worldX * 20.0 + floor(vp.y * 46.0) * 0.37, vp.y * 23.0);
      vec2 ci = floor(cg); vec2 cf = fract(cg);
      float has = step(0.52, h21(ci + 11.0)) * (1.0 - slopeT * 0.35);      // 麓ほどまばら（森へ）
      float bw = 0.34, bh0 = 0.30;                                         // 家の間口・壁の高さ(cell内割合)
      float dxc = abs(cf.x - 0.5);
      float roofH = bh0 + (bw - dxc) * 1.1;                               // 切妻の稜線（中央が高い）
      float onWall = has * step(0.10, cf.y) * step(cf.y, bh0) * step(dxc, bw);
      float onRoof = has * step(bh0, cf.y) * step(cf.y, roofH) * step(dxc, bw + 0.02);
      float roofT = h11(ci.x * 1.3 + ci.y * 2.1);
      vec3 roofCol = mix(vec3(0.32, 0.35, 0.43), uHorizon * 0.4, 0.3);     // いぶし瓦の青灰
      roofCol = mix(roofCol, mix(vec3(0.42, 0.28, 0.21), uHorizon * 0.4, 0.3), step(0.55, roofT)); // 茶瓦
      roofCol += uSunGlow * 0.14 * smoothstep(0.0, 0.4, 0.5 - cf.x);       // 西/朝の陽が片側に
      vec3 wallCol = mix(vec3(0.74, 0.70, 0.62), uHorizon * 0.4, 0.2);     // モルタル/白壁
      wallCol -= 0.10 * step(0.5, cf.x);                                   // 陰側
      col = mix(col, wallCol, onWall);
      col = mix(col, roofCol, onRoof);
    }

    // ── 谷底（田んぼ・畦道・せせらぎ・道） ──
    float valLo = 0.30, valHi = 0.44;
    if (vp.y < valHi + 0.01) {
      float valT = clamp((valHi - vp.y) / (valHi - valLo), 0.0, 1.0); // 0=奥 1=手前
      // 田んぼ: 横長の区画が奥へ重なる。手前ほど縦に広い（ゆるい遠近）。水を張った田は空を映す。
      float rowH = 0.018 + valT * 0.045;                                  // 手前ほど畦の間隔が広い
      float row = floor(vp.y / rowH + worldX * 0.3);
      float rowf = fract(vp.y / rowH + worldX * 0.3);
      float bund = smoothstep(0.0, 0.12, rowf) * smoothstep(0.0, 0.12, 1.0 - rowf); // 畦道（区画の縁）
      // 区画ごとに「水田／青田」を抽選
      float plot = floor(worldX * (2.5 + valT * 3.0)) + row * 7.0;
      float wet = step(0.45, h21(vec2(plot, row)));
      vec3 paddyWater = mix(uHorizon, uSkyMid, 0.5) * (0.95 + 0.1 * sin(uTime * 0.3 * mo + row)); // 空を映す水面
      vec3 paddyGreen = mix(vec3(0.34, 0.42, 0.22), uDropTint, 0.28);     // 稲の青田
      vec3 paddy = mix(paddyGreen, paddyWater, wet);
      paddy += uSunGlow * wet * smoothstep(0.45, 0.0, abs(ax - sunC.x)) * 0.16; // 水面に朝陽
      vec3 bundC = mix(vec3(0.40, 0.36, 0.26), uHorizon * 0.4, 0.3);      // 畦道
      vec3 valGround = mix(bundC, paddy, bund);
      col = mix(col, valGround, smoothstep(valHi + 0.01, valHi - 0.02, vp.y));
      // せせらぎ（谷を縫う細い流れ。きらめく）
      float brookX = sin(vp.y * 14.0 + 1.0) * 0.05 - 0.18;
      float brook = smoothstep(0.018, 0.0, abs((ax + yaw * 0.7) - brookX)) * smoothstep(valHi, valLo + 0.02, vp.y);
      col = mix(col, mix(uSkyMid, vec3(1.0), 0.3), brook * 0.45);
    }

    // ── 横溝屋敷（谷の主役）。屋敷林に抱かれた茅葺の主屋＋長屋門 ──
    {
      float cx = 0.40 - yaw * 0.55;          // 画面上の位置（やや左の谷あい）。見回しで動く
      float dxs = (p.x - cx) / asp;
      // 屋敷林（主屋の背後にこんもりと茂る濃い緑の鎮守の杜）
      float groveD = length(vec2(dxs, (vp.y - 0.455)) * vec2(0.7, 1.6));
      col = mix(col, mix(uDropTint, vec3(0.09, 0.16, 0.09), 0.45), smoothstep(0.10, 0.07, groveD) * 0.92);
      // 主屋（茅葺の寄棟。広く steep な大屋根）
      float w = 0.075, baseY = 0.402, h = 0.052;
      float ad = abs(dxs);
      float roofTopY = baseY + h * (1.0 - smoothstep(0.30 * w, w, ad));    // 棟は平ら、軒へ落ちる寄棟
      float onRoof = step(vp.y, roofTopY) * step(baseY, vp.y) * step(ad, w);
      vec3 thatch = mix(vec3(0.45, 0.38, 0.28), uHorizon * 0.5, 0.28);     // 茅葺の褐灰
      thatch *= 0.92 + 0.08 * sin(dxs * 160.0);                            // 葺き目の縦筋
      thatch *= mix(0.74, 1.08, smoothstep(-w, w, dxs));                   // 朝陽が片側に
      thatch += uSunGlow * smoothstep(roofTopY - 0.008, roofTopY, vp.y) * 0.20; // 棟に光
      thatch *= mix(0.62, 1.0, smoothstep(baseY, baseY + 0.018, vp.y));    // 厚い軒の陰
      col = mix(col, thatch, onRoof);
      // 妻側の白い漆喰壁（軒下にちらり）
      float gable = step(vp.y, baseY) * step(baseY - 0.016, vp.y) * step(ad, w * 0.7);
      col = mix(col, mix(vec3(0.70, 0.66, 0.58), uHorizon * 0.4, 0.2), gable);
      // 長屋門（手前にやや右、低く横長。瓦屋根＋白漆喰）
      float gcx = cx + 0.085;
      float gdx = abs((p.x - gcx) / asp);
      float gateRoof = step(vp.y, 0.392) * step(0.378, vp.y) * step(gdx, 0.075);
      float gateBody = step(vp.y, 0.378) * step(0.362, vp.y) * step(gdx, 0.068);
      col = mix(col, mix(vec3(0.30, 0.30, 0.36), uHorizon * 0.4, 0.3), gateRoof); // 門の瓦屋根
      col = mix(col, mix(vec3(0.68, 0.64, 0.57), uHorizon * 0.4, 0.2), gateBody); // 白漆喰の胴
      col = mix(col, vec3(0.20, 0.16, 0.12), step(vp.y, 0.376) * step(0.362, vp.y) * step(gdx, 0.012)); // 門の通路（暗い）
    }

    // ── 電柱・電線（昭和の郷愁。谷を横切って垂れる） ──
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float wy = 0.50 + fi * 0.022 + sin((ax + yaw * 1.2) * 2.0 + fi * 1.7) * 0.010;
      float yl = wy + pitch - curve;
      col = mix(col, vec3(0.05, 0.05, 0.06), smoothstep(0.0030, 0.0, abs(p.y - yl)) * 0.55 * step(0.40, wy));
    }

    // ── 近景: 自分の側の斜面（生垣・庭木・柿の木の影） ──
    float fgTop = 0.30 + (fbm(vec2((ax + yaw * 1.3) * 4.0, 2.0)) - 0.5) * 0.05 + uParallax.y * 0.4;
    if (vp.y < fgTop + 0.02) {
      float onFg = smoothstep(fgTop, fgTop - 0.03, vp.y);
      vec3 hedge = mix(vec3(0.16, 0.24, 0.13), uDropTint, 0.4);                 // 生垣の緑
      hedge *= 0.9 + 0.18 * (fbm(vec2((ax + yaw * 1.3) * 22.0, vp.y * 22.0)) - 0.5) * 2.0; // 葉の塊
      hedge += uSunGlow * smoothstep(fgTop - 0.02, fgTop, vp.y) * 0.10;          // 上端に陽
      col = mix(col, hedge, onFg);
    }

    // ── 鳥（はばたきながら谷の空を渡る） ──
    col = flyingBirds(col, vec2(ax + yaw * 0.5, vp.y), t, mo);

    // ── 季節の舞い無し（晴天）。窓ガラス現象 ──
    col = mix(applyGlass(col, p, t, uGlass), col, uWindowOpen);
    col *= 1.0 + uWindowOpen * 0.08;
    col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.0 + uWindowOpen * 0.16);

    // ── レースカーテン（両脇）＋窓枠 ──
    float curtSway = (sin(t * 0.4) * 0.008 + sin(t * 0.19 + 1.0) * 0.005) * (1.0 + uWindowOpen * 2.5);
    float cwid = 0.17 * (1.0 - uWindowOpen * 0.55);
    float gather = max(smoothstep(0.05 + cwid, 0.05, p.x - curtSway), smoothstep(0.95 - cwid, 0.95, p.x + curtSway));
    float curtFolds = 0.55 + 0.45 * sin(p.x * 95.0 + sin(p.y * 3.0 + t * 0.25) * 1.4);
    vec3 lace = mix(uSunGlow, vec3(0.96, 0.94, 0.90), 0.55) * (0.72 + 0.28 * curtFolds);
    col = mix(col, lace, gather * (0.22 + 0.16 * curtFolds));

    float mx = 0.05, my = 0.05;
    float fr = max(max(step(p.x, mx), step(1.0 - mx, p.x)), max(step(p.y, my), step(1.0 - my, p.y)));
    float inner = smoothstep(mx, mx + 0.045, p.x) * smoothstep(mx, mx + 0.045, 1.0 - p.x) *
                  smoothstep(my, my + 0.045, p.y) * smoothstep(my, my + 0.045, 1.0 - p.y);
    col *= mix(0.85, 1.0, inner);
    col = mix(col, vec3(0.06, 0.055, 0.06), fr);

    col = applyGrade(col, frag);
    // 窓を開けたら水彩のモヤを払い、視界をくっきり晴らす
    vec3 clearV = (col - 0.42) * 1.22 + 0.42;
    clearV = mix(vec3(dot(clearV, vec3(0.299, 0.587, 0.114))), clearV, 1.24);
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
  const body = FRAGMENT_BODY.replace('void main()', GLASS_GLSL + '\n' + GRADE_GLSL + '\n' + BIRDS_GLSL + '\n  void main()')
  return defines + body
}
