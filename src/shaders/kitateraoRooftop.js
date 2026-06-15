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
      col = longBuilding(col, vp, sx - 0.02, 0.105, 0.458, 0.512, mix(vec3(0.80, 0.76, 0.68), uHorizon * 0.4, 0.22), nightAmt);
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

    // 鳥（はばたきながら弧を描いて屋上の空を渡る）
    col = flyingBirds(col, vec2(ax + yaw * 0.5, vp.y), t, mo);

    // ── 抜けの構造（柱・梁）。あなたが立つ7階の開けた区画の骨組み（最前景・固定） ──
    // 部屋のない“骨抜け”の区画から景色を一望する手応え。
    float pillarL = smoothstep(0.055, 0.035, abs(p.x - 0.085)) * step(0.16, p.y);
    float pillarR = smoothstep(0.055, 0.035, abs(p.x - 0.915)) * step(0.16, p.y);
    float beam = smoothstep(0.05, 0.03, abs(p.y - 0.93));
    float frameM = clamp(max(max(pillarL, pillarR), beam), 0.0, 1.0);
    vec3 frameC = mix(vec3(0.40, 0.38, 0.38), uHorizon * 0.3, 0.2);   // コンクリの柱・梁
    frameC *= 0.86 + 0.14 * fbm(vec2(p.x * 22.0, p.y * 7.0));         // 打ちっぱなしのムラ・汚れ
    frameC += uSunGlow * 0.10 * pillarL;                             // 左の柱に陽が回る
    frameC *= mix(0.78, 1.0, smoothstep(0.16, 0.5, p.y));            // 下ほど陰
    col = mix(col, frameC, frameM * 0.96);

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
