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

  // 1つの山レイヤーを重ね、稜線直上に霧をかける
  vec3 ridge(vec3 col, vec2 p, float x, float seed, float baseY, float rough, float amp, vec3 mcol, float mist) {
    float r = ridgeLine(x, seed, baseY, rough, amp);
    col = mix(col, mcol, step(p.y, r));
    // 稜線の上にたなびく霧
    float band = smoothstep(r + 0.10, r, p.y) * smoothstep(r - 0.06, r, p.y);
    col = mix(col, vec3(0.95, 0.96, 0.96), band * mist);
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
    // 朝陽（世界に固定。首を振ると視界の中を移動する）
    float sun = exp(-distance(vec2(ax, vp.y), vec2(-0.25 - yaw, 0.72)) * 3.0);
    col += uSunGlow * sun * 0.5;

    float mistAmt = mix(0.25, 0.7, uIntensity);

    // 奥→手前（遠いほど空色に霞む）。回転はほぼ一律。
    col = ridge(col, vp, ax + yaw * 0.90, 1.0, 0.60, 1.2, 0.16, mix(uSkyMid, uHorizon, 0.5), mistAmt);
    col = ridge(col, vp, ax + yaw * 0.94, 9.0, 0.52, 1.8, 0.20, mix(uDropTint, uSkyMid, 0.55), mistAmt * 0.8);
    col = ridge(col, vp, ax + yaw * 0.98, 21.0, 0.44, 2.6, 0.24, mix(uDropTint, uSkyMid, 0.28), mistAmt * 0.6);
    col = ridge(col, vp, ax + yaw * 1.02, 37.0, 0.34, 3.4, 0.28, mix(uDropTint, vec3(0.10, 0.15, 0.10), 0.35), mistAmt * 0.35);
    col = ridge(col, vp, ax + yaw * 1.06, 53.0, 0.20, 4.6, 0.30, vec3(0.08, 0.12, 0.08), 0.0);

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

    col = applyGrade(col); // 全情景共通の「記憶の風景」グレード
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
