// 高所の窓から「見下ろす街の地面」（パース投影）。窓辺シリーズで共有する GLSL 片。
// 地平 hY へ収束する街路グリッド＋区画の屋上（素材違い）＋街灯・屋上灯・人影・車。
// 碁盤目を崩す歪み・大通り・夜の底上げで“本当に下を眺めている”感を出す。
// 注入先シェーダーで uSunGlow/uHorizon/uSkyMid/uTime/h11/h21 が定義済みの前提（glass.js と同じ作法）。

export const GROUND_GLSL = /* glsl */ `
  // 戻り: 地面色。gmask に被覆マスク(0..1)。lean=覗き込み(uParallax.x), nightAmt=夜度, glassMode=雨雪。
  vec3 lookDownGround(vec2 vp, float ax, float yaw, float lean, float nightAmt, float glassMode, out float gmask) {
    float hY = 0.43;
    gmask = smoothstep(hY + 0.02, hY - 0.02, vp.y);
    float gt = max(hY - vp.y, 0.006);            // 0=地平, 大=手前(下)
    float gd = 0.06 / gt;                         // 視点からの距離
    float scl = 7.0;                              // 区画の細かさ
    float gx = (ax * 1.6 + (yaw + lean * 1.6) * 0.6) * gd * scl;
    float gz = gd * scl;
    vec2 g0 = vec2(gx, gz);
    // 街路を不規則に: ゆるい歪み＋各横通りのxオフセットで碁盤目を崩す
    vec2 g = g0 + vec2(sin(g0.y * 1.7 + 1.0), sin(g0.x * 1.9)) * 0.05;
    g.x += h11(floor(g0.y) * 1.3) * 0.45;
    vec2 gi = floor(g); vec2 gf = fract(g);
    float blkR = h21(gi + 2.0);
    float dRoad = min(min(gf.x, 1.0 - gf.x), min(gf.y, 1.0 - gf.y));
    // 大通り（広い道）をたまに
    float ave = max(step(0.80, fract(gi.x * 0.37 + 0.2)), step(0.83, fract(gi.y * 0.41)));
    float roadWdt = 0.11 + 0.09 * ave;
    float road = smoothstep(roadWdt + 0.04, roadWdt, dRoad);
    // 区画の屋上（素材違い: コンクリ / 瓦茶 / 緑地）
    float mat = h21(gi + 5.0);
    vec3 concrete = mix(vec3(0.36, 0.32, 0.30), uHorizon * 0.7, 0.4);
    vec3 tile = mix(vec3(0.30, 0.22, 0.18), uHorizon * 0.6, 0.35);
    vec3 park = mix(vec3(0.17, 0.26, 0.15), uHorizon * 0.4, 0.3);
    vec3 roofC = mix(concrete, tile, step(0.5, mat));
    roofC = mix(roofC, park, step(0.82, mat));
    roofC *= 0.8 + 0.4 * blkR;
    vec3 roadC = mix(vec3(0.20, 0.19, 0.19), uHorizon * 0.3, 0.4);
    vec3 ground = mix(roofC, roadC, road);
    // 夜でも見えるよう街全体をうっすら底上げ（街灯の照り返し）
    ground += mix(uHorizon, uSunGlow, 0.4) * 0.05 * nightAmt;
    // 屋上の縁の立体（夕日が片側）
    ground += uSunGlow * smoothstep(roadWdt + 0.05, roadWdt + 0.01, dRoad) * (1.0 - road) * smoothstep(0.0, 0.6, gf.x) * 0.10;
    // 屋上/窓の灯り
    float roofLight = step(0.64, h21(gi + 11.0)) * smoothstep(0.34, 0.05, length(gf - 0.5)) * (1.0 - road);
    ground += uSunGlow * roofLight * (0.18 + 0.20 * nightAmt);
    // 街灯（交差点）
    float lampG = smoothstep(0.09, 0.0, length(gf - 0.5)) * step(0.45, h11(gi.x + gi.y * 3.0 + 7.0)) * road;
    ground += uSunGlow * lampG * 0.9;
    // 人影（道沿いを動く小さな点）
    float ped = step(0.5, h21(gi + 19.0)) * smoothstep(0.05, 0.0, length((gf - vec2(0.5, fract(uTime * 0.05 + blkR))) * vec2(1.3, 1.0))) * road;
    ground = mix(ground, vec3(0.05, 0.04, 0.05), ped * 0.7);
    // 車（縦の道を流れる。進行方向で白ヘッドライト/赤テール）
    float carDir = (blkR > 0.5) ? 1.0 : -1.0;
    float carY = fract(uTime * 0.20 * carDir + blkR);
    float car = step(0.40, h11(gi.x * 1.7 + gi.y * 2.3 + 21.0))
              * smoothstep(0.08, 0.0, abs(gf.x - 0.5)) * smoothstep(0.045, 0.0, abs(gf.y - carY)) * road;
    ground += mix(vec3(1.0, 0.9, 0.7), vec3(1.0, 0.32, 0.2), step(0.0, -carDir)) * car * 0.7;
    // 空気遠近: 地平に近いほど霞む（遠い街は空へ溶ける）
    ground = mix(ground, mix(uHorizon, uSkyMid, 0.35), smoothstep(0.07, 0.0, gt) * 0.85);
    if (glassMode > 1.5) ground = mix(ground, vec3(0.82, 0.85, 0.92), 0.12); // 雪
    return ground;
  }
`
