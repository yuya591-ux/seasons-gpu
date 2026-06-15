// 薄明光線（god rays / 光芒）。太陽から放射状に伸びる光の筋で、空に立体的な大気の奥行きを与える。
// 窓辺シリーズ共通の GLSL 片（GRADE_GLSL と同じ作法で main 直前に注入）。

export const GODRAYS_GLSL = /* glsl */ `
  // q=視界座標(ax, vp.y), sunScreen=太陽の画面位置, lightAmt=色×強さ, t=uTime。
  // 太陽から放射状の筋＋ゆっくりした揺らぎ＋距離フォールオフで“射し込む光”の立体感を出す。
  vec3 godRays(vec3 col, vec2 q, vec2 sunScreen, vec3 lightAmt, float t, float skyMask) {
    vec2 d = q - sunScreen;
    float dist = length(d);
    float ang = atan(d.y, d.x);
    // 角度方向に縞（筋）。複数周期を重ね、ゆっくり揺らぐ＝大気のゆらめき
    float shafts = 0.55 + 0.45 * sin(ang * 20.0 + sin(ang * 6.0 + t * 0.04) * 1.6);
    shafts *= 0.7 + 0.3 * sin(ang * 41.0 - t * 0.03);
    shafts = shafts * shafts;
    // 太陽の近くほど強く、遠いと消える
    float falloff = exp(-dist * 1.7) * smoothstep(2.2, 0.12, dist);
    return col + lightAmt * shafts * falloff * skyMask;
  }
`
