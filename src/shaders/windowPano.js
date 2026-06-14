// 窓辺シリーズ「立体パノラマの窓」。360°写真（equirectangular）を窓から見回す。
// 深度マップ（AI推定）を使い、近い物ほど大きくずれる視差＋ゆるい立体スウェイで奥行きを出す。
// 平面の引き伸ばしにせず、3D写真のように立体に見える。

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
  uniform sampler2D uDepth;
  uniform float uHasDepth;

  float h21(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }

  vec3 samplePano(vec2 uv) {
    return texture2D(uPano, vec2(fract(uv.x), clamp(uv.y, 0.002, 0.998))).rgb;
  }
  // 深度: 1=手前, 0=奥。深度マップが無ければ「下ほど手前」の簡易値。
  float sampleDepth(vec2 uv) {
    if (uHasDepth > 0.5) {
      return texture2D(uDepth, vec2(fract(uv.x), clamp(uv.y, 0.002, 0.998))).r;
    }
    return clamp(uv.y, 0.0, 1.0);
  }

  void main() {
    vec2 frag = gl_FragCoord.xy / uResolution.xy;
    float asp = uResolution.x / uResolution.y;
    float t = uTime;
    vec2 p = frag;

    float yaw = uPan.x;
    float pitch = uPan.y;

    // 視線方向 → パノラマUV（横=360°ループ、縦=見上げ/見下ろし。縦は端の極を避ける）
    float fovX = 0.15;   // 画面に映る横方向（約54°）。小さいほど寄る。
    float vScale = 0.30; // 縦に映る範囲
    float baseU = 0.5 + yaw * 0.16 + (p.x - 0.5) * fovX;
    float baseV = 0.5 - pitch * 0.42 - (p.y - 0.5) * vScale;

    // 立体スウェイ: ごく小さく揺れる視差ベクトル。手前と奥がずれて動き、立体に見える。
    vec2 sway = vec2(sin(t * 0.32), sin(t * 0.26 + 1.7)) * 0.013 * mix(0.45, 1.7, uIntensity);

    // 深度に応じた視差（数回の反復で、近い物が手前に来るよう寄せる＝遮蔽に近い見え方）
    vec2 uv = vec2(baseU, baseV);
    for (int i = 0; i < 4; i++) {
      float d = sampleDepth(uv);
      uv = vec2(baseU, baseV) + sway * (d - 0.5);
    }
    vec3 col = samplePano(uv);

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
    col += (h21(frag * uResolution.xy + t) - 0.5) * 0.008;
    gl_FragColor = vec4(col, 1.0);
  }
`

export function buildFragment() {
  return FRAGMENT_BODY.replace('void main()', GLASS_GLSL + '\n  void main()')
}
