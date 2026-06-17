// 情景「夏・晴れ・昼」の主役シェーダー。
// 抜けるような青空、ゆっくり湧く入道雲、地平の陽炎（揺らぎ）を計算で生成する。
// パレットの5色は雨ガラスと共通の名前を使い、ここでは空・雲・陽射しとして解釈する。

import { GRADE_GLSL } from './grade.js'
import { BIRDS_GLSL } from './birds.js'

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
  uniform float uReduceMotion; // モーション過敏配慮 0=通常 1=止める
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

    // ── 入道雲（積乱雲）: 真夏の昼の主役。低い底から高くそびえる大きな白い塊。上面は陽に輝き底は翳る。 ──
    // 以前は密度しきい値が発火せず雲がほぼ出ていなかった（評価 美術-H1）。外形(底細く中広く頂窄む)＋
    // もくもくのfbmで、画面中央にそびえる積乱雲をはっきり主役として立てる。
    vec2 cc = vec2((uv.x - 0.5) * asp, uv.y);
    float cx = cc.x + 0.14 - sin(t * 0.015) * 0.05;            // 雲の中心はやや左・ゆっくり流れる
    float baseY = 0.27, topY = 0.90;
    float vf = clamp((uv.y - baseY) / (topY - baseY), 0.0, 1.0); // 0=底 1=頂
    vec2 q = vec2(cx * 1.5, (uv.y - baseY) * 1.7) + vec2(t * 0.012, -t * 0.010);
    vec2 warp = vec2(fbm(q + 3.1), fbm(q + 7.7)) - 0.5;        // ドメインワープでもくもく感
    float puff = fbm(q + warp * 0.9) * 0.6 + fbm(q * 2.6 + 9.0 + warp) * 0.4; // もくもく密度 0..1
    float halfW = (0.13 + 0.30 * sin(vf * 3.14159)) * (0.78 + puff * 0.66);   // 縁がもくもく膨らむ外形
    float body = (1.0 - smoothstep(halfW * 0.62, halfW, abs(cx)))
               * smoothstep(baseY - 0.015, baseY + 0.07, uv.y)
               * (1.0 - smoothstep(topY - 0.07, topY + 0.02, uv.y));
    float cloudMask = clamp(body * smoothstep(0.30, 0.5, puff + 0.20) * mix(1.0, 1.18, uIntensity), 0.0, 1.0);
    // 立体陰影: 上＋中心＋盛り上がった面が陽を受け白く、底＋外周は青く翳る
    float lit = clamp(smoothstep(0.12, 0.72, vf) * 0.5
                    + (1.0 - smoothstep(0.30, 1.0, abs(cx) / max(halfW, 0.02))) * 0.3
                    + smoothstep(0.42, 0.74, puff) * 0.45, 0.0, 1.0);
    vec3 cloudLit = vec3(1.0, 0.995, 0.97);                    // 陽の当たる白
    vec3 cloudSha = uDropTint * 0.44 + uSkyMid * 0.5;          // 青みの翳り（底・外周）
    vec3 cloudCol = mix(cloudSha, cloudLit, lit);
    cloudCol += uSunGlow * smoothstep(0.40, 0.5, puff) * (1.0 - smoothstep(0.5, 0.64, puff)) * 0.16; // 縁の陽の透け
    col = mix(col, cloudCol, cloudMask);

    // 高層のちぎれ雲（小さな積雲が上空に点々）
    vec2 q2 = cuv * vec2(3.0, 4.2) + vec2(-t * 0.018, 0.0);
    float small = fbm(q2 + warp * 0.4);
    float smallMask = smoothstep(0.60, 0.72, small) * smoothstep(0.56, 0.74, uv.y) * (1.0 - smoothstep(0.86, 1.0, uv.y));
    col = mix(col, mix(uDropTint, vec3(1.0, 0.99, 0.97), 0.4), smallMask * 0.5);

    // 夏空を高く渡る鳥（小さく・はばたきながら）。
    col = flyingBirds(col, vec2((uv.x - 0.5) * asp, uv.y), t, 1.0 - uReduceMotion);

    // 遠くのなだらかな丘（空気遠近で青く霞む＝奥行き）。木立より奥に薄く。
    float treeTop = 0.085 + fbm(vec2(cuv.x * 6.0, 3.0)) * 0.035;
    float hillTop = 0.125 + fbm(vec2(cuv.x * 2.6 + 5.0, 1.0)) * 0.035;
    float hill = smoothstep(hillTop + 0.012, hillTop - 0.012, uv.y) * step(treeTop, uv.y);
    col = mix(col, mix(uHorizon, vec3(0.34, 0.44, 0.42), 0.5), hill * 0.5);
    // 遠くの木立のシルエット（夏の郷愁・緑）。もやでかすませて。
    float tree = smoothstep(treeTop + 0.006, treeTop - 0.006, uv.y);
    vec3 green = mix(vec3(0.16, 0.27, 0.15), uHorizon, 0.4); // 夏の濃い緑＋距離のもや
    col = mix(col, green, tree * 0.85);
    // 手前の夏草の野原（陽の当たる明るい緑。細かな揺らぎでべた塗りを避ける）
    float fieldMask = smoothstep(treeTop, treeTop - 0.05, uv.y);
    vec3 field = mix(vec3(0.20, 0.33, 0.17), vec3(0.28, 0.40, 0.19), clamp((treeTop - uv.y) * 6.0, 0.0, 1.0));
    field *= 0.92 + 0.14 * (fbm(vec2(cuv.x * 70.0, uv.y * 130.0 + t * 0.3)) - 0.5) * 2.0; // 草のきらめき
    field += uSunGlow * 0.04 * (1.0 - smoothstep(treeTop - 0.05, treeTop, uv.y));         // 陽だまり
    col = mix(col, field, fieldMask * 0.7);

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
  const body = FRAGMENT_BODY.replace('void main()', GRADE_GLSL + '\n' + BIRDS_GLSL + '\n  void main()')
  return defines + body
}
