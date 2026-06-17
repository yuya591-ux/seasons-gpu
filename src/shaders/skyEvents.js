// 2D情景の「小さな驚き」: 宵空/夜空をごくたまに流れる一筋の流れ星。
// uTime を長い区間に区切り、各区間のハッシュで「出るか・いつ・どこを・どの向きに」を決める
// 決定論アニメ（素材ゼロ・確率発火）。town3d の偶然性イベントを、シェーダー情景にも分け与える。
// 各シェーダーの main 直前に注入し、空の領域で col に加算する。自己完結（host の hash に依存しない）。

export const SKYEVENTS_GLSL = /* glsl */ `
  float ssHash(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
  // q=視界座標(空が上=大きいy), t=uTime, sky=空の重み(0..1。地上/水面では0)。
  vec3 shootingStar(vec3 col, vec2 q, float t, float sky) {
    if (sky < 0.02) return col;
    float period = 24.0;                                    // 約24秒に1区間
    float seg = floor(t / period);
    if (ssHash(vec2(seg, 7.3)) > 0.5) return col;          // 半分の区間は何も出ない（アンビエントの余白）
    float when = 0.15 + 0.65 * ssHash(vec2(seg, 2.1));     // 区間内の発火時刻
    float life = (fract(t / period) - when) / 0.11;        // 寿命≒2.6秒（0:出現 .. 1:消滅）
    if (life < 0.0 || life > 1.0) return col;
    vec2 p0 = vec2(0.22 + 0.56 * ssHash(vec2(seg, 5.5)), 0.70 + 0.24 * ssHash(vec2(seg, 8.8))); // 始点（上空）
    vec2 dir = normalize(vec2(-0.7 - 0.5 * ssHash(vec2(seg, 9.1)), -0.42));                     // 右上→左下へ流れる
    vec2 head = p0 + dir * 0.26 * life;                    // 頭が進む
    vec2 d = q - head;
    float along = dot(d, -dir);                            // 尾の方向（正）
    float perp = abs(dot(d, vec2(-dir.y, dir.x)));         // 軌道からの横ずれ
    float trail = smoothstep(0.05, 0.0, perp) * smoothstep(0.18, 0.0, along) * step(0.0, along); // 尾
    float headG = smoothstep(0.010, 0.0, length(d));       // 頭の輝き
    float env = smoothstep(0.0, 0.12, life) * smoothstep(1.0, 0.55, life); // 出て・消える
    return col + vec3(1.0, 0.97, 0.88) * (trail * 0.5 + headG) * env * sky;
  }
`
