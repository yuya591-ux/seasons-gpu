// 高所の窓から「見下ろす街」をレイマーチで描く GLSL 片。窓辺シリーズで共有する。
// ・地面ではなく“高さ場（箱の街）”をレイマーチ：建物の壁が立ち、屋上が見え、手前の棟が奥を隠す
// ・建物に当たらず通りへ抜けた光線だけ、街路レベル（道・川・街路樹・街灯・人・車）を描く
// ・空気遠近・夜の灯り・近景の持ち上げで“本当に下を眺めている”立体感を出す
// 注入先シェーダーで uSunGlow/uHorizon/uSkyMid/uTime/h11/h21 が定義済みの前提（glass.js と同じ作法）。

export const GROUND_GLSL = /* glsl */ `
  // 世界座標 g0 から区画情報を得る。bH=建物高さ(ブロック単位, 道路や緑地は0)。
  // 道路境界は硬い step ＝ 区画が垂直の壁を持つ“箱”になる（レイマーチで壁が立つ）。
  void cityCell(vec2 g0, out vec2 gi, out vec2 gf, out float bH,
                out float tower, out float mat, out float blkR, out float dRoad) {
    vec2 g = g0 + vec2(sin(g0.y * 1.7 + 1.0), sin(g0.x * 1.9)) * 0.05; // 碁盤目をゆるく崩す
    g.x += h11(floor(g0.y) * 1.3) * 0.45;                              // 横通りごとに位置をずらす
    gi = floor(g); gf = fract(g);
    blkR = h21(gi + 2.0);
    dRoad = min(min(gf.x, 1.0 - gf.x), min(gf.y, 1.0 - gf.y));
    float ave = max(step(0.80, fract(gi.x * 0.37 + 0.2)), step(0.83, fract(gi.y * 0.41))); // たまに大通り
    float roadWdt = 0.11 + 0.09 * ave;
    float isBld = step(roadWdt, dRoad);                 // 1=区画(箱)・0=道（硬い境界）
    mat = h21(gi + 5.0);
    tower = step(0.93, h21(gi + 27.0));                 // たまに高層
    float isPark = step(0.90, mat) * (1.0 - tower);     // 緑地は控えめ
    bH = mix(0.22 + 0.55 * blkR, 1.7, tower) * isBld * (1.0 - isPark); // 建物高さ
  }

  // 戻り: 街色。gmask に被覆マスク(0..1)。lean=覗き込み(uParallax.x), nightAmt=夜度, glassMode=雨雪。
  vec3 lookDownGround(vec2 vp, float ax, float yaw, float lean, float nightAmt, float glassMode, out float gmask) {
    float hY = 0.43;                                   // 地平の画面高さ
    gmask = smoothstep(hY + 0.02, hY - 0.02, vp.y);
    if (gmask <= 0.001) return mix(uHorizon, uSkyMid, 0.35); // 地平より上は計算しない（軽量化）

    float gt = max(hY - vp.y, 0.004);                  // 0=地平, 大=手前(真下)
    float horizAngle = ax * 1.6 + (yaw + lean * 1.6) * 0.6; // 光線の水平/前方比
    float K0 = 0.9;                                    // 街の密度（大きいほど多く・小さい区画が見える）
    float zground = K0 / gt;                           // 平地に当たる前方距離（ブロック）
    float Hcam = 2.6;                                  // 視点の高さ（ブロック）＝高台の見下ろし
    float slope = Hcam * gt / K0;                      // y=0 が zground になる降下率（画素ごと一定）

    // ── 高さ場のレイマーチ：箱の街を本当に見下ろす ──
    float zmax = min(zground, 34.0);
    bool hit = false; float hitZ = zmax;
    vec2 hGi = vec2(0.0), hGf = vec2(0.0);
    float hBH = 0.0, hTower = 0.0, hMat = 0.0, hBlk = 0.0, roofness = 0.0;
    vec2 prevGi = vec2(1e6);
    float zStep = zmax / 48.0;
    for (int i = 1; i <= 48; i++) {
      float z = zStep * float(i);
      float yray = Hcam - slope * z;
      vec2 gi, gf; float bH, tower, mat, blkR, dRoad;
      cityCell(vec2(horizAngle * z, z), gi, gf, bH, tower, mat, blkR, dRoad);
      if (yray <= bH) { hit = true; hitZ = z; break; }
      prevGi = gi;
    }

    vec3 ground;
    if (hit) {
      // 命中点を二分法で精緻化（壁の輪郭をくっきり）
      float z0 = max(hitZ - zStep, 0.0), z1 = hitZ;
      for (int r = 0; r < 5; r++) {
        float zm = 0.5 * (z0 + z1);
        float yraym = Hcam - slope * zm;
        vec2 gi, gf; float bH, tower, mat, blkR, dRoad;
        cityCell(vec2(horizAngle * zm, zm), gi, gf, bH, tower, mat, blkR, dRoad);
        if (yraym <= bH) { z1 = zm; hGi = gi; hGf = gf; hBH = bH; hTower = tower; hMat = mat; hBlk = blkR; }
        else z0 = zm;
      }
      hitZ = z1;
      float yray = Hcam - slope * hitZ;
      // 屋上らしさ＝命中高さが上端に近いほど1（なめらか＝壁/屋上のチラつきを出さない）
      roofness = smoothstep(hBH - 0.12, hBH - 0.02, yray);
      float vfrac = clamp(yray / max(hBH, 0.05), 0.0, 1.0); // 0=足元 1=屋上
      float fog = smoothstep(5.0, 30.0, hitZ);            // 遠さ（窓などの細部は遠いほど省く＝チラつき防止）
      // 細部は「遠い」「真下を覗く（壁が潰れる）」「低い建物（壁が細い）」ほど消す＝サブピクセルのザラつき防止
      float detail = (1.0 - fog) * 0.85
                   * (1.0 - smoothstep(0.20, 0.42, gt) * 0.85)
                   * smoothstep(0.25, 0.55, hBH);

      // 建物ごとの素材を抽選（コンクリ灰白/モルタル暖/タイル茶/防水シート灰緑）＝色の多様性で実在感
      float msel = h21(hGi + 61.0);
      vec3 base = vec3(0.50, 0.48, 0.45);                          // コンクリ灰白
      base = mix(base, vec3(0.52, 0.45, 0.37), step(0.30, msel)); // モルタル暖
      base = mix(base, vec3(0.42, 0.31, 0.25), step(0.58, msel)); // タイル茶
      base = mix(base, vec3(0.35, 0.37, 0.33), step(0.82, msel)); // 防水シート灰緑
      base = mix(base, uHorizon, 0.16) * (0.86 + 0.26 * hBlk);    // 夕暮れの大気を少し含ませる
      vec3 roofTop = base;
      // 前面の壁（こちらを向く陰の面）。西日が片側に差す＋上ほど空の光を受けて明るい＋足元はAO
      float westLit = smoothstep(0.0, 0.7, fract(horizAngle * 0.7 + hBlk));
      vec3 wallCol = base * (0.46 + 0.16 * westLit) * (0.62 + 0.50 * vfrac);
      // 壁の窓（低周波・遠景/真下/低層では省く＝チラつき防止）。各階の横帯＋控えめな縦割り
      float isTall = step(0.5, hTower);
      float rows = mix(4.0, 11.0, isTall);
      float cols = mix(3.0, 5.0, isTall);
      float fl = vfrac * rows;
      float floorBand = smoothstep(0.30, 0.42, fract(fl)) * smoothstep(0.92, 0.80, fract(fl)); // 窓の段
      float colu = fract((fract(horizAngle * 1.7 + hGi.x * 0.6)) * cols);
      float colBand = smoothstep(0.18, 0.30, colu) * smoothstep(0.86, 0.74, colu);
      float pane = floorBand * colBand * step(0.06, vfrac) * step(vfrac, 0.94);
      float litW = step(0.62 - 0.22 * nightAmt, h21(vec2(floor(fl), floor(colu + hGi.x)) + hGi + 13.0));
      vec3 winLit = mix(uSunGlow, vec3(1.0, 0.92, 0.74), 0.3);
      // 窓は低コントラストの陰影。灯りは夜ほど。昼は段差のかげり程度に抑える（チラつき防止）
      vec3 winFace = mix(wallCol * 0.90, winLit, litW * (0.20 + 0.7 * nightAmt));
      wallCol = mix(wallCol, winFace, pane * detail * (0.5 + 0.5 * nightAmt));
      wallCol *= 0.78 + 0.22 * smoothstep(0.0, 0.18, vfrac);  // 足元の接地影(AO)

      // 屋上の設備（真上から見た形＝パラペット/塔屋/水タンク/室外機）。屋上のときだけ・近景ほど精細
      float rdet = roofness * detail;
      float di = min(min(hGf.x, 1.0 - hGf.x), min(hGf.y, 1.0 - hGf.y));
      roofTop += uSunGlow * smoothstep(0.0, 0.035, di) * smoothstep(0.11, 0.05, di) * 0.06 * rdet; // 縁の立ち上がり
      vec2 phc = hGf - vec2(0.40, 0.58);
      float phHas = step(0.45, h21(hGi + 71.0));
      float ph = step(max(abs(phc.x), abs(phc.y) * 1.3), 0.15) * phHas;
      roofTop = mix(roofTop, base * 1.16, ph * 0.7 * rdet);                                        // 塔屋（階段室）の上面
      roofTop = mix(roofTop, base * 0.52,
                    step(max(abs(phc.x + 0.17), abs(phc.y) * 1.3), 0.026) * phHas * rdet);          // 塔屋の影
      float tank = smoothstep(0.085, 0.06, length((hGf - vec2(0.70, 0.34)) * vec2(1.0, 1.1))) * step(0.55, h21(hGi + 53.0));
      roofTop = mix(roofTop, vec3(0.30, 0.27, 0.25), tank * 0.7 * rdet);                            // 屋上の水タンク
      vec2 acg = floor(hGf * vec2(5.0, 4.0));
      vec2 acf = fract(hGf * vec2(5.0, 4.0));
      float acu = step(0.72, h21(acg + hGi + 17.0)) * step(0.3, acf.x) * step(acf.x, 0.55) * step(0.3, acf.y) * step(acf.y, 0.6);
      roofTop = mix(roofTop, base * 0.6, acu * 0.4 * rdet);                                         // 室外機など小物

      vec3 bld = mix(wallCol, roofTop, roofness);
      // 屋上の窓灯り/塔屋のあかり（夜）
      bld += winLit * roofness * step(0.62 - 0.2 * nightAmt, h21(hGi + 11.0))
           * smoothstep(0.34, 0.12, length(hGf - 0.5)) * (0.08 + 0.26 * nightAmt) * detail;
      // 高層の屋上に赤い航空障害灯（ゆっくり明滅）
      bld += vec3(0.9, 0.16, 0.12) * hTower * roofness
           * smoothstep(0.16, 0.0, length(hGf - 0.5)) * (0.5 + 0.5 * sin(uTime * 1.2 + hBlk * 20.0));
      // 空気遠近（遠い箱ほど霞んで空へ）
      bld = mix(bld, mix(uHorizon, uSkyMid, 0.4), fog * 0.7);
      // 近景（手前の棟）を持ち上げ
      bld *= 1.0 + smoothstep(0.12, 0.42, gt) * 0.18;
      ground = bld;
    } else {
      // ── 通りへ抜けた：街路レベル（道・川・街路樹・街灯・人・車） ──
      float gz = zground; float gx = horizAngle * gz;
      vec2 g0 = vec2(gx, gz);
      vec2 g = g0 + vec2(sin(g0.y * 1.7 + 1.0), sin(g0.x * 1.9)) * 0.05;
      g.x += h11(floor(g0.y) * 1.3) * 0.45;
      vec2 gi = floor(g); vec2 gf = fract(g);
      float blkR = h21(gi + 2.0);
      float dRoad = min(min(gf.x, 1.0 - gf.x), min(gf.y, 1.0 - gf.y));
      vec3 roadC = mix(vec3(0.20, 0.19, 0.19), uHorizon * 0.3, 0.4);
      ground = roadC;
      // 川（街を蛇行。水面が空と灯りを映す）
      float riverX = sin(gz * 0.22 + 1.5) * 1.6 + cos(gz * 0.11) * 0.7;
      float river = smoothstep(0.34, 0.22, abs(g0.x - riverX));
      vec3 waterC = mix(uSkyMid, uHorizon, 0.55) * 0.72;
      waterC += uSunGlow * smoothstep(0.12, 0.0, abs(g0.x - riverX + sin(gz * 2.0) * 0.05)) * 0.18;
      ground = mix(ground, waterC, river * 0.95);
      // 歩道（道の外縁＝建物際の少し明るい帯）
      float sidewalk = smoothstep(0.16, 0.13, dRoad) * smoothstep(0.085, 0.115, dRoad);
      ground = mix(ground, mix(vec3(0.30, 0.29, 0.28), uHorizon * 0.3, 0.35), sidewalk * 0.5 * (1.0 - river));
      // センターライン（車道の中央に淡い破線）
      float dash = step(0.5, fract(gz * 6.0 + gx * 6.0));
      float centerLine = smoothstep(0.012, 0.004, dRoad) * dash;
      ground = mix(ground, vec3(0.55, 0.50, 0.36), centerLine * 0.30 * (1.0 - river));
      // 街路樹（道の脇に緑の点々）
      vec2 tg = g0 * 3.2; vec2 tgf = fract(tg);
      float tree = step(0.66, h21(floor(tg) + 41.0)) * smoothstep(0.30, 0.05, length(tgf - 0.5))
                 * smoothstep(0.20, 0.12, dRoad) * (1.0 - river);
      ground = mix(ground, mix(vec3(0.11, 0.19, 0.09), uHorizon * 0.25, 0.2), tree * 0.5);
      // 西日の長い影（建物が通りへ落とす影＝夕方の立体感）。太陽側に高い区画があれば翳る
      float shadow = 0.0;
      vec2 sdir = vec2(-0.96, 0.28);                 // 太陽（西やや奥）へ向かう方向
      for (int s = 1; s <= 4; s++) {
        float dd = float(s) * 0.45;
        vec2 _gi, _gf; float _bH, _t, _m, _b, _d;
        cityCell(g0 + sdir * dd, _gi, _gf, _bH, _t, _m, _b, _d);
        shadow = max(shadow, step(dd * 0.55, _bH));  // 影の高さ＝距離×太陽高度(0.55)
      }
      ground *= 1.0 - shadow * 0.28 * (1.0 - river);
      // 街全体をうっすら底上げ（街灯の照り返し）。夜はさらに
      ground += mix(uHorizon, uSunGlow, 0.4) * (0.04 + 0.07 * nightAmt);
      // 街灯（交差点）
      float lampG = smoothstep(0.10, 0.0, length(gf - 0.5)) * step(0.45, h11(gi.x + gi.y * 3.0 + 7.0));
      ground += uSunGlow * lampG * (0.8 + 0.5 * nightAmt) * (1.0 - river);
      // 人影（道沿いを動く小さな点）
      float ped = step(0.5, h21(gi + 19.0))
                * smoothstep(0.05, 0.0, length((gf - vec2(0.5, fract(uTime * 0.05 + blkR))) * vec2(1.3, 1.0)));
      ground = mix(ground, vec3(0.05, 0.04, 0.05), ped * 0.6 * (1.0 - river));
      // 車（縦の道を流れる。ヘッドライト/テール＋前方ビーム）
      float carDir = (blkR > 0.5) ? 1.0 : -1.0;
      float carY = fract(uTime * 0.22 * carDir + blkR);
      float onVroad = smoothstep(0.13, 0.0, abs(gf.x - 0.5));
      float carOn = step(0.45, h11(gi.x * 1.7 + gi.y * 2.3 + 21.0));
      float carBody = smoothstep(0.05, 0.0, abs(gf.y - carY));
      float carBeam = smoothstep(0.16, 0.0, abs(gf.y - carY - carDir * 0.07));
      vec3 carCol = mix(vec3(1.0, 0.92, 0.72), vec3(1.0, 0.30, 0.18), step(0.0, -carDir));
      ground += carCol * onVroad * carOn * (carBody * 0.9 + carBeam * 0.22) * (1.0 - river);
      // 近景を持ち上げ
      ground *= 1.0 + smoothstep(0.12, 0.42, gt) * 0.22;
      // 空気遠近（地平で空へ溶ける）
      ground = mix(ground, mix(uHorizon, uSkyMid, 0.35), smoothstep(0.07, 0.0, gt) * 0.85);
    }

    if (glassMode > 1.5) ground = mix(ground, vec3(0.82, 0.85, 0.92), 0.12); // 雪
    return ground;
  }
`
