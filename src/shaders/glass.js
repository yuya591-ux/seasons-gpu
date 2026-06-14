// 窓ガラスに付く現象のオーバーレイ（雪・雨）。窓辺シリーズの各シェーダーで共有する GLSL 片。
// 各シェーダーが既に定義している h21() を使う前提。uGlass: 0=なし 1=雨 2=雪。

export const GLASS_GLSL = /* glsl */ `
  // 舞う雪（手前ほど大きく速い3層）
  vec3 snowOverlay(vec3 col, vec2 p, float t) {
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float sc = mix(7.0, 20.0, fi * 0.5);
      float sp = mix(0.05, 0.13, fi * 0.5);
      vec2 gp = vec2(p.x * sc * 0.6, p.y * sc);
      gp.y += t * sp * sc;
      gp.x += sin(t * 0.3 + fi * 2.0 + p.y * 5.0) * 0.7; // 横揺れ
      vec2 id = floor(gp);
      vec2 f = fract(gp) - 0.5;
      float n = h21(id + fi * 17.0);
      float r = 0.10 + 0.12 * n;
      float flake = smoothstep(r, r * 0.2, length(f)) * step(0.45, n);
      col = mix(col, vec3(0.93, 0.96, 1.0), flake * (0.5 + 0.4 * fi * 0.5));
    }
    return col;
  }

  // ガラスを流れる雨（細い筋＋頭）
  vec3 rainOverlay(vec3 col, vec2 p, float t) {
    vec2 gp = vec2(p.x * 8.0, p.y);
    float c = floor(gp.x);
    float cr = h21(vec2(c, 3.0));
    float lx = fract(gp.x) - 0.5;
    float sp = mix(0.5, 1.0, cr);
    float yy = fract(p.y * 1.3 - t * sp + cr);
    float head = smoothstep(0.05, 0.0, length(vec2(lx * 0.5, (yy - 0.5) * 0.35)));
    float streak = smoothstep(0.025, 0.0, abs(lx)) * smoothstep(0.0, 0.5, 1.0 - yy) * 0.4;
    float m = max(head, streak) * step(0.4, cr);
    col = mix(col, mix(col * 1.15, vec3(0.82, 0.86, 0.95), 0.5), m * 0.55);
    return col;
  }

  vec3 applyGlass(vec3 col, vec2 p, float t, float mode) {
    if (mode > 1.5) return snowOverlay(col, p, t);
    if (mode > 0.5) return rainOverlay(col, p, t);
    return col;
  }
`
