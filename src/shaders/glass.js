// 窓ガラスに付く現象のオーバーレイ（雨・雪）。窓辺シリーズの各シェーダーで共有する GLSL 片。
// 各シェーダーが既に定義している h21() と uResolution / uTime を使う前提。uGlass: 0=なし 1=雨 2=雪。
//
// 主役シェーダー rainGlass は「背景を再サンプルして屈折」させられるが、こちらは合成済みの色に
// 重ねるオーバーレイなので、レンズの濡れ感・鏡面ハイライト・ふちの陰りで“ガラスに付いた水滴”を表現する
// （rainGlass の質感に寄せた底上げ）。

export const GLASS_GLSL = /* glsl */ `
  // 光の向き（左上）。水滴の鏡面ハイライトに使う。
  const vec2 G_LIGHT = vec2(-0.45, 0.62);

  // 一面に散る細かい水滴（生成と乾きをゆっくり繰り返す）。
  // 戻り: xy=中心からの相対方向, z=マスク, w=正規化距離(0:中心 .. 1:ふち)
  vec4 g_staticDrops(vec2 uv, float t) {
    vec2 cells = vec2(30.0, 30.0);
    vec2 g = uv * cells;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float n = h21(id);
    float n2 = h21(id + 13.7);
    vec2 c = (vec2(n, n2) - 0.5) * 0.55;
    vec2 dir = f - c;
    float dist = length(dir);
    float r = 0.10 + 0.15 * n;
    float drop = smoothstep(r, r * 0.35, dist);
    float life = sin(t * 0.22 + n * 30.0) * 0.5 + 0.5;
    drop *= smoothstep(0.10, 0.6, life);
    return vec4(dir, drop, clamp(dist / r, 0.0, 1.0));
  }

  // 縦に走る大滴とトレイル（蛇行する筋＋頭＋小さな滴）。
  // 戻り: xy=頭の中心からの相対, z=マスク, w=頭の強さ
  vec4 g_streaks(vec2 uv, float t) {
    vec2 cells = vec2(9.0, 1.0);
    float colId = floor(uv.x * cells.x);
    float cr = h21(vec2(colId, 5.0));
    float active = step(0.42, cr);
    float lx = fract(uv.x * cells.x) - 0.5;
    lx += sin(uv.y * 6.0 + cr * 6.2831) * 0.10;
    float speed = mix(0.06, 0.16, h21(vec2(colId, 9.0)));
    float headY = fract(cr * 10.0 + t * speed);
    float yy = 1.0 - uv.y;
    float dy = yy - headY;
    vec2 hd = vec2(lx * 1.3, dy);
    float head = smoothstep(0.13, 0.0, length(hd));
    float line = smoothstep(0.04, 0.0, abs(lx)) * step(dy, 0.0) * smoothstep(-0.5, 0.0, dy);
    float beads = smoothstep(0.035, 0.0, abs(lx)) * step(dy, 0.0)
                * (sin(yy * 42.0 + cr * 20.0) * 0.5 + 0.5);
    float mask = max(head, max(line * 0.6, beads * 0.3)) * active;
    return vec4(hd, clamp(mask, 0.0, 1.0), head * active);
  }

  // ガラスを流れる雨（濡れたレンズ・鏡面・ふちの陰り）
  vec3 rainOverlay(vec3 col, vec2 p, float t) {
    float asp = uResolution.x / uResolution.y;
    vec2 ruv = vec2(p.x * asp, p.y);              // 滴を丸くするアスペクト補正
    vec4 sd = g_staticDrops(ruv, t);
    vec4 rs = g_streaks(p, t);
    float sMask = sd.z;
    float rMask = rs.z;

    // 濡れたガラスのレンズ感: 滴の中はわずかに明るく持ち上がり、ふちは暗く締まる
    vec3 wet = col * (1.0 + (1.0 - sd.w) * 0.10);  // 中心ほど明るい
    wet *= 1.0 - smoothstep(0.7, 1.0, sd.w) * 0.20; // ふちの陰り
    col = mix(col, wet, sMask);

    // 鏡面ハイライト（濡れた立体感）: ふち寄りで、光に面した側がきらめく
    vec2 sn = normalize(sd.xy + 1e-5);
    float sSpec = smoothstep(0.5, 0.96, dot(sn, normalize(G_LIGHT)))
                * smoothstep(0.35, 1.0, sd.w) * sMask;
    vec2 rn = normalize(rs.xy + 1e-5);
    float rSpec = smoothstep(0.4, 0.96, dot(rn, normalize(G_LIGHT))) * rs.w;
    col += vec3(0.95, 0.97, 1.0) * (sSpec + rSpec) * 0.16;

    // 流れた筋はうっすら濡れて明るい
    col = mix(col, col * 1.08 + vec3(0.02), rMask * 0.45);
    return col;
  }

  // 舞う雪（手前ほど大きく速い3層。やわらかい縁・奥はぼけて淡い）
  vec3 snowOverlay(vec3 col, vec2 p, float t) {
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float depth = fi * 0.5;                      // 0:奥 .. 1:手前
      float sc = mix(8.0, 20.0, depth);
      float sp = mix(0.05, 0.13, depth);
      vec2 gp = vec2(p.x * sc * 0.6, p.y * sc);
      gp.y += t * sp * sc;
      gp.x += sin(t * 0.3 + fi * 2.0 + p.y * 5.0) * 0.7; // 横揺れ
      vec2 id = floor(gp);
      vec2 f = fract(gp) - 0.5;
      float n = h21(id + fi * 17.0);
      float r = 0.08 + 0.12 * n;
      // 奥の層はぼかして淡く、手前ははっきり
      float soft = mix(0.35, 0.12, depth);
      float flake = smoothstep(r, r * soft, length(f)) * step(0.5, n);
      float bright = mix(0.45, 0.95, depth);
      col = mix(col, vec3(0.93, 0.96, 1.0), flake * bright);
    }
    return col;
  }

  vec3 applyGlass(vec3 col, vec2 p, float t, float mode) {
    if (mode > 1.5) return snowOverlay(col, p, t);
    if (mode > 0.5) return rainOverlay(col, p, t);
    return col;
  }
`
