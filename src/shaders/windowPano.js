// 窓辺シリーズ「立体パノラマの窓」。360°写真（equirectangular）を窓から見回す。
// 深度マップ（AI推定）を使い、近い物ほど大きくずれる視差＋ゆるい立体スウェイで奥行きを出す。
// 平面の引き伸ばしにせず、3D写真のように立体に見える。

import { GLASS_GLSL } from './glass.js'
import { GRADE_GLSL } from './grade.js'

export const vertexSource = /* glsl */ `
  attribute vec2 aPosition;
  void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`

const FRAGMENT_BODY = /* glsl */ `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uIntensity;  // 立体感（視差の強さ）0..1
  uniform float uBright;
  uniform vec2 uPan;
  uniform vec2 uParallax;    // 見回しの動きに連動した視差
  uniform float uGlass;
  uniform sampler2D uPano;
  uniform float uHasPano;
  uniform sampler2D uDepth;
  uniform float uHasDepth;

  float h21(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }

  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float a = h21(i); float b = h21(i + vec2(1.0, 0.0));
    float c = h21(i + vec2(0.0, 1.0)); float d = h21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.0; a *= 0.5; }
    return s;
  }

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

    // 視差 = 常時のかすかな立体スウェイ ＋ 見回しの動きに連動した視差（首を振ると手前が動く）
    vec2 sway = vec2(sin(t * 0.30), sin(t * 0.25 + 1.7)) * 0.009;
    vec2 par = (sway + uParallax) * mix(0.6, 2.1, uIntensity);

    // 深度に応じて反復し、近い物ほど大きくずらす（遮蔽に近い見え方）
    vec2 uv = vec2(baseU, baseV);
    for (int i = 0; i < 5; i++) {
      float d = sampleDepth(uv);
      uv = vec2(baseU, baseV) + par * (d - 0.5);
    }
    vec3 col = samplePano(uv);

    if (uHasPano < 0.5) col = vec3(0.06, 0.06, 0.08); // 未ロード時

    // 生命感: 遠くの空に、ゆっくり流れる光のゆらぎ（雲影）を乗せて「止まった写真」感を消す
    float d0 = sampleDepth(vec2(baseU, baseV));
    float skyMask = smoothstep(0.0, 0.30, 1.0 - d0) * smoothstep(0.55, 0.28, baseV);
    float drift = fbm(vec2(baseU * 5.0 - t * 0.012, baseV * 5.0 + t * 0.004)) - 0.5;
    col *= 1.0 + skyMask * drift * 0.20;

    // 「記憶の風景」グレード（全情景共通）。生写真感を抑え、影=藍/ハイライト=橙へ寄せる
    col = applyGrade(col, frag);

    // 窓ガラスの現象（任意）
    col = applyGlass(col, p, t, uGlass);

    // 窓枠（最前景のサッシ・固定）
    float mx = 0.05, my = 0.05;
    float fr = max(max(step(p.x, mx), step(1.0 - mx, p.x)), max(step(p.y, my), step(1.0 - my, p.y)));
    float inner =
      smoothstep(mx, mx + 0.045, p.x) * smoothstep(mx, mx + 0.045, 1.0 - p.x) *
      smoothstep(my, my + 0.045, p.y) * smoothstep(my, my + 0.045, 1.0 - p.y);
    col *= mix(0.86, 1.0, inner);

    // やわらかな周辺減光（記憶の風景らしさ）
    float vig = 1.0 - 0.22 * smoothstep(0.45, 1.25, distance(p, vec2(0.5)));
    col *= vig;

    col = mix(col, vec3(0.06, 0.055, 0.07), fr);

    col *= uBright;
    col += (h21(frag * uResolution.xy + t) - 0.5) * 0.016; // ほのかなフィルムグレイン
    gl_FragColor = vec4(col, 1.0);
  }
`

export function buildFragment() {
  return FRAGMENT_BODY.replace('void main()', GLASS_GLSL + '\n' + GRADE_GLSL + '\n  void main()')
}
