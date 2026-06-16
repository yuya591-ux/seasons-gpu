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
    float urban = vnoise(gi * 0.07 + 3.0) * (1.0 - 0.7 * uLowRise); // 都心度（低層情景では抑える）
    tower = step(0.93 - 0.20 * urban + 0.6 * uLowRise, h21(gi + 27.0)); // 低層では高層をほぼ無くす
    float isPark = step(0.92 - 0.06 * uLowRise, mat) * (1.0 - tower); // 緑地（低層では少し増える）
    // 住宅は2階建て相当まで背を持たせ、上から見ても壁と影が立つ立体感を出す（平らな貼り絵を脱する）
    float baseH = ((0.26 + 0.30 * urban) + (0.40 + 0.50 * urban) * blkR) * (1.0 - 0.24 * uLowRise);
    bH = mix(baseH, 1.1 + 1.4 * urban, tower) * isBld * (1.0 - isPark);  // 建物高さ
  }

  // 地形の起伏（山坂の多い街＝北寺尾/鶴見の谷戸地形）。大きな尾根/谷＋中くらいの坂。
  // 建物・街路はこの起伏の上に乗る（坂を登り、谷へ下る街並み）。
  // 地形は低周波で十分。terrainH は1画素でレイマーチ＋二分法＋影で数十回呼ばれるため、
  // フルの fbm(OCTAVES回ループ) でなく2オクターブ固定の軽量版を使う（発熱を大きく下げる）。
  float fbm2(vec2 p) { return 0.5 * vnoise(p) + 0.25 * vnoise(p * 2.0 + 5.7); }
  float terrainH(vec2 g0) {
    float h = fbm2(g0 * 0.075 + 2.3) - 0.375;        // 大きな尾根と谷
    h += (fbm2(g0 * 0.19 + 7.0) - 0.375) * 0.45;     // 中くらいの起伏（坂）
    return h * 1.7 * (1.0 + uLowRise * 0.7);          // 坂の住宅地(低層)は起伏を強め＝街が丘を駆け上り下る
  }

  // 戻り: 街色。gmask に被覆マスク(0..1)。lean=覗き込み(uParallax.x), nightAmt=夜度, glassMode=雨雪。
  vec3 lookDownGround(vec2 vp, float ax, float yaw, float lean, float nightAmt, float glassMode, out float gmask) {
    float hY = 0.43;                                   // 地平の画面高さ
    gmask = smoothstep(hY + 0.02, hY - 0.02, vp.y);
    if (gmask <= 0.001) return mix(uHorizon, uSkyMid, 0.35); // 地平より上は計算しない（軽量化）
    float mo = 1.0 - uReduceMotion;                    // 0=動きを止める（車・人・点滅を静止）
    // 時刻のゆるやかな移ろい（止まった時間の中の微かな揺らぎ）。沈むほど影が伸びる。
    float sunAz = sin(uTime * 0.012 * mo) * 0.08;      // 太陽方位のドリフト
    float sunElev = 0.55 - sin(uTime * 0.012 * mo) * 0.12; // 太陽高度（小=低い夕日=影が長い）

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
    float hBH = 0.0, hTower = 0.0, hMat = 0.0, hBlk = 0.0, hTerr = 0.0, roofness = 0.0;
    vec2 prevGi = vec2(1e6);
    float zStep = zmax / 36.0;           // 歩数を48→36に削減（画素あたりの反復を減らし発熱を抑える）
    for (int i = 1; i <= 36; i++) {
      float z = zStep * float(i);
      float yray = Hcam - slope * z;
      vec2 g0m = vec2(horizAngle * z, z);
      vec2 gi, gf; float bH, tower, mat, blkR, dRoad;
      cityCell(g0m, gi, gf, bH, tower, mat, blkR, dRoad);
      if (yray <= terrainH(g0m) + bH) { hit = true; hitZ = z; break; }  // 地形＋建物の高さ場
      prevGi = gi;
    }

    vec3 ground;
    if (hit) {
      // 命中点を二分法で精緻化（壁/地形の輪郭をくっきり）
      float z0 = max(hitZ - zStep, 0.0), z1 = hitZ;
      for (int r = 0; r < 6; r++) {        // 二分法を1回増やし、粗い歩幅でも輪郭を保つ
        float zm = 0.5 * (z0 + z1);
        float yraym = Hcam - slope * zm;
        vec2 g0m = vec2(horizAngle * zm, zm);
        vec2 gi, gf; float bH, tower, mat, blkR, dRoad;
        cityCell(g0m, gi, gf, bH, tower, mat, blkR, dRoad);
        if (yraym <= terrainH(g0m) + bH) { z1 = zm; hGi = gi; hGf = gf; hBH = bH; hTower = tower; hMat = mat; hBlk = blkR; hTerr = terrainH(g0m); }
        else z0 = zm;
      }
      hitZ = z1;
    }
    // 建物（高さ十分）か、地形の地面（道・坂・公園）かで分岐
    if (hit && hBH > 0.03) {
      float yray = Hcam - slope * hitZ;
      float surf = hTerr + hBH;
      // 屋上らしさ＝命中高さが上端に近いほど1（なめらか＝壁/屋上のチラつきを出さない）
      roofness = smoothstep(surf - 0.12, surf - 0.02, yray);
      float vfrac = clamp((yray - hTerr) / max(hBH, 0.05), 0.0, 1.0); // 0=足元(地形) 1=屋上
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
      base = mix(base, uHorizon, 0.20) * (0.84 + 0.30 * hBlk);    // 夕暮れの大気に寄せ、棟ごとの明暗差は控えめに（水彩調・原色パッチ回避）
      base *= 1.0 - 0.55 * nightAmt;                              // 夜は素地が暗く沈み、灯りが映える
      // 屋上ごとに明暗・色味を“ほどよく”散らす（碁盤の均質感は崩すが、原色のパッチワークにはしない）
      vec3 roofTop = base * (0.86 + 0.26 * h21(hGi + 88.0));      // 明暗差を圧縮（旧0.78+0.44＝2.4倍幅→ほぼ1.4倍幅）
      float roofHue = h21(hGi + 34.0);
      roofTop = mix(roofTop, roofTop * vec3(0.91, 0.96, 1.06), step(0.88, roofHue));        // たまに青みのトタン屋根（彩度を抑え淡く）
      roofTop = mix(roofTop, roofTop * vec3(1.05, 0.92, 0.85), step(0.72, roofHue) * step(roofHue, 0.88)); // 赤錆びた屋根（淡く）
      float district = vnoise(hGi * 0.35 + 7.0);                  // 街区ごとの賑わい（夜の灯りの粗密）
      // ひとつの太陽（西＝画面左、低い夕日）で街全体を一貫して照らす。
      // 視線の左（西）を向く面ほど日が当たり暖かく、右（東）の面は翳る＝陰影が方向で揃う。
      float sunFacing = smoothstep(-0.55, 0.45, -horizAngle + sunAz); // 西(左)を向くほど受光（太陽の移ろいで揺らぐ）
      float dayLit = 1.0 - nightAmt;
      // 前面の壁。受光で明暗、上ほど空の光、足元はAO
      vec3 wallCol = base * (0.40 + 0.24 * sunFacing) * (0.62 + 0.50 * vfrac);
      wallCol += uSunGlow * 0.07 * sunFacing * dayLit * (0.35 + 0.65 * vfrac); // 西日の暖かな差し
      // 壁の窓（低周波・遠景/真下/低層では省く＝チラつき防止）。各階の横帯＋控えめな縦割り
      float isTall = step(0.5, hTower);
      float rows = mix(4.0, 11.0, isTall);
      float cols = mix(3.0, 5.0, isTall);
      float fl = vfrac * rows;
      float floorBand = smoothstep(0.30, 0.42, fract(fl)) * smoothstep(0.92, 0.80, fract(fl)); // 窓の段
      float colu = fract((fract(horizAngle * 1.7 + hGi.x * 0.6)) * cols);
      float colBand = smoothstep(0.18, 0.30, colu) * smoothstep(0.86, 0.74, colu);
      float pane = floorBand * colBand * step(0.06, vfrac) * step(vfrac, 0.94);
      float litW = step(0.62 - (0.22 + 0.20 * district) * nightAmt, h21(vec2(floor(fl), floor(colu + hGi.x)) + hGi + 13.0));
      // 深夜は灯りが一つずつ消えていく（眠りにつく街）。ゆっくり深まり、また目覚める。
      float sleepDepth = nightAmt * (0.5 - 0.5 * cos(uTime * 0.012 * mo));
      litW *= step(sleepDepth * 0.6, h21(vec2(floor(fl), floor(colu + hGi.x)) + hGi + 71.0));
      vec3 winLit = mix(uSunGlow, vec3(1.0, 0.92, 0.74), 0.3);
      // 窓は低コントラストの陰影。灯りは夜ほど。昼は段差のかげり程度に抑える（チラつき防止）
      vec3 winFace = mix(wallCol * 0.90, winLit, litW * (0.20 + 0.7 * nightAmt));
      // 昼の窓ガラスは空を映す＋たまに夕日が反射してきらめく（街の質感）
      vec3 skyRefl = mix(uSkyMid, uSunGlow, 0.3 + 0.4 * sunFacing);
      winFace = mix(winFace, skyRefl, dayLit * (0.30 + 0.30 * sunFacing));
      float glint = step(0.90, h21(vec2(floor(fl), floor(colu + hGi.x)) + hGi + 91.0)) * sunFacing * dayLit;
      winFace += uSunGlow * glint * 0.5;                      // 夕日の窓きらめき
      wallCol = mix(wallCol, winFace, pane * detail);
      wallCol *= 0.78 + 0.22 * smoothstep(0.0, 0.18, vfrac);  // 足元の接地影(AO)

      // 最前列（ごく近い棟）の作り込み: ベランダの手すり＋壁の室外機。距離で自然に消える。
      float nearDetail = (1.0 - smoothstep(2.5, 7.5, hitZ)) * detail;
      float resid = 1.0 - isTall;                                                 // 住宅/団地ほどベランダ
      float railLine = smoothstep(0.05, 0.012, abs(fract(fl) - 0.16)) * step(0.08, vfrac) * resid;
      wallCol = mix(wallCol, wallCol * 0.62, railLine * nearDetail * 0.55);        // 手すり下の陰
      wallCol += uSunGlow * 0.05 * sunFacing * smoothstep(0.018, 0.0, abs(fract(fl) - 0.16)) * resid * nearDetail; // 手すり上端の光
      // 物干しの洗濯物（ベランダの手すりに干された色とりどりの衣類＝生活感）。最近景の住宅のみ。
      float ucol = fract(horizAngle * 1.7 + hGi.x * 0.6);                          // 建物面の横方向座標
      float hangBand = smoothstep(0.05, 0.0, abs(fract(fl) - 0.11)) * step(0.10, vfrac) * resid; // 手すりのすぐ下
      vec2 lcell = vec2(floor(ucol * cols * 3.0), floor(fl));
      float hasLaundry = step(0.45, h21(lcell + hGi + 3.0)) * step(0.5, h21(hGi + 9.0)); // 干してある家
      vec3 laundryC = 0.55 + 0.40 * cos(h21(lcell + 22.0) * 8.0 + vec3(0.0, 2.1, 4.2)); // 色とりどり
      laundryC = mix(laundryC, vec3(0.92, 0.92, 0.90), step(0.6, h21(lcell + 31.0)));    // 半分は白いシーツ/シャツ
      float litem = smoothstep(0.30, 0.18, abs(fract(ucol * cols * 3.0) - 0.5));         // 衣類の列
      wallCol = mix(wallCol, laundryC, hangBand * hasLaundry * litem * nearDetail * 0.7);
      // 各階のスラブ（ベランダ床）が落とす水平の陰＝階ごとの段の立体（最近景のみ・横線で安定）
      float slabLine = smoothstep(0.035, 0.0, abs(fract(fl) - 0.02)) * step(0.06, vfrac) * resid;
      wallCol *= 1.0 - slabLine * nearDetail * 0.20;                               // 床スラブ下端の落ち影
      wallCol += uSunGlow * 0.04 * sunFacing * smoothstep(0.012, 0.0, abs(fract(fl) - 0.06)) * resid * nearDetail; // スラブ上面に夕日
      vec2 ung = vec2(floor(fract(horizAngle * 1.7 + hGi.x * 0.6) * cols), floor(fl));
      float acBox = step(0.80, h21(ung + hGi + 50.0))
                  * smoothstep(0.10, 0.05, abs(colu - 0.5)) * smoothstep(0.06, 0.0, abs(fract(fl) - 0.52));
      wallCol = mix(wallCol, vec3(0.28, 0.27, 0.26), acBox * nearDetail * 0.5);    // 室外機

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
      // 住宅の切妻屋根（瓦）。陸屋根でなく棟(ridge)で二面に分けた瓦屋根＝坂の住宅地の佇まい。
      if (resid > 0.5) {
        float ridgeAxis = step(0.5, h21(hGi + 12.0));            // 棟の向き（縦/横）
        float across = mix(hGf.y, hGf.x, ridgeAxis);            // 棟に直交する座標(0..1)
        float toEave = abs(across - 0.5) * 2.0;                  // 0=棟 1=軒
        float sunnySide = step(0.5, across);
        vec3 tile = mix(vec3(0.30, 0.33, 0.40), vec3(0.42, 0.27, 0.21), step(0.5, h21(hGi + 19.0))); // いぶし瓦/赤瓦
        float face = mix(mix(1.12, 0.84, sunFacing), mix(0.84, 1.12, sunFacing), sunnySide);          // 二面の陰影
        tile *= face * (1.0 - 0.12 * toEave);
        tile = mix(tile, tile * 1.18, smoothstep(0.05, 0.0, abs(across - 0.5)));                       // 棟の稜線
        tile *= 0.96 + 0.08 * sin(mix(hGf.x, hGf.y, ridgeAxis) * 54.0);                                // 瓦の段の筋
        tile += uSunGlow * 0.05 * sunFacing * dayLit;
        roofTop = mix(roofTop, tile, roofness * detail * 0.85);
      }
      roofTop += uSunGlow * 0.06 * dayLit * (0.5 + 0.5 * sunFacing);                                // 屋上に夕日が乗る（上向き面）

      vec3 bld = mix(wallCol, roofTop, roofness);
      // 雨に濡れた屋上: 空を鈍く映して暗く沈む（屋上面ほど）
      float wetB = step(0.5, glassMode) * step(glassMode, 1.5);
      bld = mix(bld, bld * 0.72 + mix(uSkyMid, uHorizon, 0.5) * 0.10, wetB * 0.5 * roofness);
      // 雪が屋上に積もる（屋上面は厚く・壁の縁はうっすら）＝立体の雪化粧
      float snowB = step(1.5, glassMode);
      bld = mix(bld, vec3(0.88, 0.90, 0.96), snowB * (0.22 + 0.58 * roofness));
      // 隣の棟が落とす影（太陽側に高い棟があれば、この面は翳る）＝棟どうしの立体
      float bShadow = 0.0;
      vec2 g0hit = vec2(horizAngle * hitZ, hitZ);
      for (int s = 1; s <= 3; s++) {
        float dd = float(s) * 0.5;
        vec2 nb = g0hit + vec2(-0.96 + sunAz * 0.6, 0.28) * dd;
        vec2 _gi, _gf; float _bH, _t, _m, _b, _d;
        cityCell(nb, _gi, _gf, _bH, _t, _m, _b, _d);
        bShadow = max(bShadow, step(yray + dd * sunElev, terrainH(nb) + _bH)); // 地形＋棟の高さで影
      }
      bld *= 1.0 - bShadow * 0.30;
      // 坂の陰影: 建物の建つ斜面が太陽へ上るほど明るく、下るほど翳る＝地形と一貫した光
      vec2 sdirB = vec2(-0.96 + sunAz * 0.6, 0.28) * 0.5;
      float terrSunB = hTerr - terrainH(g0hit + sdirB);  // >0=太陽へ下る斜面=陰
      bld *= 0.90 + 0.22 * clamp(0.5 - terrSunB * 1.3, 0.0, 1.0);
      // 屋上の窓灯り/塔屋のあかり（夜）。賑わう街区ほど灯る。深夜は消えていく。
      bld += winLit * roofness * step(0.62 - (0.2 + 0.2 * district) * nightAmt, h21(hGi + 11.0))
           * step(sleepDepth * 0.6, h21(hGi + 71.0))
           * smoothstep(0.34, 0.12, length(hGf - 0.5)) * (0.08 + 0.26 * nightAmt) * detail;
      // 高層の屋上に赤い航空障害灯（ゆっくり明滅）
      bld += vec3(0.9, 0.16, 0.12) * hTower * roofness
           * smoothstep(0.16, 0.0, length(hGf - 0.5)) * (0.5 + 0.5 * sin(uTime * 1.2 * mo + hBlk * 20.0));
      // 空気遠近（遠い箱ほど霞んで空へ）。溶かし過ぎず、遠景もシルエットを残す＝奥行きが立つ
      bld = mix(bld, mix(uHorizon, uSkyMid, 0.4), fog * 0.42);
      // 近景（手前の棟）を持ち上げ、かつ近いほどコントラストを増す＝精細感と奥行き
      float nearK = smoothstep(0.12, 0.42, gt);
      bld *= 1.0 + nearK * 0.14;
      bld = mix(bld, (bld - 0.45) * 1.14 + 0.45, nearK * 0.5); // 近景ほど締まってくっきり
      ground = bld;
    } else {
      // ── 地形の地面（道・坂・公園・川・街路樹…）。起伏する地面の上に街路が乗る ──
      float gz = hit ? hitZ : zground; float gx = horizAngle * gz;
      vec2 g0 = vec2(gx, gz);
      // 坂の陰影: 太陽側へ上る斜面は明るく、下る斜面は翳る（地形の勾配で陰影）
      float terr = terrainH(g0);
      vec2 sdir2 = vec2(-0.96 + sunAz * 0.6, 0.28) * 0.5;
      float terrSun = terrainH(g0) - terrainH(g0 + sdir2);  // 太陽方向への勾配（>0=太陽へ下る=陰）
      float slopeShade = clamp(0.5 - terrSun * 1.2, 0.0, 1.0); // 0=陰 1=陽
      vec2 g = g0 + vec2(sin(g0.y * 1.7 + 1.0), sin(g0.x * 1.9)) * 0.05;
      g.x += h11(floor(g0.y) * 1.3) * 0.45;
      vec2 gi = floor(g); vec2 gf = fract(g);
      float blkR = h21(gi + 2.0);
      float dRoad = min(min(gf.x, 1.0 - gf.x), min(gf.y, 1.0 - gf.y));
      // 区画の性格（都心度・公園か）。建物に当たらず抜けた=道 or 公園 or 低い空き
      float mat = h21(gi + 5.0);
      float urban = vnoise(gi * 0.07 + 3.0);
      float towerC = step(0.93 - 0.20 * urban, h21(gi + 27.0));
      float isPark = step(0.92, mat) * (1.0 - towerC);
      vec3 roadC = mix(vec3(0.20, 0.19, 0.19), uHorizon * 0.3, 0.4) * (1.0 - 0.5 * nightAmt);
      ground = roadC;
      // 公園（緑地）: 芝。街なかの抜け＝郷愁の緑。内部だけ（外周の道は残す）
      vec3 grass = mix(vec3(0.16, 0.27, 0.13), uHorizon * 0.3, 0.22) * (1.0 - 0.45 * nightAmt);
      ground = mix(ground, grass, isPark * smoothstep(0.08, 0.15, dRoad));
      // 雨に濡れた路面: 暗く沈み、空と街の灯りを鈍く映す（雨の情景の実在感）
      float wet = step(0.5, glassMode) * step(glassMode, 1.5);
      ground = mix(ground, ground * 0.55 + mix(uSkyMid, uHorizon, 0.5) * 0.10, wet * 0.6);
      // 川（街を蛇行）＋橋＋水面の映り込み
      float riverX = sin(gz * 0.22 + 1.5) * 1.6 + cos(gz * 0.11) * 0.7;
      float dRiver = abs(g0.x - riverX);
      float river = smoothstep(0.34, 0.22, dRiver);
      // 水面: 空と夕日を映し、さざ波で揺れる。夜は暗く沈んで灯りが点々と映る。
      vec3 waterC = mix(uSkyMid, uHorizon, 0.5) * (0.74 - 0.34 * nightAmt);
      float ripple = sin(gz * 9.0 - uTime * 0.5 * mo) * 0.5 + 0.5;
      waterC += uSunGlow * smoothstep(0.18, 0.0, abs(g0.x - riverX + sin(gz * 2.0) * 0.05)) * (0.14 + 0.22 * ripple); // 夕日の帯
      waterC += mix(uSunGlow, vec3(1.0, 0.9, 0.7), 0.3) * step(0.86, h21(floor(vec2(g0.x * 6.0, gz * 6.0)))) * nightAmt * 0.5 * ripple; // 夜の灯りの映り
      ground = mix(ground, waterC, river * 0.95);
      // 橋（一定間隔で川を渡る。橋桁＋欄干＋夜の橋灯）
      float bridgeT = smoothstep(0.05, 0.022, abs(fract(gz * 0.17 + 0.3) - 0.5));
      float onBridge = bridgeT * smoothstep(0.46, 0.30, dRiver);
      vec3 bridgeC = mix(vec3(0.24, 0.21, 0.20), uHorizon * 0.3, 0.35) * (1.0 - 0.45 * nightAmt);
      ground = mix(ground, bridgeC, onBridge);
      float rail = bridgeT * smoothstep(0.40, 0.435, dRiver) * smoothstep(0.475, 0.44, dRiver); // 両縁の欄干
      ground += uSunGlow * rail * (0.3 + 0.7 * nightAmt);
      river *= 1.0 - onBridge;                          // 橋の上は水を出さない
      // 歩道（道の外縁＝建物際の少し明るい帯）
      float sidewalk = smoothstep(0.16, 0.13, dRoad) * smoothstep(0.085, 0.115, dRoad);
      ground = mix(ground, mix(vec3(0.30, 0.29, 0.28), uHorizon * 0.3, 0.35), sidewalk * 0.5 * (1.0 - river));
      // センターライン（車道の中央に淡い破線）
      float dash = step(0.5, fract(gz * 6.0 + gx * 6.0));
      float centerLine = smoothstep(0.012, 0.004, dRoad) * dash;
      ground = mix(ground, vec3(0.55, 0.50, 0.36), centerLine * 0.30 * (1.0 - river));
      // 樹木（道の脇に並木＋公園は木立に。点々ではなく丸い樹冠＝ザラつかせない）
      vec2 tg = g0 * 2.0; vec2 tgf = fract(tg);
      float treeFall = 1.0 - smoothstep(0.20, 0.34, length(tgf - 0.5));
      float treeSeed = h21(floor(tg) + 41.0);
      float streetTree = step(0.74, treeSeed) * smoothstep(0.19, 0.13, dRoad);  // 並木
      float parkTree = isPark * step(0.42, treeSeed);                            // 公園の木立（密）
      float tree = max(streetTree, parkTree) * treeFall * (1.0 - river);
      vec3 treeCol = mix(vec3(0.12, 0.22, 0.10), uHorizon * 0.25, 0.2) * (1.0 - 0.4 * nightAmt);
      ground = mix(ground, treeCol, tree * 0.62);
      // 西日の長い影（建物が通りへ落とす影＝夕方の立体感）。太陽側に高い区画があれば翳る
      float shadow = 0.0;
      vec2 sdir = vec2(-0.96 + sunAz * 0.6, 0.28);   // 太陽（西やや奥）へ向かう方向（移ろう）
      for (int s = 1; s <= 4; s++) {
        float dd = float(s) * 0.45;
        vec2 nb = g0 + sdir * dd;
        vec2 _gi, _gf; float _bH, _t, _m, _b, _d;
        cityCell(nb, _gi, _gf, _bH, _t, _m, _b, _d);
        shadow = max(shadow, step(terr + dd * sunElev, terrainH(nb) + _bH)); // 地形＋棟で影
      }
      ground *= 1.0 - shadow * 0.28 * (1.0 - river);
      // 坂の陰影（太陽へ上る斜面は明るく・下る斜面は翳る）＝地形の立体
      ground *= 0.86 + 0.28 * slopeShade;
      // 街全体をうっすら底上げ（街灯の照り返し）。夜はさらに
      ground += mix(uHorizon, uSunGlow, 0.4) * (0.04 + 0.07 * nightAmt);
      // 街灯（交差点）
      float lampG = smoothstep(0.10, 0.0, length(gf - 0.5)) * step(0.45, h11(gi.x + gi.y * 3.0 + 7.0));
      ground += uSunGlow * lampG * (0.8 + 0.5 * nightAmt) * (1.0 - river);
      ground += uSunGlow * lampG * wet * 0.6 * (1.0 - river); // 濡れた路面に滲む街灯の照り返し
      // 歩く住民（道沿いを進む人影。頭＋胴＋服の色。近景で見下ろすほど大きくはっきり見える）
      float nearPed = smoothstep(0.10, 0.40, gt);                          // 手前(見下ろし)ほど
      float pedScale = mix(0.7, 3.0, nearPed * nearPed);                   // 近いほどぐっと大きくはっきり
      for (int pi = 0; pi < 2; pi++) {                                     // 1区画に最大2人
        float pf = float(pi);
        float has = step(0.5, h21(gi + 19.0 + pf * 7.0));
        float dir = (h21(gi + 31.0 + pf) > 0.5) ? 1.0 : -1.0;             // 進む向き
        float lane = 0.32 + 0.36 * h21(gi + 41.0 + pf);                    // 歩道のレーン
        vec2 pp = vec2(lane, fract(uTime * 0.045 * dir * mo + h21(gi + 5.0 + pf)));
        vec2 pd = (gf - pp) / vec2(pedScale, pedScale);
        float bob = abs(sin(uTime * 5.0 * mo + pf * 3.0)) * 0.006;        // 歩く上下動
        pd.y += bob;
        float bodyP = smoothstep(0.066, 0.0, length(pd * vec2(2.2, 1.0)) ) * step(-0.03, pd.y); // 縦長の胴
        float headP = smoothstep(0.040, 0.0, length(pd - vec2(0.0, -0.044)));                   // 頭
        vec3 clothes = 0.42 + 0.36 * cos(h21(gi + 50.0 + pf) * 9.0 + vec3(0.0, 2.1, 4.2));        // 服の色
        float on = has * (1.0 - river) * nearPed;
        ground = mix(ground, ground * 0.35, bodyP * 0.5 * on);                                    // 輪郭の陰でくっきり
        ground = mix(ground, clothes * (0.72 - 0.2 * nightAmt), smoothstep(0.052, 0.0, length(pd * vec2(2.2, 1.0))) * step(-0.03, pd.y) * 0.9 * on);
        ground = mix(ground, vec3(0.16, 0.11, 0.09), headP * 0.9 * on);                           // 頭(髪)
        // 足元の小さな影
        ground = mix(ground, ground * 0.7, smoothstep(0.05, 0.0, length((gf - pp - vec2(0.0, -0.05)) * vec2(2.0, 4.0))) * 0.4 * on);
      }
      // 車（縦の道を流れる。ヘッドライト/テール＋前方ビーム）
      float carDir = (blkR > 0.5) ? 1.0 : -1.0;
      float carY = fract(uTime * 0.22 * carDir * mo + blkR);
      float onVroad = smoothstep(0.13, 0.0, abs(gf.x - 0.5));
      float carOn = step(0.45, h11(gi.x * 1.7 + gi.y * 2.3 + 21.0));
      float carBody = smoothstep(0.05, 0.0, abs(gf.y - carY));
      float carBeam = smoothstep(0.16, 0.0, abs(gf.y - carY - carDir * 0.07));
      vec3 carCol = mix(vec3(1.0, 0.92, 0.72), vec3(1.0, 0.30, 0.18), step(0.0, -carDir));
      ground += carCol * onVroad * carOn * (carBody * 0.9 + carBeam * 0.22) * (1.0 - river);
      // 近景を持ち上げ
      ground *= 1.0 + smoothstep(0.12, 0.42, gt) * 0.22;
      // 雪が積もった街路・公園（屋根ほどではないが白む）
      ground = mix(ground, vec3(0.80, 0.83, 0.90), step(1.5, glassMode) * 0.55 * (1.0 - river));
      // 空気遠近（地平で空へ溶ける）
      ground = mix(ground, mix(uHorizon, uSkyMid, 0.35), smoothstep(0.07, 0.0, gt) * 0.85);
    }

    // 流れる雲が地上に落とす大きな影（晴れ間をゆっくり渡る＝空と地が呼応する立体感）。
    // 風に乗って斜めに流れ、ふちは柔らかい。雨雪/夜では弱める（差す日が無いから）。
    vec2 cloudCoord = vec2(horizAngle * hitZ, hitZ);
    float cloudShadow = fbm(cloudCoord * 0.15 + vec2(uTime * 0.017 * mo, uTime * 0.006 * mo) + 9.0);
    cloudShadow = smoothstep(0.50, 0.80, cloudShadow);            // まばらな雲の塊
    float clearSky = 1.0 - 0.6 * step(0.5, glassMode);            // 雨/雪は影を弱める
    ground *= 1.0 - cloudShadow * 0.17 * (1.0 - nightAmt) * clearSky;
    // 谷あいに溜まる靄（低い土地ほど霞む＝起伏する地形の立体感）。ゆっくり流れる。
    float ft = terrainH(vec2(horizAngle * hitZ, hitZ));
    float mistDrift = 0.7 + 0.3 * fbm(vec2(horizAngle * hitZ * 1.5 + uTime * 0.02 * mo, hitZ * 0.8));
    float valMist = smoothstep(0.30, -0.55, ft)                    // 谷（低地）ほど濃い
                  * smoothstep(0.04, 0.20, gt) * (1.0 - smoothstep(0.34, 0.55, gt)) // 中景に溜まる
                  * mistDrift;
    ground = mix(ground, mix(uHorizon, uSkyMid, 0.5), valMist * (0.10 + 0.16 * (1.0 - nightAmt)));
    // 遠雷の閃光が街をほのかに照らす（空のフラッシュと同期）
    ground += uFlash * vec3(0.82, 0.88, 1.0) * 0.16;
    return ground;
  }
`
