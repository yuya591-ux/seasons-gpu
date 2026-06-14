// 情景「夏・晴れ・昼」の主役シェーダー。
// 抜けるような青空、ゆっくり湧く入道雲、地平の陽炎（揺らぎ）を計算で生成する。
// パレットの5色は雨ガラスと共通の名前を使い、ここでは空・雲・陽射しとして解釈する。

import { GRADE_GLSL } from './grade.js'

export const vertexSource = /* glsl */ `
  attribute vec2 aPosition;
  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const FRAGMENT_BODY = /* glsl */ `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uIntensity;  // 陽炎・雲の強さ 0..1
  uniform float uBright;     // 明るさ
  uniform vec3 uSkyTop;      // 天頂の青
  uniform vec3 uSkyMid;      // 中空
  uniform vec3 uHorizon;     // 地平（淡い）
  uniform vec3 uSunGlow;     // 陽射し
  uniform vec3 uDropTint;    // 雲の色（白）

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < OCTAVES; i++) {
      s += a * vnoise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return s;
  }

  void main() {
    vec2 frag = gl_FragCoord.xy / uResolution.xy;
    float asp = uResolution.x / uResolution.y;
    float t = uTime;

    // 陽炎: 地平付近ほど強い、縦に細かく揺れるミラージュ
    float heat = 1.0 - smoothstep(0.0, 0.42, frag.y);
    vec2 uv = frag;
    float wob = sin(frag.y * 90.0 + t * 4.0) * sin(frag.x * 30.0 - t * 2.0);
    uv.x += wob * 0.004 * heat * mix(0.4, 1.2, uIntensity);

    // 空のグラデ（下=淡い、上=濃い青）
    vec3 sky = mix(uHorizon, uSkyMid, smoothstep(0.0, 0.5, uv.y));
    sky = mix(sky, uSkyTop, smoothstep(0.45, 1.0, uv.y));

    // 真昼の陽射し（上方）。白とびしないよう控えめ。
    vec2 suv = vec2((uv.x - 0.5) * asp + 0.5, uv.y);
    float sun = exp(-distance(suv, vec2(0.5, 0.95)) * 2.6);
    sky += uSunGlow * sun * 0.22;

    vec3 col = sky;
    vec2 cuv = vec2((uv.x - 0.5) * asp + 0.5, uv.y);

    // 入道雲: 地平から立ち上がる、もくもくした塊。陽の当たる上が白く、底が翳る。
    vec2 q = cuv * vec2(1.7, 1.9) + vec2(t * 0.012, 0.0);
    float d1 = fbm(q);
    float d2 = fbm(q * 2.3 + 11.0);
    float dens = d1 * 0.68 + d2 * 0.32;
    // 雲が湧く高さ帯（下〜中ほどに集中＝入道雲らしい立ち上がり）
    float tower = smoothstep(0.04, 0.30, uv.y) * (1.0 - smoothstep(0.60, 0.92, uv.y));
    float cloudMask = smoothstep(0.44, 0.58, dens) * tower;
    cloudMask = clamp(cloudMask * mix(0.9, 1.3, uIntensity), 0.0, 1.0);
    // 簡易ライティング: 密度の芯ほど陽が当たって明るい、縁は翳る
    float lit = smoothstep(0.46, 0.74, dens);
    vec3 cloudLit = uDropTint; // 陽の当たる白
    vec3 cloudSha = uDropTint * 0.58 + uSkyMid * 0.16; // 青みを帯びた翳り
    vec3 cloudCol = mix(cloudSha, cloudLit, lit);
    col = mix(col, cloudCol, cloudMask);

    // 遠くの木立のシルエット（夏の郷愁・緑）。最下部に、もやでかすませて薄く。
    float treeTop = 0.085 + fbm(vec2(cuv.x * 6.0, 3.0)) * 0.035;
    float tree = smoothstep(treeTop + 0.006, treeTop - 0.006, uv.y);
    vec3 green = mix(vec3(0.16, 0.27, 0.15), uHorizon, 0.4); // 夏の濃い緑＋距離のもや
    col = mix(col, green, tree * 0.85);

    // 地平の白いもや（暑さ）。白とびしない程度に。
    col = mix(col, mix(col, uHorizon, 0.45), heat * 0.3);

    // ごく軽い周辺減光
    float vig = 1.0 - 0.18 * smoothstep(0.4, 1.2, distance(frag, vec2(0.5, 0.55)));
    col *= vig;

    col = applyGrade(col); // 全情景共通の「記憶の風景」グレード
    col *= uBright;

    // 白とび防止のソフトな天井（ハイライトを滑らかに抑える）
    col -= max(col - vec3(0.82), 0.0) * 0.5;

    // 微量グレインでバンディングを防ぐ
    col += (hash21(frag * uResolution.xy + t) - 0.5) * 0.012;

    gl_FragColor = vec4(col, 1.0);
  }
`

const QUALITY_DEFINES = {
  soft: '#define OCTAVES 5\n',
  standard: '#define OCTAVES 4\n',
  light: '#define OCTAVES 3\n',
}

/** 品質に応じたフラグメントシェーダー文字列を組み立てる。 */
export function buildFragment(quality) {
  const defines = QUALITY_DEFINES[quality] || QUALITY_DEFINES.standard
  const body = FRAGMENT_BODY.replace('void main()', GRADE_GLSL + '\n  void main()')
  return defines + body
}
