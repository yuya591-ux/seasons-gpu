// 窓辺シリーズ「立体パノラマの窓」。360°写真（equirectangular）を窓から見回す。
// 平面の引き伸ばしにせず、簡易深度による視差で奥行きを出す（手前ほど大きくずれる）。
// 本実装では実写真にAIで推定した深度マップを与えると、物ごとにより正確に立体化できる。

import { GLASS_GLSL } from './glass.js'

export const vertexSource = /* glsl */ `
  attribute vec2 aPosition;
  void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`

const FRAGMENT_BODY = /* glsl */ `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uIntensity;  // 立体感（視差の強さ）0..1
  uniform float uBright;
  uniform vec2 uPan;
  uniform float uGlass;
  uniform sampler2D uPano;
  uniform float uHasPano;

  float h21(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }

  // 横方向は360°ループ、縦は端で留める
  vec3 samplePano(vec2 uv) {
    return texture2D(uPano, vec2(fract(uv.x), clamp(uv.y, 0.002, 0.998))).rgb;
  }

  void main() {
    vec2 frag = gl_FragCoord.xy / uResolution.xy;
    float asp = uResolution.x / uResolution.y;
    float t = uTime;
    vec2 p = frag;

    // 視線方向 → パノラマのUV（横=ヨーで360°、縦=ピッチ）
    float yaw = uPan.x;
    float pitch = uPan.y;
    float curve = -0.04 * (p.x - 0.5) * asp * (p.x - 0.5) * asp; // ごく弱い湾曲
    float baseU = 0.5 + yaw * 0.16 + (p.x - 0.5) * 0.20;
    float baseV = 0.5 - pitch * 0.45 - (p.y - 0.5) * 0.42 + curve;

    // 簡易深度: 下(地面)ほど手前、暗い所ほど手前。空・遠景は奥。
    vec3 c0 = samplePano(vec2(baseU, baseV));
    float luma = dot(c0, vec3(0.299, 0.587, 0.114));
    float groundCue = smoothstep(0.5, 0.96, baseV);
    float depthNear = clamp(0.55 * groundCue + 0.45 * (1.0 - luma), 0.0, 1.0);

    // 視差: 向いた方向に応じ、手前ほど大きくずらして再サンプル（立体感）
    float k = 0.045 * mix(0.5, 1.6, uIntensity);
    vec2 par = vec2(yaw, pitch * 0.7) * k * (depthNear - 0.42);
    vec3 col = samplePano(vec2(baseU + par.x, baseV + par.y));

    if (uHasPano < 0.5) col = vec3(0.06, 0.06, 0.08); // 未ロード時

    // 窓ガラスの現象（任意）
    col = applyGlass(col, p, t, uGlass);

    // 窓枠（最前景のサッシ・固定）
    float mx = 0.05, my = 0.05;
    float fr = max(max(step(p.x, mx), step(1.0 - mx, p.x)), max(step(p.y, my), step(1.0 - my, p.y)));
    float inner =
      smoothstep(mx, mx + 0.045, p.x) * smoothstep(mx, mx + 0.045, 1.0 - p.x) *
      smoothstep(my, my + 0.045, p.y) * smoothstep(my, my + 0.045, 1.0 - p.y);
    col *= mix(0.86, 1.0, inner);
    col = mix(col, vec3(0.06, 0.055, 0.07), fr);

    col *= uBright;
    col += (h21(frag * uResolution.xy + t) - 0.5) * 0.010;
    gl_FragColor = vec4(col, 1.0);
  }
`

// パノラマはテクスチャ依存でノイズ品質に関係しないため、OCTAVES定義は不要。
export function buildFragment() {
  const body = FRAGMENT_BODY.replace('void main()', GLASS_GLSL + '\n  void main()')
  return body
}
