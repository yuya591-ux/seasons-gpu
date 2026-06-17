// 窓辺シリーズ共通の「窓枠（額装）」。各 window シェーダーの main 直前に注入して使う。
// 薄い黒縁だけだと「窓辺」に見えない（評価指摘）ため、アルミサッシ＋中央の縦横の桟＋
// 厚い窓台＋見込みの陰で、どの情景も同じ“窓から眺める”額装に統一する。
// 乗り出す(uLeanOut)と枠が溶けて景色だけになる。
// 枠の太さは画面の短辺基準の一様単位で測る＝スマホ縦/横どちらでも均一な額装（横向き対応）。

export const FRAME_GLSL = `
  // p=0..1 の画面座標, preFrame=枠前の景色（乗り出し用）, lean=uLeanOut(0..1), asp=uResolution.x/uResolution.y。
  vec3 windowSash(vec3 col, vec2 p, vec3 preFrame, float lean, float asp) {
    float bw = 0.052;  // 外周サッシの幅（短辺基準）
    float bar = 0.011; // 中央の縦横の桟の幅（短辺基準）
    // 横長(asp>1)のときだけ左右の枠を詰めて、上下と同じ太さの均一な額装にする。
    // 縦向き(asp<=1)では kx=ky=1＝従来の額装のまま（縦の見え方は一切変えない）。
    float kx = max(asp, 1.0);
    float ky = 1.0;
    float edgeX = min(p.x, 1.0 - p.x) * kx;   // 左右端からの距離（一様単位）
    float edgeY = min(p.y, 1.0 - p.y) * ky;   // 上下端からの距離
    float edge = min(edgeX, edgeY);            // 最寄りの外端までの距離
    float barD = min(abs(p.x - 0.5) * kx, abs(p.y - 0.52) * ky); // 最寄りの桟までの距離
    // 見込みの陰（窓の内側がほのかに翳る＝室内側の奥行き）。
    float inner = smoothstep(bw, bw + 0.075, edge);
    col *= mix(0.78, 1.0, inner);
    // ガラスの落ち込み陰: 桟/枠のすぐ内側でガラスが暗くなる＝サッシが手前に出て見える立体。
    float dEdge = edge - bw;
    float dBar = barD - bar;
    float recess = (1.0 - smoothstep(0.0, 0.02, dEdge)) + (1.0 - smoothstep(0.0, 0.02, dBar));
    col *= 1.0 - clamp(recess, 0.0, 1.0) * 0.16;
    // 外周のサッシ＋中央の縦桟・横桟（窓を四分＝「窓辺」の象徴）
    float frame = step(edge, bw);
    float vbar = step(abs(p.x - 0.5) * kx, bar);
    float hbar = step(abs(p.y - 0.52) * ky, bar);
    float sash = max(frame, max(vbar, hbar));
    // 木の濃い下地＋不規則な縦木目（二〜三周波＋わずかな赤みのムラ）＝アルミでなく塗装木枠の質感。
    float grain = 0.90 + 0.05 * sin(p.y * 240.0) + 0.045 * sin(p.y * 61.0 + p.x * 9.0) + 0.022 * sin(p.y * 17.0 + 1.3);
    vec3 sashCol = vec3(0.136, 0.108, 0.086) * grain;
    sashCol += vec3(0.012, 0.004, -0.004) * sin(p.y * 31.0 + p.x * 4.0); // 木目の赤みの濃淡
    col = mix(col, sashCol, sash);
    // 立体の陰影: 光は左上。各桟/枠の左・上側を明るく、右・下側を暗く＝かまぼこ断面の手応え。
    float bevel = clamp(((0.5 - p.x) + (p.y - 0.52)) * 1.6, -0.5, 0.5);
    col += sash * bevel * vec3(0.17, 0.15, 0.125);
    // 枠/桟の内端が外の光を拾う暖色のリムライト（厚みのエッジが光り、木枠が手前に立つ＝実写の窓の手応え）。
    float rim = max(1.0 - smoothstep(0.0, 0.007, abs(dEdge)), 1.0 - smoothstep(0.0, 0.006, abs(dBar)));
    col += vec3(0.15, 0.128, 0.10) * rim * 0.7;
    // 厚い窓台（下枠を一段厚く・上端に光＝部屋から覗く手応え）。下端からの距離(一様単位)で測る。
    float bottomU = p.y * ky;
    float sill = smoothstep(bw + 0.032, bw, bottomU);
    col = mix(col, vec3(0.14, 0.112, 0.088), sill);
    col += vec3(0.16) * smoothstep(bw + 0.036, bw + 0.026, bottomU) * step(bw, bottomU);
    return mix(col, preFrame, min(1.0, lean * 1.15)); // 乗り出すと枠が消えて景色だけ（leanが1に漸近しても0.87で完全に消し残像を防ぐ）
  }
`
