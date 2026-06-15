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

    // ── 入道雲（積乱雲）: もくもく立ち上がる大きな塊。上面は陽に白く輝き、底は青く翳る ──
    vec2 q = cuv * vec2(1.15, 1.5) + vec2(t * 0.009, 0.0);
    vec2 warp = vec2(fbm(q + 3.1), fbm(q + 7.7)) - 0.5;       // ドメインワープでもくもく感
    float d1 = fbm(q + warp * 0.9);
    float d2 = fbm(q * 2.4 + 11.0 + warp);
    float dens = d1 * 0.66 + d2 * 0.34;
    float d1u = fbm(q + vec2(0.0, 0.07) + warp * 0.9);        // 少し上の密度
    // 入道雲らしく低い所から高くそびえる帯
    float tower = smoothstep(0.10, 0.26, uv.y) * (1.0 - smoothstep(0.74, 0.99, uv.y));
    float cloudMask = smoothstep(0.42, 0.52, dens) * tower;   // 厚く・はっきり
    cloudMask = clamp(cloudMask * mix(1.0, 1.3, uIntensity), 0.0, 1.0);
    // 密度の縦勾配を「光の当たる面」に: 上面が陽を受け、底は影る（はっきりした立体感）
    float topLight = smoothstep(-0.07, 0.09, d1 - d1u);
    float core = smoothstep(0.5, 0.9, dens);
    vec3 cloudLit = mix(uDropTint, vec3(1.0, 0.99, 0.96), 0.4); // 陽の当たる白（やや暖色）
    vec3 cloudSha = uDropTint * 0.32 + uSkyMid * 0.42;          // 青みの濃い翳り（底）
    vec3 cloudCol = mix(cloudSha, cloudLit, topLight);
    cloudCol = mix(cloudCol, cloudCol * 0.82, core * 0.35);     // 芯を締めて厚みを出す
    float rim = smoothstep(0.42, 0.5, dens) * (1.0 - smoothstep(0.5, 0.64, dens));
    cloudCol += uSunGlow * rim * 0.18;                          // 縁の陽の透け
    col = mix(col, cloudCol, cloudMask);

    // 高層のちぎれ雲（小さな積雲が上空に点々）
    vec2 q2 = cuv * vec2(3.0, 4.2) + vec2(-t * 0.018, 0.0);
    float small = fbm(q2 + warp * 0.4);
    float smallMask = smoothstep(0.60, 0.72, small) * smoothstep(0.56, 0.74, uv.y) * (1.0 - smoothstep(0.86, 1.0, uv.y));
    col = mix(col, mix(uDropTint, vec3(1.0, 0.99, 0.97), 0.4), smallMask * 0.5);

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

    col = applyGrade(col, frag); // 全情景共通の「記憶の風景」グレード＋水彩
    col *= uBright;

    // 白とび防止のソフトな天井（ハイライトを滑らかに抑える）
    col -= max(col - vec3(0.82), 0.0) * 0.5;

    // 微量グレインでバンディングを防ぐ
    col += (hash21(frag * uResolution.xy + t) - 0.5) * 0.007;

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
