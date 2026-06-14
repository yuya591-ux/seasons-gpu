// 「記憶の風景」共通グレード。全情景を一つの色調にそろえ、生写真・原色っぽさを抑える。
// 各シェーダーの最終色（明るさ uBright を掛ける直前）に applyGrade(col) を1回かける。
// 内容: わずかな減彩 → スプリットトーン（影=藍 / ハイライト=橙）→ ゆるいSカーブ → 柔らかいブルーム。
// GLASS_GLSL と同じく、buildFragment 内で main 直前に文字列挿入して使う（float精度の宣言後に置く）。

export const GRADE_GLSL = /* glsl */ `
  vec3 applyGrade(vec3 c) {
    float luma = dot(c, vec3(0.299, 0.587, 0.114));
    // 1) 彩度を落とす（記憶の退色＝ノスタルジア。やや強め）
    c = mix(vec3(luma), c, 0.79);
    // 2) スプリットトーン: 影に藍(#1a2436)、ハイライトに橙(#ffcaa0)をそっと寄せる
    float sh = smoothstep(0.45, 0.0, luma);
    float hi = smoothstep(0.55, 1.0, luma);
    c += (vec3(0.102, 0.141, 0.212) - luma) * sh * 0.08;
    c += (vec3(1.000, 0.792, 0.627) - luma) * hi * 0.055;
    // 3) ゆるいSカーブ（軽いコントラストで奥行きを出す）
    c = mix(c, c * c * (3.0 - 2.0 * c), 0.16);
    // 4) 柔らかいブルーム（ハイライトがほのかに滲む）
    c += smoothstep(0.70, 1.0, luma) * 0.04;
    // 5) 最暗部を純黒にせず、わずかに持ち上げる（フィルムの黒浮き＝古い記憶の質感）
    c += (1.0 - smoothstep(0.0, 0.18, luma)) * 0.018;
    return clamp(c, 0.0, 1.0);
  }
`
