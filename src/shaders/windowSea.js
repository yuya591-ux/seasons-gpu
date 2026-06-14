// 窓辺シリーズ「海辺の夕暮れ」。水平線・夕陽・きらめく波・遠い島影を描く。
// 指スワイプで見回す（夕陽と島が視差で動く）。
// パレットの5色: 空(top/mid/horizon)・夕陽(sunGlow)・海の深み(dropTint)。

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
    // 一人称の視界（ヨー/ピッチ＋ゆるい湾曲）
    float yaw = uPan.x;
    float pitch = uPan.y;
    float ax = (p.x - 0.5) * asp;
    float curve = -0.08 * ax * ax;
    vec2 vp = vec2(p.x, p.y - pitch + curve);

    float horizon = 0.52;
    float sunAz = -0.05;             // 世界に固定した夕陽の方位
    float sunScreenX = sunAz - yaw;  // 首を振ると視界の中を動く

    // ── 空（夕暮れ・水平線に沈む夕陽・層雲・地平の霞） ──
    vec3 sky = mix(uHorizon, uSkyMid, smoothstep(horizon, 0.82, vp.y));
    sky = mix(sky, uSkyTop, smoothstep(0.80, 1.0, vp.y));
    vec2 sunP = vec2(ax - sunScreenX, vp.y - (horizon + 0.02));
    float sunDist = length(sunP * vec2(1.0, 1.3));
    float sun = exp(-sunDist * 3.0);                        // 大きなグロー
    float sunDisc = smoothstep(0.058, 0.046, sunDist);     // 太陽円盤（水平線に半分沈む）
    sky += uSunGlow * sun * 0.7;
    sky = mix(sky, mix(uSunGlow, vec3(1.0, 0.96, 0.86), 0.45), sunDisc * 0.92);
    // 横に伸びる層雲（夕陽で底が染まる）
    float cl = fbm(vec2((ax + yaw) * 1.2 + t * 0.006, vp.y * 3.0));
    float cloud = smoothstep(0.5, 0.75, cl) * smoothstep(horizon + 0.02, 0.96, vp.y);
    sky = mix(sky, mix(uHorizon, uSunGlow, 0.5), cloud * 0.35);
    // 地平の霞（海と空の境を柔らかく＝郷愁）
    float hazeB = exp(-abs(vp.y - horizon) * 24.0);
    sky = mix(sky, mix(uHorizon, uSunGlow, 0.3), hazeB * 0.4);

    // ── 海面（寄せるうねり・フレネル・夕陽の道・波頭の泡） ──
    float depth = clamp((horizon - vp.y) / horizon, 0.0, 1.0); // 0=水平線, 1=手前
    float persp = 1.0 / (depth + 0.05);                        // 水平線ほど細かい
    vec2 swuv = vec2((ax + yaw) * persp, depth * persp);
    float swell = sin(swuv.y * 3.0 - t * 0.6) * 0.5
                + sin(swuv.y * 7.0 + swuv.x * 0.5 - t * 0.9) * 0.3;   // 岸へ寄せる波
    float ripple = fbm(swuv * vec2(1.4, 2.2) + vec2(t * 0.05, -t * 0.3))
                 + 0.5 * fbm(swuv * vec2(3.0, 5.0) + vec2(0.0, -t * 0.5));
    float fres = smoothstep(0.0, 0.5, depth);                  // 手前=深い藍, 水平線=反射
    vec3 reflC = mix(uHorizon, uSunGlow, sun * 0.6);
    vec3 water = mix(reflC, uDropTint, fres);
    water *= 0.82 + 0.26 * (swell * 0.5 + ripple * 0.5);       // うねりの陰影
    // 夕陽の道（太陽の真下に伸びる帯。波頭がきらめき明滅）
    float pathW = exp(-abs(ax - sunScreenX) * (3.0 + depth * 6.0));
    float spark = smoothstep(0.55, 0.95, ripple + swell * 0.3);
    float scint = 0.5 + 0.5 * sin(swuv.x * 30.0 + swuv.y * 18.0 - t * 6.0);
    water += uSunGlow * pathW * spark * scint * mix(0.7, 1.3, uIntensity);
    // 波頭の白い泡（手前ほど）
    float foam = smoothstep(0.86, 1.02, ripple + swell * 0.3) * smoothstep(0.25, 0.85, depth);
    water = mix(water, vec3(0.85, 0.88, 0.9), foam * 0.22);
    // 岸へ寄せる波の白い筋（手前に横に走る＝立体感）
    float crestLine = sin(swuv.y * 6.0 - t * 0.7) * 0.5 + 0.5;
    float crest = smoothstep(0.72, 0.96, crestLine + (ripple - 0.5) * 0.4) * smoothstep(0.35, 0.9, depth);
    water = mix(water, vec3(0.82, 0.85, 0.87), crest * 0.18);

    vec3 col = (vp.y > horizon) ? sky : water;

    // 遠い島影（世界に固定。空気遠近で霞む）
    float islX = 0.35 - yaw;
    float islY = horizon + 0.02 + (fbm(vec2((ax + yaw) * 1.2 + 5.0, 0.0)) - 0.5) * 0.04;
    float isl = step(vp.y, islY) * step(horizon - 0.01, vp.y) *
                smoothstep(0.5, 0.18, abs(ax - islX));
    col = mix(col, mix(mix(uDropTint, uHorizon, 0.4), vec3(0.05, 0.06, 0.09), 0.4), clamp(isl, 0.0, 1.0) * 0.85);

    // 灯台（遠くの岬に立つ。光がゆっくり明滅する）
    float lhX = 0.62 - yaw;
    float lhTop = horizon + 0.055;
    float lhTower = step(abs(ax - lhX), 0.006) * step(vp.y, lhTop) * step(horizon + 0.002, vp.y);
    col = mix(col, vec3(0.04, 0.05, 0.07), lhTower);
    float lhLight = exp(-length(vec2(ax - lhX, vp.y - lhTop) * vec2(1.0, 1.2)) * 55.0);
    float beam = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(t * 0.7), 4.0); // ゆっくり強く灯る
    col += vec3(1.0, 0.95, 0.8) * lhLight * beam * 0.85;

    // 漁火（遠くの漁船の灯り。水平線近くにぽつぽつ揺れる）
    for (int fi2 = 0; fi2 < 3; fi2++) {
      float ff = float(fi2);
      float fx2 = (h11(ff * 7.0 + 1.0) - 0.5) * 1.5 - yaw;
      float fy2 = horizon - 0.012 - h11(ff * 3.0 + 2.0) * 0.014;
      float fd = length(vec2(ax - fx2, vp.y - fy2) * vec2(1.0, 2.6));
      float bob = 0.55 + 0.45 * sin(t * 0.5 + ff * 2.0);
      col += mix(vec3(1.0, 0.78, 0.5), vec3(0.8, 0.9, 1.0), h11(ff * 5.0)) * exp(-fd * 130.0) * bob * 0.6;
    }

    // 手前の防波堤（左手のテトラ/岩のシルエット）。海辺にいる手応え
    float bwTop = 0.115 + (fbm(vec2((ax + yaw * 1.1) * 5.0, 1.0)) - 0.5) * 0.035;
    float breakwater = step(vp.y, bwTop) * smoothstep(-0.15, -0.5, ax - 0.0);
    col = mix(col, vec3(0.03, 0.035, 0.045), clamp(breakwater, 0.0, 1.0));

    // 海鳥の影（V字が空をゆっくり横切る）
    for (int bi = 0; bi < 3; bi++) {
      float bfi = float(bi);
      float bx = fract(t * 0.012 + bfi * 0.31) * 2.6 - 1.3;
      float by = 0.72 + bfi * 0.035 + sin(t * 0.3 + bfi) * 0.012;
      vec2 bp = vec2((ax + yaw * 0.9) - bx, vp.y - by);
      bp.x = abs(bp.x);
      float wing = smoothstep(0.010, 0.0, abs(bp.y - bp.x * 0.4)) * step(bp.x, 0.022);
      col = mix(col, col * 0.55, wing * 0.6);
    }

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
