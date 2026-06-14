// 窓辺シリーズ「海辺の夕暮れ」。水平線・夕陽・きらめく波・遠い島影を描く。
// 指スワイプで見回す（夕陽と島が視差で動く）。
// パレットの5色: 空(top/mid/horizon)・夕陽(sunGlow)・海の深み(dropTint)。

import { GLASS_GLSL } from './glass.js'

export const vertexSource = /* glsl */ `
  attribute vec2 aPosition;
  void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`

const FRAGMENT_BODY = /* glsl */ `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uIntensity;  // 波のきらめきの強さ 0..1
  uniform float uBright;
  uniform vec2 uPan;
  uniform float uGlass;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyMid;
  uniform vec3 uHorizon;
  uniform vec3 uSunGlow;
  uniform vec3 uDropTint;     // 海の深み

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

  void main() {
    vec2 frag = gl_FragCoord.xy / uResolution.xy;
    float asp = uResolution.x / uResolution.y;
    float t = uTime;
    vec2 p = frag;
    vec2 vp = vec2(p.x, p.y - uPan.y);

    float horizon = 0.52;
    float x = (vp.x - 0.5) * asp;
    float sunX = -0.05 + uPan.x * 0.25; // 夕陽は見回しで動く

    // 空（夕暮れ）
    vec3 sky = mix(uHorizon, uSkyMid, smoothstep(horizon, 0.8, vp.y));
    sky = mix(sky, uSkyTop, smoothstep(0.78, 1.0, vp.y));
    float sun = exp(-distance(vec2(x, vp.y), vec2(sunX, horizon + 0.05)) * 3.2);
    sky += uSunGlow * sun * 0.7;

    // 海
    vec3 deep = mix(uDropTint, uHorizon * 0.7, smoothstep(horizon, horizon - 0.5, vp.y));
    vec3 water = deep;
    // 横に走る波のうねり
    float band = sin((horizon - vp.y) * 70.0 + sin(vp.x * 14.0 + t * 0.6) * 1.5 + t * 1.8);
    float shimmer = smoothstep(0.6, 1.0, band) * smoothstep(horizon, horizon - 0.45, vp.y);
    water += uSunGlow * shimmer * mix(0.08, 0.20, uIntensity);
    // 夕陽の反射（縦の道）
    float refl = exp(-abs(x - sunX) * 5.0) * smoothstep(horizon, horizon - 0.4, vp.y);
    refl *= 0.5 + 0.5 * sin((horizon - vp.y) * 55.0 + t * 3.0 + sin(vp.x * 30.0) * 2.0);
    water += uSunGlow * max(refl, 0.0) * 0.5;

    vec3 col = (vp.y > horizon) ? sky : water;

    // 遠い島（水平線のすぐ上に低く）
    float islY = horizon + 0.02 + (fbm(vec2((x - uPan.x * 0.3) * 1.2 + 5.0, 0.0)) - 0.5) * 0.04;
    float isl = step(vp.y, islY) * step(horizon - 0.005, vp.y) *
                smoothstep(0.55, 0.2, abs(x - (0.35 + uPan.x * 0.3)));
    col = mix(col, mix(uDropTint, vec3(0.05, 0.06, 0.09), 0.5), clamp(isl, 0.0, 1.0));

    // ガラス現象
    col = applyGlass(col, p, t, uGlass);

    // 窓枠
    float mx = 0.05, my = 0.05;
    float fr = max(max(step(p.x, mx), step(1.0 - mx, p.x)), max(step(p.y, my), step(1.0 - my, p.y)));
    float inner =
      smoothstep(mx, mx + 0.045, p.x) * smoothstep(mx, mx + 0.045, 1.0 - p.x) *
      smoothstep(my, my + 0.045, p.y) * smoothstep(my, my + 0.045, 1.0 - p.y);
    col *= mix(0.85, 1.0, inner);
    col = mix(col, vec3(0.06, 0.055, 0.07), fr);

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
  const body = FRAGMENT_BODY.replace('void main()', GLASS_GLSL + '\n  void main()')
  return defines + body
}
