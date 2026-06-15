// 窓辺シリーズ共通の「窓枠（額装）」。各 window シェーダーの main 直前に注入して使う。
// 薄い黒縁だけだと「窓辺」に見えない（評価指摘）ため、アルミサッシ＋中央の縦横の桟＋
// 厚い窓台＋見込みの陰で、どの情景も同じ“窓から眺める”額装に統一する。
// 乗り出す(uLeanOut)と枠が溶けて景色だけになる。

export const FRAME_GLSL = `
  // p=0..1 の画面座標, preFrame=枠前の景色（乗り出し用）, lean=uLeanOut(0..1)。
  vec3 windowSash(vec3 col, vec2 p, vec3 preFrame, float lean) {
    float bw = 0.05;   // 外周サッシの幅
    float bar = 0.010; // 中央の縦横の桟の幅
    // 見込みの陰（窓の内側がほのかに翳る＝室内側の奥行き）
    float inner =
      smoothstep(bw, bw + 0.075, p.x) * smoothstep(bw, bw + 0.075, 1.0 - p.x) *
      smoothstep(bw, bw + 0.075, p.y) * smoothstep(bw, bw + 0.075, 1.0 - p.y);
    col *= mix(0.85, 1.0, inner);
    // 外周のサッシ＋中央の縦桟・横桟（窓を四分＝「窓辺」の象徴）
    float frame = max(max(step(p.x, bw), step(1.0 - bw, p.x)), max(step(p.y, bw), step(1.0 - bw, p.y)));
    float vbar = step(abs(p.x - 0.5), bar);
    float hbar = step(abs(p.y - 0.52), bar);
    float sash = max(frame, max(vbar, hbar));
    col = mix(col, vec3(0.09, 0.082, 0.078), sash); // 暗褐色のサッシ
    // 厚い窓台（下枠を一段厚く・上端に光＝部屋から覗く手応え）
    float sill = smoothstep(bw + 0.03, bw, p.y);
    col = mix(col, vec3(0.13, 0.105, 0.085), sill);
    col += vec3(0.13) * smoothstep(bw + 0.034, bw + 0.026, p.y) * step(bw, p.y);
    return mix(col, preFrame, lean); // 乗り出すと枠が消えて景色だけ
  }
`
