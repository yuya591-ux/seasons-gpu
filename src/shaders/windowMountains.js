// 窓辺シリーズ「山あいの朝」。重なる山の稜線を多層パララックスで描く。
// 遠いほど霞み（空気遠近）、近いほど緑が濃い。谷に朝霧。指スワイプで見回す。
// パレットの5色: 空(top/mid/horizon)・朝陽(sunGlow)・近い山の緑(dropTint)。

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
  uniform float uIntensity;  // 朝霧の濃さ 0..1
  uniform float uBright;
  uniform vec2 uPan;
  uniform float uGlass;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyMid;
  uniform vec3 uHorizon;
  uniform vec3 uSunGlow;
  uniform vec3 uDropTint;     // 近い山の緑

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

  // 稜線の高さ
  float ridgeLine(float x, float seed, float baseY, float rough, float amp) {
    return baseY + (fbm(vec2(x * rough + seed, 1.7)) - 0.5) * amp;
  }

  // 1つの山レイヤー。斜面の陰陽・稜線のリムライト・森のテクスチャ・谷の朝霧で立体感を出す。
  // lit=朝陽のリム強さ, tex=森テクスチャの強さ（近い山ほど大）。
  vec3 ridge(vec3 col, vec2 p, float x, float seed, float baseY, float rough, float amp,
             vec3 mcol, float mist, float lit, float tex) {
    float r = ridgeLine(x, seed, baseY, rough, amp);
    float inside = step(p.y, r);
    if (inside < 0.5) {
      // 山の外: 稜線の上にたなびく霧だけ
      float band = smoothstep(r + 0.10, r, p.y) * smoothstep(r - 0.06, r, p.y);
      return mix(col, vec3(0.95, 0.96, 0.96), band * mist);
    }
    float rR = ridgeLine(x + 0.03, seed, baseY, rough, amp);
    float slope = rR - r;                                       // 斜面の向き
    float belowTop = smoothstep(r, r - 0.20, p.y);             // 0=稜線 1=谷
    float shade = clamp(0.55 - slope * 6.0, 0.25, 1.0);        // 朝陽(左)に面する斜面ほど明るい
    vec3 mc = mcol * mix(1.12, 0.70, belowTop) * mix(0.82, 1.12, shade);
    // 森のテクスチャ（近い山ほど）
    float forest = (fbm(vec2(x * 26.0 + seed, p.y * 18.0)) - 0.5) * 0.18 * tex;
    mc *= 1.0 + forest;
    // 朝陽の当たる稜線のリムライト
    mc += uSunGlow * smoothstep(r - 0.015, r, p.y) * lit * 0.35;
    col = mix(col, mc, inside);
    // 谷にたまる朝霧（稜線の少し下、ゆっくり漂う）
    float valley = smoothstep(r - 0.04, r - 0.16, p.y) * smoothstep(r - 0.34, r - 0.16, p.y);
    float drift = 0.6 + 0.4 * fbm(vec2(x * 3.0 + uTime * 0.02, p.y * 4.0));
    col = mix(col, vec3(0.93, 0.95, 0.97), valley * mist * drift * 0.8);
    return col;
  }

  void main() {
    vec2 frag = gl_FragCoord.xy / uResolution.xy;
    float asp = uResolution.x / uResolution.y;
    float t = uTime;
    vec2 p = frag;
    // 一人称の視界（ヨー/ピッチ＋広角の湾曲）
    float yaw = uPan.x;
    float pitch = uPan.y;
    float ax = (p.x - 0.5) * asp;
    float curve = -0.10 * ax * ax;
    vec2 vp = vec2(p.x, p.y - pitch + curve);

    // 朝の空
    vec3 col = mix(uHorizon, uSkyMid, smoothstep(0.3, 0.66, vp.y));
    col = mix(col, uSkyTop, smoothstep(0.62, 1.0, vp.y));
    // 朝陽（世界に固定。首を振ると視界の中を移動する）。円盤＋薄明光線
    vec2 sunC = vec2(-0.25 - yaw, 0.72);
    float sunDist = distance(vec2(ax, vp.y), sunC);
    float sun = exp(-sunDist * 3.0);
    col += uSunGlow * sun * 0.5;
    col = mix(col, vec3(1.0, 0.97, 0.9), smoothstep(0.05, 0.04, sunDist) * 0.7);
    vec2 sd = vec2(ax, vp.y) - sunC;
    float rays = (0.5 + 0.5 * sin(atan(sd.y, sd.x) * 16.0 + uTime * 0.08)) * exp(-length(sd) * 1.3);
    col += uSunGlow * rays * 0.05;

    float mistAmt = mix(0.25, 0.7, uIntensity);

    // 奥→手前（遠いほど空色に霞む）。回転はほぼ一律。lit=リム強, tex=森テクスチャ
    col = ridge(col, vp, ax + yaw * 0.90, 1.0, 0.60, 1.2, 0.16, mix(uSkyMid, uHorizon, 0.5), mistAmt, 0.10, 0.0);
    col = ridge(col, vp, ax + yaw * 0.94, 9.0, 0.52, 1.8, 0.20, mix(uDropTint, uSkyMid, 0.55), mistAmt * 0.8, 0.18, 0.25);

    // 雲海（中腹に漂う朝霧の海。ゆっくり流れ、近い山が突き出る）
    float seaY = 0.46;
    float seaBand = smoothstep(seaY + 0.07, seaY, vp.y) * smoothstep(seaY - 0.11, seaY, vp.y);
    float seaTex = fbm(vec2((ax + yaw) * 2.0 + uTime * 0.015, vp.y * 5.0));
    col = mix(col, vec3(0.92, 0.94, 0.96), seaBand * smoothstep(0.35, 0.7, seaTex) * mistAmt * 0.7);

    col = ridge(col, vp, ax + yaw * 0.98, 21.0, 0.44, 2.6, 0.24, mix(uDropTint, uSkyMid, 0.28), mistAmt * 0.6, 0.26, 0.5);
    col = ridge(col, vp, ax + yaw * 1.02, 37.0, 0.34, 3.4, 0.28, mix(uDropTint, vec3(0.10, 0.15, 0.10), 0.35), mistAmt * 0.35, 0.32, 0.8);
    col = ridge(col, vp, ax + yaw * 1.06, 53.0, 0.20, 4.6, 0.30, vec3(0.08, 0.12, 0.08), 0.0, 0.38, 1.0);

    // 渡り鳥の影（V字が空をゆっくり横切る）
    for (int bi = 0; bi < 3; bi++) {
      float bfi = float(bi);
      float bx = fract(t * 0.011 + bfi * 0.33) * 2.6 - 1.3;
      float by = 0.74 + bfi * 0.03 + sin(t * 0.3 + bfi) * 0.012;
      vec2 bp = vec2((ax + yaw * 0.9) - bx, vp.y - by);
      bp.x = abs(bp.x);
      float wing = smoothstep(0.010, 0.0, abs(bp.y - bp.x * 0.4)) * step(bp.x, 0.022);
      col = mix(col, col * 0.55, wing * 0.6);
    }

    // ガラス現象（雪・雨）
    col = applyGlass(col, p, t, uGlass);

    // 窓枠
    float mx = 0.05, my = 0.05;
    float fr = max(max(step(p.x, mx), step(1.0 - mx, p.x)), max(step(p.y, my), step(1.0 - my, p.y)));
    float inner =
      smoothstep(mx, mx + 0.045, p.x) * smoothstep(mx, mx + 0.045, 1.0 - p.x) *
      smoothstep(my, my + 0.045, p.y) * smoothstep(my, my + 0.045, 1.0 - p.y);
    col *= mix(0.85, 1.0, inner);
    col = mix(col, vec3(0.06, 0.06, 0.07), fr);

    col = applyGrade(col, frag); // 全情景共通の「記憶の風景」グレード＋水彩
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
  const body = FRAGMENT_BODY.replace('void main()', GLASS_GLSL + '\n' + GRADE_GLSL + '\n  void main()')
  return defines + body
}
