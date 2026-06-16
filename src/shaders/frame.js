// 窓辺シリーズ共通の「窓枠（額装）」。各 window シェーダーの main 直前に注入して使う。
// 薄い黒縁だけだと「窓辺」に見えない（評価指摘）ため、アルミサッシ＋中央の縦横の桟＋
// 厚い窓台＋見込みの陰で、どの情景も同じ“窓から眺める”額装に統一する。
// 乗り出す(uLeanOut)と枠が溶けて景色だけになる。

export const FRAME_GLSL = `
  // p=0..1 の画面座標, preFrame=枠前の景色（乗り出し用）, lean=uLeanOut(0..1)。
  vec3 windowSash(vec3 col, vec2 p, vec3 preFrame, float lean) {
    float bw = 0.052;  // 外周サッシの幅
    float bar = 0.011; // 中央の縦横の桟の幅
    // 見込みの陰（窓の内側がほのかに翳る＝室内側の奥行き）。
    float inner =
      smoothstep(bw, bw + 0.075, p.x) * smoothstep(bw, bw + 0.075, 1.0 - p.x) *
      smoothstep(bw, bw + 0.075, p.y) * smoothstep(bw, bw + 0.075, 1.0 - p.y);
    col *= mix(0.78, 1.0, inner);
    // ガラスの落ち込み陰: 桟/枠のすぐ内側でガラスが暗くなる＝サッシが手前に出て見える立体。
    float dEdge = min(min(p.x, 1.0 - p.x), min(p.y, 1.0 - p.y)) - bw; // 外枠内端からの距離
    float dBar = min(abs(p.x - 0.5), abs(p.y - 0.52)) - bar;          // 桟端からの距離
    float recess = (1.0 - smoothstep(0.0, 0.02, dEdge)) + (1.0 - smoothstep(0.0, 0.02, dBar));
    col *= 1.0 - clamp(recess, 0.0, 1.0) * 0.16;
    // 外周のサッシ＋中央の縦桟・横桟（窓を四分＝「窓辺」の象徴）
    float frame = max(max(step(p.x, bw), step(1.0 - bw, p.x)), max(step(p.y, bw), step(1.0 - bw, p.y)));
    float vbar = step(abs(p.x - 0.5), bar);
    float hbar = step(abs(p.y - 0.52), bar);
    float sash = max(frame, max(vbar, hbar));
    // 木/アルミの濃い下地＋縦の木目（ごく薄い）
    vec3 sashCol = vec3(0.125, 0.102, 0.085) * (0.94 + 0.06 * sin(p.y * 240.0));
    col = mix(col, sashCol, sash);
    // 立体の陰影: 光は左上。各桟/枠の左・上側を明るく、右・下側を暗く＝かまぼこ断面の手応え。
    float bevel = clamp(((0.5 - p.x) + (p.y - 0.52)) * 1.6, -0.5, 0.5);
    col += sash * bevel * vec3(0.16, 0.145, 0.12);
    // ガラス縁のきらり（サッシと景色の境にごく細い光＝ガラス面の実感）
    float edge = (smoothstep(bw + 0.006, bw, dEdge + bw) - smoothstep(bw, bw - 0.006, dEdge + bw));
    col += vec3(0.10, 0.105, 0.12) * (1.0 - smoothstep(0.0, 0.004, abs(dEdge))) * 0.5;
    // 厚い窓台（下枠を一段厚く・上端に光＝部屋から覗く手応え）
    float sill = smoothstep(bw + 0.032, bw, p.y);
    col = mix(col, vec3(0.14, 0.112, 0.088), sill);
    col += vec3(0.16) * smoothstep(bw + 0.036, bw + 0.026, p.y) * step(bw, p.y);
    return mix(col, preFrame, lean); // 乗り出すと枠が消えて景色だけ
  }
`
