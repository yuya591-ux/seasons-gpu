// 見本シーンの主役シェーダー「窓ガラスの雨」。
// 画像を使わず計算だけで、にじむ夕焼け → 曇りガラス → 屈折する水滴 を重ねる。
// 品質(quality)に応じて、ぼかしのタップ数とノイズのオクターブ数をコンパイル時に切り替える。

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
  uniform float uRain;       // 雨脚 0..1
  uniform float uBright;     // 明るさ 0.7..1.3
  uniform vec3 uSkyTop;      // 天頂
  uniform vec3 uSkyMid;      // 中空
  uniform vec3 uHorizon;     // 地平
  uniform vec3 uSunGlow;     // 光芒
  uniform vec3 uDropTint;    // 水滴のハイライト

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

  // 夕焼けの下地（地平→中空→天頂のグラデ＋にじむ光芒）。高周波の雲を含まないので、
  // これ自体が「すりガラスのぼけた背景」としてそのまま使える＝多重サンプル不要で軽い。
  vec3 skyBase(vec2 uv) {
    float y = clamp(uv.y, 0.0, 1.0);
    vec3 lower = mix(uHorizon, uSkyMid, smoothstep(0.0, 0.55, y));
    vec3 col = mix(lower, uSkyTop, smoothstep(0.40, 1.0, y));
    // 太陽の光芒（地平やや上、画面中央寄り）。雨で弱める。
    float glow = exp(-distance(uv, vec2(0.5, 0.18)) * 3.4);
    col += uSunGlow * glow * (0.9 - 0.35 * uRain);
    return col;
  }

  // くっきり版＝下地に、ゆっくり流れる雲のにじみ（fbm 1回）を重ねたもの。
  // 水滴を通して見える「シャープな外の景色」に使う。
  vec3 skySharp(vec2 uv, float t) {
    vec3 col = skyBase(uv);
    float clouds = fbm(uv * vec2(2.6, 2.2) + vec2(t * 0.011, t * 0.005));
    col = mix(col, col * 0.84, smoothstep(0.45, 0.85, clouds) * 0.5);
    return col;
  }

  // 曇りガラス一面の細かい水滴（生成と乾きをゆっくり繰り返す）
  // 戻り: vec3(屈折オフセット.xy, マスク)
  vec3 staticDroplets(vec2 uv, float t) {
    vec2 cells = vec2(34.0, 34.0);
    vec2 g = uv * cells;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float n = hash21(id);
    float n2 = hash21(id + 13.7);
    vec2 c = (vec2(n, n2) - 0.5) * 0.6;
    float dist = length(f - c);
    float r = 0.12 + 0.16 * n;
    float drop = smoothstep(r, r * 0.35, dist);
    float life = sin(t * 0.25 + n * 30.0) * 0.5 + 0.5;
    drop *= smoothstep(0.15, 0.6, life);
    return vec3((f - c) * drop, drop);
  }

  // 縦に走る大滴とトレイル
  vec3 runningStreaks(vec2 uv, float t) {
    vec2 cells = vec2(9.0, 1.0);
    float colId = floor(uv.x * cells.x);
    float cr = hash21(vec2(colId, 5.0));
    float active = step(0.40, cr);
    float lx = fract(uv.x * cells.x) - 0.5;
    lx += sin(uv.y * 6.0 + cr * 6.2831) * 0.10; // 蛇行
    float speed = mix(0.06, 0.16, hash21(vec2(colId, 9.0)));
    float headY = fract(cr * 10.0 + t * speed); // 0(上)→1(下)
    float yy = 1.0 - uv.y;                       // 上を0に
    float dy = yy - headY;
    float head = smoothstep(0.14, 0.0, length(vec2(lx * 1.3, dy)));
    // 頭より上に伸びる細い筋
    float line = smoothstep(0.045, 0.0, abs(lx)) * step(dy, 0.0) * smoothstep(-0.55, 0.0, dy);
    // 筋上に残る小さな滴
    float beads = smoothstep(0.04, 0.0, abs(lx)) * step(dy, 0.0)
                * (sin(yy * 42.0 + cr * 20.0) * 0.5 + 0.5);
    float mask = max(head, max(line * 0.7, beads * 0.35)) * active;
    vec2 off = vec2(lx, dy) * head * active;
    return vec3(off, clamp(mask, 0.0, 1.0));
  }

  void main() {
    vec2 frag = gl_FragCoord.xy / uResolution.xy;
    float asp = uResolution.x / uResolution.y;
    vec2 ruv = vec2((frag.x - 0.5) * asp, frag.y); // 滴を丸くするアスペクト補正
    float t = uTime;
    float rain = clamp(uRain, 0.0, 1.0);

    vec3 sd = staticDroplets(ruv, t);
    vec3 rs = runningStreaks(frag, t);

    float mask = clamp(
      max(sd.z * mix(0.35, 1.0, rain), rs.z * mix(0.25, 1.0, rain)),
      0.0, 1.0
    );
    vec2 refr = (sd.xy + rs.xy * 1.3) * 0.052 * mix(0.6, 1.25, rain);

    // すりガラスの下地（ぼけ）と、水滴で屈折したシャープな外の景色を混ぜる。
    // 屈折した景色は少し明るく拡大して見えるレンズ感を足す。
    vec3 frosted = skyBase(frag) * 0.92;
    vec3 sharp = skySharp(frag + refr, t) * 1.06;
    vec3 col = mix(frosted, sharp, mask);

    // 水滴のふちのハイライト
    col += uDropTint * mask * 0.09;

    // やわらかな周辺減光
    float vig = 1.0 - 0.28 * smoothstep(0.35, 1.15, distance(frag, vec2(0.5, 0.55)));
    col *= vig;

    col *= uBright;
    // 微量グレインでバンディングを防ぐ
    col += (hash21(frag * uResolution.xy + t) - 0.5) * 0.012;

    gl_FragColor = vec4(col, 1.0);
  }
`

// 品質ごとのコンパイル時パラメータ（雲のfbmのオクターブ数）。
const QUALITY_DEFINES = {
  soft: '#define OCTAVES 5\n',
  standard: '#define OCTAVES 4\n',
  light: '#define OCTAVES 3\n',
}

/** 品質に応じたフラグメントシェーダー文字列を組み立てる。 */
export function buildFragment(quality) {
  const defines = QUALITY_DEFINES[quality] || QUALITY_DEFINES.standard
  return defines + FRAGMENT_BODY
}
