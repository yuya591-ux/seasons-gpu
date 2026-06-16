// 「実写の窓」シェーダー。窓の外を丸ごと Flux 生成の実写画像にし、窓枠＋薄いガラスの映り込み＋
// わずかな視差で「本物の写真を窓から眺めている」実写感を最大化する。計算で作る景色ではなく“写真”が主役。
// 計算は窓枠・ガラス・揺らぎ・グレードだけ＝写真の実写感を一切損なわない薄い上層に徹する。

import { GRADE_GLSL } from './grade.js'
import { FRAME_GLSL } from './frame.js'

export const vertexSource = /* glsl */ `
  attribute vec2 aPosition;
  void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`

const FRAGMENT_BODY = /* glsl */ `
  precision highp float;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec2 uPan;        // 見回し（わずかな視差で生きた窓に）
  uniform vec2 uParallax;   // 覗き込み視差
  uniform float uReduceMotion;
  uniform float uLeanOut;
  uniform float uWindowOpen; // 窓をあける（ガラスの映り込み/くもりが晴れて外気が澄む）
  uniform float uBright;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyMid;
  uniform vec3 uHorizon;
  uniform vec3 uSunGlow;
  uniform vec3 uDropTint;
  uniform sampler2D uBg;
  uniform float uHasBg;

  float hash21(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }

//__FRAME__

  void main() {
    vec2 frag = gl_FragCoord.xy / uResolution.xy;
    float t = uTime;
    // ごく弱い“息づかい”の揺れ（その場に居る気配）。モーション過敏配慮で止める。
    float sm = 1.0 - uReduceMotion;
    vec2 breathe = vec2(sin(t * 0.09) * 0.004, sin(t * 0.06 + 0.7) * 0.003) * sm;
    // 視差＝窓越しに覗く奥行き。見回し(uPan.x)・見下ろし(uPan.y)・傾きで写真を動かす＝生きた窓。
    vec2 par = uPan * vec2(0.10, 0.12) + uParallax * 0.7 + breathe;
    float zoom = 0.92 - 0.05 * uLeanOut - 0.02 * uWindowOpen; // 乗り出す/あけると少し寄って枠の外まで
    vec2 uv = (frag - 0.5) * zoom + 0.5 - vec2(par.x * 0.5, par.y * 0.6);
    vec3 photo = uHasBg > 0.5
      ? texture2D(uBg, vec2(clamp(uv.x, 0.0, 1.0), clamp(1.0 - uv.y, 0.0, 1.0))).rgb
      : mix(uHorizon, uSkyTop, frag.y);
    // 時間帯の色味をそっと乗せる（写真の質感は壊さない）。夕/夜の情景に流用できる。
    float y = clamp(frag.y, 0.0, 1.0);
    vec3 mood = 0.5 + mix(uHorizon, uSkyMid, smoothstep(0.0, 0.7, y));
    photo = mix(photo, photo * mood, 0.12);
    vec3 outside = photo; // 乗り出し用（枠の無い素の景色）

    // 窓ガラスの薄い映り込み（斜めの光の帯）＋窓辺のごく薄いくもり＝ガラス面の実感。
    // 窓をあける/乗り出すと、ガラスが退いて映り込み・くもりが晴れ、外気が澄む（実感のある開閉）。
    float glass = (1.0 - uLeanOut) * (1.0 - uWindowOpen * 0.85);
    float diag = frag.x + frag.y * 0.35;
    float refl = smoothstep(0.30, 0.46, diag) * smoothstep(0.66, 0.5, diag);
    vec3 col = photo + vec3(0.06, 0.066, 0.078) * refl * glass * 0.55;
    float gray = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, mix(col, vec3(gray), 0.5), 0.035 * glass);
    col += photo * uWindowOpen * 0.04; // あけると外光が少し入る

    col = windowSash(col, frag, outside, uLeanOut); // 窓枠（乗り出すと景色だけ）
    col = applyGrade(col, frag);                    // 全情景共通の記憶の風景グレード
    col *= uBright;
    col += (hash21(frag * uResolution.xy + t) - 0.5) * 0.006; // 微グレインでバンディング防止
    gl_FragColor = vec4(col, 1.0);
  }
`

/** フレーム/グレードを注入してフラグメントシェーダーを組み立てる。 */
export function buildFragment(quality) {
  return FRAGMENT_BODY
    .replace('//__FRAME__', FRAME_GLSL)
    .replace('void main()', GRADE_GLSL + '\n  void main()')
}
