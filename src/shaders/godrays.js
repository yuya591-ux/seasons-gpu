// 薄明光線（god rays / 光芒）。太陽から放射状に伸びる光の筋で、空に立体的な大気の奥行きを与える。
// 窓辺シリーズ共通の GLSL 片（GRADE_GLSL と同じ作法で main 直前に注入）。

export const GODRAYS_GLSL = /* glsl */ `
  float grHash(float n) { return fract(sin(n) * 43758.5453123); }
  // q=視界座標(ax, vp.y), sunScreen=太陽の画面位置, lightAmt=色×強さ, t=uTime。
  // 太陽から放射状の筋＋ゆっくりした揺らぎ＋距離フォールオフで“射し込む光”の立体感を出す。
  vec3 godRays(vec3 col, vec2 q, vec2 sunScreen, vec3 lightAmt, float t, float skyMask) {
    vec2 d = q - sunScreen;
    float dist = length(d);
    float ang = atan(d.y, d.x);
    // 角度方向に縞（筋）。複数周期を重ね、ゆっくり揺らぐ＝大気のゆらめき
    float shafts = 0.55 + 0.45 * sin(ang * 20.0 + sin(ang * 6.0 + t * 0.04) * 1.6);
    shafts *= 0.7 + 0.3 * sin(ang * 41.0 - t * 0.03);
    // 等間隔の人工的な櫛を避ける: 角度をハッシュで区切り「強い数本＋淡い筋」の不規則な光芒に。
    // 区切りをごくゆっくり流して、大気がゆらめくように強弱が移ろう。
    float aa = ang * 3.2 + sin(t * 0.02) * 0.5;
    float amp = mix(grHash(floor(aa)), grHash(floor(aa) + 1.0), smoothstep(0.0, 1.0, fract(aa)));
    shafts *= 0.4 + 0.7 * amp;
    shafts = shafts * shafts;
    // 太陽の近くほど強く、遠いと消える
    float falloff = exp(-dist * 1.7) * smoothstep(2.2, 0.12, dist);
    return col + lightAmt * shafts * falloff * skyMask;
  }
`
