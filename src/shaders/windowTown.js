// 情景「窓辺の下町」シリーズの主役シェーダー。
// 高台のアパートの一室の窓から見た、夕暮れの下町を多層パララックスで描く。
// 指スワイプで見回す（uPan）。瓦屋根・団地・電柱電線・灯る窓で郷愁を出す。画像は使わない。
// パレットの5色は他の情景と共通の名前で受け取り、ここでは空・残照・建物・窓灯りとして解釈する。

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
  uniform float uIntensity;  // 街の灯りの多さ 0..1
  uniform float uBright;
  uniform vec2 uPan;         // 見回し（指スワイプ）
  uniform vec3 uSkyTop;      // 天頂（暮れの紫紺）
  uniform vec3 uSkyMid;      // 中空
  uniform vec3 uHorizon;     // 地平（茜）
  uniform vec3 uSunGlow;     // 残照・窓の灯り色
  uniform vec3 uDropTint;    // 建物のシルエット基色

  float h11(float n) { return fract(sin(n) * 43758.5453123); }

  float h21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = h21(i);
    float b = h21(i + vec2(1.0, 0.0));
    float c = h21(i + vec2(0.0, 1.0));
    float d = h21(i + vec2(1.0, 1.0));
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

  // 遠くの緑の稜線
  vec3 hills(vec3 col, vec2 p, float wx, float ridgeY, vec3 hcol) {
    float h = ridgeY + (fbm(vec2(wx * 1.4 + 5.0, 0.0)) - 0.5) * 0.13;
    return mix(col, hcol, step(p.y, h));
  }

  // 街レイヤー（建物のシルエット＋灯る窓）を col に重ねる。
  vec3 town(
    vec3 col, vec2 p, float wx, float ridgeY, float cw, float amp,
    vec3 sil, vec3 light, float winLit, float winCols, float winRows, float seed
  ) {
    float u = wx / cw + seed;
    float cell = floor(u);
    float fx = fract(u);
    float r = h11(cell * 1.37 + 3.1);
    float bw = 0.60 + 0.32 * h11(cell * 2.11 + 7.7);
    float bh = 0.05 + r * amp;
    float gap = step(bw, fx); // 1 = 建物の間（すき間）
    float roofType = h11(cell * 3.7 + 1.0);
    // 屋根: 平らな陸屋根（団地・ビル）が主、たまに瓦の三角屋根
    float peak = (roofType > 0.62) ? (0.5 - abs(fx - bw * 0.5) / max(bw, 0.001)) * amp * 0.7 : 0.0;
    float ridge = ridgeY + (gap > 0.5 ? -0.03 : bh + peak);
    float body = step(p.y, ridge);
    col = mix(col, sil, body);

    // 窓のグリッド（建物本体のみ・三角屋根の頂部は除く）
    if (body > 0.5 && gap < 0.5) {
      vec2 wc = vec2(wx * winCols, p.y * winRows);
      vec2 wid = floor(wc);
      vec2 wf = fract(wc);
      float rect = step(0.18, wf.x) * step(wf.x, 0.82) * step(0.24, wf.y) * step(wf.y, 0.86);
      float below = step(p.y, ridgeY + bh - 0.012); // 屋根の少し下から窓
      float lit = step(1.0 - winLit, h21(wid + seed));
      lit *= 0.78 + 0.22 * sin(uTime * 1.3 + h21(wid) * 33.0); // ちらつき
      vec3 wcol = mix(sil * 1.22, light, lit);
      col = mix(col, wcol, rect * below * 0.9);
    }
    return col;
  }

  void main() {
    vec2 frag = gl_FragCoord.xy / uResolution.xy;
    float asp = uResolution.x / uResolution.y;
    float t = uTime;
    vec2 p = frag;

    // 空（夕暮れ）: 下=茜、上=紫紺
    vec3 col = mix(uSkyMid, uSkyTop, smoothstep(0.52, 1.0, p.y));
    col = mix(uHorizon, col, smoothstep(0.42, 0.62, p.y));
    col += uSunGlow * exp(-abs(p.y - 0.5) * 7.0) * 0.22; // 地平の残照

    float base = (p.x - 0.5) * asp;

    // 奥→手前（視差は手前ほど大きい）
    col = hills(col, p, base + uPan.x * 0.10, 0.55, mix(vec3(0.15, 0.21, 0.18), uHorizon, 0.45));
    col = town(col, p, base + uPan.x * 0.22, 0.50, 0.10, 0.06,
               mix(uDropTint, uHorizon, 0.32), uSunGlow, mix(0.25, 0.5, uIntensity), 60.0, 78.0, 1.3);
    col = town(col, p, base + uPan.x * 0.45, 0.42, 0.16, 0.13,
               mix(uDropTint, uSkyMid, 0.10), uSunGlow, mix(0.40, 0.70, uIntensity), 34.0, 40.0, 7.1);
    col = town(col, p, base + uPan.x * 0.85, 0.30, 0.26, 0.18,
               uDropTint * 0.82, uSunGlow, mix(0.50, 0.85, uIntensity), 18.0, 22.0, 19.3);

    // 電線（手前・郷愁）。ゆるく垂れる数本。
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float yl = 0.66 + fi * 0.035 + sin(p.x * asp * 2.2 + fi * 1.7 + uPan.x * 0.6) * 0.012;
      float d = abs(p.y - yl);
      col = mix(col, vec3(0.02, 0.02, 0.04), smoothstep(0.0035, 0.0, d) * 0.8);
    }

    // 窓枠（最前景のサッシ）
    float mx = 0.05, my = 0.05;
    float fr = max(max(step(p.x, mx), step(1.0 - mx, p.x)), max(step(p.y, my), step(1.0 - my, p.y)));
    float inner =
      smoothstep(mx, mx + 0.045, p.x) * smoothstep(mx, mx + 0.045, 1.0 - p.x) *
      smoothstep(my, my + 0.045, p.y) * smoothstep(my, my + 0.045, 1.0 - p.y);
    col *= mix(0.84, 1.0, inner);            // 枠の内側を少し翳らせる
    col = mix(col, vec3(0.05, 0.045, 0.06), fr); // サッシ本体

    col *= uBright;
    col -= max(col - vec3(0.9), 0.0) * 0.5;  // 白とび防止
    col += (h21(frag * uResolution.xy + t) - 0.5) * 0.012;
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
  return defines + FRAGMENT_BODY
}
