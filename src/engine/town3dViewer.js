// 本物の3Dで「窓から見下ろす坂の街」を描くビューア（Three.js・低ポリ＋トゥーン）。
// フラグメントの平面画でなく、実体のある建物・電柱・木・雲・アドバルーンを立体配置し、
// スワイプで見回す。窓辺シリーズの“立体的に覗き込む”手応えを本物の3Dで出す。
// 連打切替に耐えるよう世代トークンで mount をキャンセル可能にする。

let token = 0
let active = null // { renderer, scene, camera, raf, dispose, stage }

const lerp = (a, b, t) => a + (b - a) * t

// トゥーンの段階を作る勾配テクスチャ（3段）。やわらかいセル影。
function makeGradient(THREE) {
  const data = new Uint8Array([182, 200, 216, 232, 248, 255]) // やわらかい段階。Linear補間で陰影をなめらかに（硬い面・トゥーンの帯を出さない＝丸く見える）
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat)
  tex.needsUpdate = true
  tex.magFilter = THREE.LinearFilter // Nearest→Linear: 陰影の境界を平滑化して角ばり/CG感を減らす
  tex.minFilter = THREE.LinearFilter
  return tex
}

export function isTown3dActive() {
  return !!active
}

// 見回し（スワイプ）。nx,ny は累積の相対量。乗り出すと見回せる幅が広がる。
export function applyTown3dLook(dx, dy) {
  if (!active) return
  const l = active.lean || 0
  const yawMax = 0.9 + l * 0.7   // 乗り出すと左右に大きく見渡せる
  const pitchUp = 0.5 + l * 0.28
  const pitchDn = 0.35 + l * 0.2
  // 目標値を動かし、frame loop でイージング追従（指を離しても余韻＝ヌルヌル）。感度UP。
  active.yawTarget = Math.max(-yawMax, Math.min(yawMax, active.yawTarget + dx * 2.4))
  active.pitchTarget = Math.max(-pitchDn, Math.min(pitchUp, active.pitchTarget + dy * 1.6))
}

export function resetTown3dLook() {
  if (active) { active.yawTarget = 0; active.pitchTarget = 0 }
}

// 窓をあける／しめる（ガラスが横にすべって外気が澄む）。
export function setTown3dWindowOpen(open) {
  if (active) active.winOpenTarget = open ? 1 : 0
}

// 身を乗り出す／もどる（枠を越えて前へ＝視界が広がる）。乗り出すには窓をあける。
export function setTown3dLean(lean) {
  if (!active) return
  active.leanTarget = lean ? 1 : 0
  if (lean) active.winOpenTarget = 1
}

export async function unmountTown3d() {
  token++
  const a = active
  active = null
  if (a) {
    cancelAnimationFrame(a.raf)
    try { a.dispose() } catch (e) { /* 無視 */ }
    if (a.stage && a.stage.parentNode) a.stage.parentNode.removeChild(a.stage)
  }
}

export async function mountTown3d(parent, opts = {}) {
  await unmountTown3d() // 既存を片付け（token をインクリメント）。この後で自分の世代を確定する。
  const my = ++token
  const THREE = await import('three')
  if (my !== token) return

  const stage = document.createElement('div')
  stage.className = 'town3d-stage'
  parent.appendChild(stage)

  const W = stage.clientWidth || window.innerWidth
  const H = stage.clientHeight || window.innerHeight
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(W, H)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  // 影を「一度だけ焼く」静的影に（太陽は固定＝建物/木の影は不変）。毎フレームの影パス（数百の投影体の再ラスタライズ）を撤廃して発熱を大きく下げる。動く車/人の影は捨てる（小さく目立たない）。
  renderer.shadowMap.autoUpdate = false
  stage.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const pal = opts.palette || {}
  const season = opts.season || 'summer' // 季節で地面・木の色を替える
  const weather = opts.weather || null    // 'snow' | 'petals' | 'leaves' | null（降るもの）
  const kind = opts.kind || 'town'        // 'town'（坂の街）| 'yato'（谷戸＝棚田と茅葺の屋敷）
  const skyTop = new THREE.Color(pal.skyTop || '#7fb0d8')
  const skyHorizon = new THREE.Color(pal.horizon || '#f2dcc0')
  const sunCol = new THREE.Color(pal.sunGlow || '#ffe6c2')
  // 空気遠近の霞（遠景を空色へやわらかく溶かす＝絵画的な奥行き。手前は鮮明）。雪は濃く冷たく。
  const fogCol = weather === 'snow'
    ? skyHorizon.clone().lerp(new THREE.Color(0xeef2f6), 0.5).getHex()
    : skyHorizon.clone().lerp(skyTop, 0.42).getHex() // 地平の色をより残し、暖かな空気の層に
  // 霞を一段強め、中景の低ポリを空気遠近で溶かして奥行きと水彩感を出す（手前は鮮明に保つ）。
  // near を手前へ・far を近くへ寄せて、遠景〜中景がやわらかな大気に溶ける絵画的な奥行きにする。
  scene.fog = new THREE.Fog(fogCol, weather === 'snow' ? 38 : 44, weather === 'snow' ? 158 : 172)

  // 空ドーム（上=空色, 下=地平の暖色のグラデ）
  {
    const skyGeo = new THREE.SphereGeometry(400, 24, 16)
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: skyTop }, bot: { value: skyHorizon } },
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bot; void main(){ float h=clamp(vP.y/400.0*1.4+0.15,0.0,1.0); gl_FragColor=vec4(mix(bot,top,h),1.0);} ',
    })
    scene.add(new THREE.Mesh(skyGeo, skyMat))
  }

  // 奥の実写背景（任意・Flux生成の遠景）。近景の立体の奥に、写真級の遠望を円筒状に敷いて写真的な奥行きを出す。
  // 近景の建物・木が手前を覆い、霞(fog)が中景を溶かして、遠景の実写へ自然につながる二層構成。
  // 堅牢化: 低ポリ遠山(mtns)は常に作り、実写背景が「読めた時だけ」山を消す＝画像が無ければ山が残る安全フォールバック。
  const mtns = []
  if (opts.bg3d) {
    const BASE = import.meta.env.BASE_URL || '/'
    new THREE.TextureLoader().load(BASE + opts.bg3d, (tex) => {
      if (my !== token) return
      tex.colorSpace = THREE.SRGBColorSpace
      const geo = new THREE.CylinderGeometry(232, 232, 156, 64, 1, true)
      const back = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        map: tex, side: THREE.BackSide, fog: false, depthWrite: true,
      }))
      back.position.y = 36 // 実写の里山が近景の低ポリ街の上にちょうど座る高さ
      back.rotation.y = Math.PI // 画像の中心を初期視線(-z)へ
      back.renderOrder = -1 // 近景より先に描く（遠景の最背面）
      scene.add(back)
      mtns.forEach((m) => scene.remove(m)) // 実写が読めたので低ポリ遠山を消す（実写が代替）
    })
  }

  const isNight = (skyTop.r + skyTop.g + skyTop.b) < 0.7 // 暗い palette = 夜
  // フィルミックなトーンマッピング（ACES）＝写真的なハイライトのころび・階調。実写風へ寄せる核。
  // Lambert 拡散シェーディングと合わせ、トゥーンの平面感を脱して実物に近い光の乗りにする。
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = isNight ? 1.7 : 1.5 // ACESの沈みを補正（夜はやや明るめ）
  // 光（やわらかなトゥーン陰影。夜は月明かりへ）
  const sun = new THREE.DirectionalLight(isNight ? 0xa8bbe4 : sunCol.getHex(), isNight ? 0.4 : 0.92)
  sun.position.set(isNight ? 24 : -30, 42, isNight ? -16 : 20)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048) // 影は一度だけ焼く静的影なので、高精細化しても実行時コストは増えない（精度↑）
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 160
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60
  scene.add(sun)
  // 空からの回り込み光（影側を黒く沈めない＝くすみ防止）。地面側は暖色で泥にしない。
  scene.add(new THREE.HemisphereLight(skyTop.clone().lerp(new THREE.Color(0xffffff), 0.4).getHex(), 0x9a8a6e, isNight ? 0.55 : 1.25))
  scene.add(new THREE.AmbientLight(0xfff2e0, isNight ? 0.13 : 0.45))
  // 夜は月と星
  if (isNight) {
    const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 16), new THREE.MeshBasicMaterial({ color: 0xf4f3ea, fog: false }))
    moon.position.set(70, 90, -120); scene.add(moon)
    const starGeo = new THREE.BufferGeometry()
    const sp = []
    for (let i = 0; i < 260; i++) {
      const r = 360, th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.5
      sp.push(Math.cos(th) * Math.sin(ph) * r, Math.cos(ph) * r * 0.9 + 30, -Math.abs(Math.sin(th)) * Math.sin(ph) * r - 30)
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xeaf0ff, size: 1.4, sizeAttenuation: false, fog: false })))
  }

  // 地平のやわらかな光のにじみ（夕陽/街あかりのグロー）。重いポスト処理を使わず、加算スプライト1枚で
  // 大気のグローを出す（モバイル配慮）。空に光源のにじみがあるだけで“様式化された高品質”に近づく。
  {
    const gc = document.createElement('canvas'); gc.width = gc.height = 128
    const gx = gc.getContext('2d')
    const grd2 = gx.createRadialGradient(64, 64, 0, 64, 64, 64)
    grd2.addColorStop(0, 'rgba(255,255,255,0.85)')
    grd2.addColorStop(0.3, 'rgba(255,255,255,0.40)')
    grd2.addColorStop(1, 'rgba(255,255,255,0)')
    gx.fillStyle = grd2; gx.fillRect(0, 0, 128, 128)
    const glowTex = new THREE.CanvasTexture(gc)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: isNight ? new THREE.Color(0xffb273) : sunCol.clone().lerp(new THREE.Color(0xffffff), 0.35),
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: isNight ? 0.4 : 0.55,
    }))
    glow.position.set(0, 16, -190) // 遠い地平。手前の街に隠れて“街の向こうのにじみ”になる
    glow.scale.set(220, 120, 1)    // 横長＝地平の光の帯
    scene.add(glow)
  }

  // 拡散シェーディング（実写寄り）。MeshLambertMaterial は gradientMap を持たないため渡さない（無効な警告とテクスチャ生成の無駄を排す）。
  const toon = (hex) => new THREE.MeshLambertMaterial({ color: hex })

  // 壁＋窓のテクスチャ（乗算マップ）。壁はベタ白を避け、コンクリの微細なムラ＋雨だれの経年汚れを描いて
  // 実写の建物の質感に近づける。窓は灰（通常）／暖色emissive（灯り）。64pxで滑らかに。
  function makeWinTex(lit, seed) {
    const S = 64
    const c = document.createElement('canvas'); c.width = c.height = S
    const g = c.getContext('2d')
    let s = seed * 2654435761
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
    if (lit) { g.fillStyle = '#000000'; g.fillRect(0, 0, S, S) }
    else {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S)
      // コンクリ/モルタルの微細なムラ（乗算なので暗いほど陰る＝のっぺり白を避ける）
      for (let i = 0; i < 110; i++) {
        const v = 206 + (rnd() * 49 | 0)
        g.fillStyle = `rgba(${v},${v},${v - 8},0.22)`
        g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 3, 1 + rnd() * 3)
      }
      // 縦の雨だれ筋（窓下から伸びる経年の汚れ＝建物のリアルさ）
      for (let k = 0; k < 7; k++) {
        const sx = rnd() * S
        g.fillStyle = `rgba(118,120,128,${0.05 + rnd() * 0.06})`
        g.fillRect(sx, rnd() * S * 0.4, 0.8 + rnd(), S * (0.3 + rnd() * 0.5))
      }
    }
    // 窓の格子（3列×4段）
    for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 3; xx++) {
      if (lit) { g.fillStyle = rnd() < 0.45 ? '#ffd089' : '#0a0a0a' }
      else { g.fillStyle = rnd() < 0.5 ? '#6b6b75' : '#76767f' } // 窓ごとに僅かな濃淡
      g.fillRect(8 + xx * 18, 7 + yy * 14, 11, 9)
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.magFilter = THREE.LinearFilter // 微細な壁質感を滑らかに（Nearestのブロック感を脱す）
    return t
  }
  const winMapBase = makeWinTex(false, 1)
  const winEmis = [makeWinTex(true, 3), makeWinTex(true, 11), makeWinTex(true, 29), makeWinTex(true, 53)]
  // 灯り度（空の明るさで決める。明るい昼=窓は灯らない／夕暮れ=ほのか／夜=煌々と）
  const skyBright = (skyTop.r + skyTop.g + skyTop.b) / 3
  const duskAmt = Math.min(1, Math.max(0, (0.56 - skyBright) * 2.4))
  const rng = (seed) => { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 } }
  const R = rng(7)

  const town = new THREE.Group()
  scene.add(town)
  // 街専用の動くもの（谷戸では作らない）。描画ループから参照するので関数スコープで宣言。
  let adBalloons = []
  let cars = []
  let peeps = []
  let ferris = null

  // 谷のプロファイル: 手前(z>0)=自分の急な丘で高い → 谷底(z≈-30)で低い → 奥(z<-55)で向かいの丘・山が上がる。
  // 坂を7割登った高台から、谷へ下って広がる街を見下ろす立体感。
  const heightAt = (x, z) => {
    if (kind === 'yato') {
      // 谷戸の地形: 中央(|x|<13)が平らな谷底（棚田）、左右の里山が|x|で立ち上がり、奥で向かいの斜面が上がる。
      let base
      if (z > 6) base = (z - 6) * 0.6 + 1.5                       // 手前=自分の丘（カメラ側ほど高い）
      else if (z > -46) base = -2.0 + Math.sin(z * 0.08) * 0.25   // 谷底（ほぼ平ら・低い）
      else base = -2.0 + (-46 - z) * 0.42                         // 奥の向かいの斜面が立ち上がる
      const sx = Math.max(0, Math.abs(x) - 13)
      const hill = sx * 0.9 + Math.pow(sx * 0.12, 1.6) * 7.0       // 左右の里山（谷の縁から立ち上がる）
      const bump = Math.sin(x * 0.08 + 1.3) * 0.7 + Math.cos(z * 0.07) * 0.6 + Math.sin((x + z) * 0.12) * 0.4
      return base + hill + bump
    }
    let vy
    if (z > 0) vy = z * 0.38 + 1.0                               // 手前の丘の肩（カメラ側ほど高い）
    else if (z > -52) vy = z * 0.17                              // 谷へ下る斜面（街が駆け下る）
    else vy = -52 * 0.17 + (-52 - z) * 0.16                       // 向かいの丘がゆるやかに立ち上がる（空を塞がない）
    const bump = Math.sin(x * 0.06 + 1.0) * 1.5 + Math.cos(z * 0.05) * 1.7 + Math.sin((x + z) * 0.13) * 0.9
    return vy + bump
  }
  // 地面・道のベタ塗りを避ける、水彩のような淡いムラのテクスチャ（手描きの手触り＝のっぺり感の解消）。
  // 2層構成: 低周波の大きな色斑（草地・土・陰りの“面”の多様さ＝絵画的な地面）＋高周波の細かなムラ（手触り）。
  function makeMottle(baseHex, n, lightSpread) {
    const S = 320
    const c = document.createElement('canvas'); c.width = c.height = S
    const x = c.getContext('2d')
    const base = new THREE.Color(baseHex)
    x.fillStyle = '#' + base.getHexString(); x.fillRect(0, 0, S, S)
    // 大きな色斑（面の変化）: 色相・明度を広めに振り、草地に土や陰りの“地帯”を作る。タイル感を避けるため大半径。
    const big = Math.max(7, Math.round(n * 0.14))
    for (let i = 0; i < big; i++) {
      const col = base.clone().offsetHSL((R() - 0.5) * 0.05, (R() - 0.5) * 0.13, (R() - 0.5) * lightSpread * 1.9)
      x.globalAlpha = 0.06 + R() * 0.11
      x.fillStyle = '#' + col.getHexString()
      x.beginPath(); x.arc(R() * S, R() * S, 70 + R() * 110, 0, 6.283); x.fill()
    }
    // 細かなムラ（手描きの手触り）
    for (let i = 0; i < n; i++) {
      const col = base.clone().offsetHSL((R() - 0.5) * 0.03, (R() - 0.5) * 0.06, (R() - 0.5) * lightSpread)
      x.globalAlpha = 0.05 + R() * 0.10
      x.fillStyle = '#' + col.getHexString()
      x.beginPath(); x.arc(R() * S, R() * S, 15 + R() * 58, 0, 6.283); x.fill()
    }
    x.globalAlpha = 1
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
  }
  const mottleMat = (baseHex, n, spread, rep) => {
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff, map: makeMottle(baseHex, n, spread) })
    m.map.repeat.set(rep[0], rep[1])
    return m
  }

  // ── 起伏する地面（谷へ下る坂の街の地面） ──
  {
    const g = new THREE.PlaneGeometry(280, 300, 60, 64)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      pos.setY(i, heightAt(x, z))
    }
    g.computeVertexNormals()
    // 季節で地面の色を替える（雪=淡い白／春=新緑／秋=枯草／夏=くすんだ草地。蛍光緑を避ける）
    const groundHex = weather === 'snow' ? 0xe2e8ec : season === 'spring' ? 0x93a35a : season === 'autumn' ? 0x9c8a4e : 0x8a9060
    const ground = new THREE.Mesh(g, mottleMat(groundHex, 210, 0.15, [4, 4])) // 草地に大小のムラ＝絵画的な地面（反復を減らし大きな色斑を効かせる）
    ground.receiveShadow = true
    town.add(ground)
  }
  // 中央の通り（舗装。電柱が沿い、車・人が行き交う）。地形に沿うリボン。街のみ。
  if (kind !== 'yato') {
    const rg = new THREE.PlaneGeometry(7.5, 130, 1, 56); rg.rotateX(-Math.PI / 2)
    const rp = rg.attributes.position
    for (let i = 0; i < rp.count; i++) {
      const lx = rp.getX(i), lz = rp.getZ(i)
      rp.setY(i, heightAt(lx, lz - 35) + 0.07)
    }
    rg.computeVertexNormals()
    // 舗装テクスチャ: アスファルトのムラ＋黄色のセンターライン（破線）＋路肩線（実写の路面標示。メッシュ増なし）
    const rtc = document.createElement('canvas'); rtc.width = 64; rtc.height = 256
    const rtx = rtc.getContext('2d')
    rtx.fillStyle = '#474750'; rtx.fillRect(0, 0, 64, 256)
    for (let i = 0; i < 70; i++) { const v = 58 + ((R() * 34) | 0); rtx.fillStyle = `rgba(${v},${v},${v + 5},0.16)`; rtx.fillRect(R() * 64, R() * 256, 2 + R() * 7, 2 + R() * 12) }
    rtx.fillStyle = 'rgba(206,196,150,0.55)'; for (let y = 0; y < 256; y += 44) rtx.fillRect(31, y + 8, 3, 22) // 黄色のセンターライン（破線）
    rtx.fillStyle = 'rgba(198,198,198,0.26)'; rtx.fillRect(6, 0, 2, 256); rtx.fillRect(56, 0, 2, 256) // 路肩線
    const roadTex = new THREE.CanvasTexture(rtc); roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping; roadTex.repeat.set(1, 8)
    const road = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ map: roadTex }))
    road.position.z = -35; road.receiveShadow = true; town.add(road)
    // 横の通り（数本）
    for (const cz of [-6, -28, -50]) {
      const cg = new THREE.PlaneGeometry(120, 6, 48, 1); cg.rotateX(-Math.PI / 2)
      const cp = cg.attributes.position
      for (let i = 0; i < cp.count; i++) { const lx = cp.getX(i), lz = cp.getZ(i); cp.setY(i, heightAt(lx, lz + cz) + 0.06) }
      cg.computeVertexNormals()
      const cr = new THREE.Mesh(cg, toon(0x474750)); cr.position.z = cz; cr.receiveShadow = true; town.add(cr)
    }
  }

  // ── 建物・ランドマーク（低ポリの箱＋切妻屋根）。街のみ（谷戸では作らない）。 ──
  if (kind !== 'yato') {
  const wallCols = [0xd8cfbf, 0xcec0af, 0xc6c0b2, 0xc2b4a4, 0xd0c2ac, 0xbcc0b6]
  const roofCols = [0x59636e, 0x7a5e50, 0x4e5660, 0x6a6258, 0x5e6a5c, 0x86766a] // くすんだ瓦（スレート青/テラコッタ/紺/灰/苔/茶）
  // 屋根は色ごとに質感テクスチャ（瓦の濃淡・苔・経年のムラ）を1枚ずつ共有＝見下ろしの屋根のベタ塗りを解消
  const roofMats = roofCols.map((c) => mottleMat(c, 60, 0.13, [3, 2]))
  // 屋上・壁の雑多な設備（室外機/水タンク/塔屋/アンテナ）の共有マテリアル＝見下ろしの密度＝実写の生活感。
  const acMat = toon(0xd8d4c6), tankMat = toon(0x6e6a64), phMat = toon(0x8a8478), antMat = toon(0x46464c)
  // 陸屋根の屋上に雑多な設備を載せる（共有マテリアルで描画数を抑える）。
  function addRoofClutter(g, w, d, h) {
    const ph = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 1.6, d * 0.3), phMat) // 塔屋（階段室）
    ph.position.set((R() - 0.5) * w * 0.4, h + 0.8, (R() - 0.5) * d * 0.4); ph.castShadow = true; g.add(ph)
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(d * 0.15, d * 0.15, 1.3, 8), tankMat) // 水タンク
    tank.position.set(w * 0.28, h + 0.9, -d * 0.2); tank.castShadow = true; g.add(tank)
    const nAc = 1 + ((R() * 2) | 0) // 室外機 1〜2
    for (let i = 0; i < nAc; i++) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.5), acMat)
      ac.position.set((R() - 0.5) * w * 0.6, h + 0.55, (R() - 0.5) * d * 0.6); ac.castShadow = true; g.add(ac)
    }
    if (R() < 0.55) { // アンテナ（細い支柱）
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 4), antMat)
      pole.position.set(-w * 0.3, h + 1.5, d * 0.25); g.add(pole)
    }
  }
  function house(x, z, w, d, h, type) {
    const gy = heightAt(x, z)
    const g = new THREE.Group()
    const wm = toon(wallCols[(R() * wallCols.length) | 0]) // 壁は軽量な拡散材（多数あるため性能優先）
    const rep = Math.max(1, Math.round(w / 2.6)), repV = Math.max(1, Math.round(h / 2.4))
    const m = winMapBase.clone(); m.repeat.set(rep, repV); m.needsUpdate = true
    wm.map = m
    if (duskAmt > 0.12) { // 夕方は窓が灯る
      const e = winEmis[(R() * winEmis.length) | 0].clone(); e.repeat.set(rep, repV); e.needsUpdate = true
      wm.emissiveMap = e; wm.emissive = new THREE.Color(0xffcaa0); wm.emissiveIntensity = 0.45 + duskAmt * 0.9
    }
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wm)
    body.position.y = h / 2
    body.castShadow = true; body.receiveShadow = true
    g.add(body)
    if (type === 'house') {
      // 切妻 or 寄棟の瓦屋根（色ごとの質感テクスチャを共有）
      const rMat = roofMats[(R() * roofMats.length) | 0]
      if (R() < 0.6) {
        const rg = new THREE.CylinderGeometry(d * 0.62, d * 0.62, w, 3, 1)
        rg.rotateZ(Math.PI / 2); rg.rotateY(Math.PI / 2)
        const roof = new THREE.Mesh(rg, rMat); roof.position.y = h + d * 0.30; roof.scale.y = 0.7; roof.castShadow = true; g.add(roof)
      } else {
        const rg = new THREE.ConeGeometry(Math.max(w, d) * 0.74, d * 0.62, 4); rg.rotateY(Math.PI / 4)
        const roof = new THREE.Mesh(rg, rMat); roof.position.y = h + d * 0.30; roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); roof.castShadow = true; g.add(roof)
      }
      // 壁際の室外機（どの家にもある生活感）
      if (R() < 0.85) {
        const ac = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.45), acMat)
        ac.position.set(w * 0.5 + 0.22, 0.5, (R() - 0.5) * d * 0.5); ac.castShadow = true; g.add(ac)
      }
    } else if (type === 'apt') {
      // 団地・アパート：陸屋根＋前面のベランダ（手すり付き＝平成の集合住宅）
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.5, d * 1.04), toon(0x8a8478)); cap.position.y = h + 0.25; cap.castShadow = true; g.add(cap)
      addRoofClutter(g, w, d, h + 0.5) // 屋上に階段室・水タンク・室外機・アンテナ＝生活感
      const floors = Math.max(2, Math.round(h / 2.8))
      const balMat = toon(0xbcb6a8), railMat = toon(0x68686c)
      for (let f = 1; f < floors; f++) {
        const yy = f * (h / floors)
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.18, 0.85), balMat); slab.position.set(0, yy, d / 2 + 0.38); g.add(slab)
        const rail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.5, 0.1), railMat); rail.position.set(0, yy + 0.32, d / 2 + 0.78); g.add(rail)
      }
    } else { // mid: 陸屋根＋屋上設備（塔屋・水タンク・室外機・アンテナ）
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 1.03, 0.4, d * 1.03), toon(0x9a9488)); cap.position.y = h + 0.2; cap.castShadow = true; g.add(cap)
      addRoofClutter(g, w, d, h + 0.4)
    }
    g.position.set(x, gy, z)
    g.rotation.y = (R() - 0.5) * 0.5
    town.add(g)
  }

  // 街区を碁盤にばらまく（奥へ広がる坂の街。手前中央は道＝視界が抜ける）
  for (let zi = -11; zi <= 2; zi++) {
    for (let xi = -8; xi <= 8; xi++) {
      if (Math.abs(xi) < 1.6 && zi > -3) continue // 手前中央は道（街を見通す抜け）
      if (R() < 0.08) continue // 密な街（抜けは僅か）
      const x = xi * 9 + (R() - 0.5) * 3
      const z = zi * 9 + (R() - 0.5) * 3
      const far = (zi + 11) / 13 // 0=奥 1=手前
      const w = lerp(3.2, 5.5, far) + R() * 1.4
      const d = lerp(3.2, 5.5, far) + R() * 1.4
      // 高さの分布を広げ、均質な高層の壁を避ける（低い家が主役・たまに中層/団地）
      const tall = R() < 0.12
      const h = tall ? lerp(8, 18, R() * R()) : lerp(2.6, 5.5, far) + R() * 2.2
      const type = h > 8.5 ? (R() < 0.55 ? 'apt' : 'mid') : (R() < 0.22 ? 'apt' : 'house')
      house(x, z, w, d, h, type)
    }
  }

  // ── 自分の丘の近所（手前の両脇の家。緑だけの近景を埋め、自分も坂の街に居る感じに） ──
  for (const c of [[-13, 24], [13, 25], [-19, 19], [20, 20], [-10, 28], [11, 29]]) {
    house(c[0], c[1], 5 + R() * 1.5, 5 + R() * 1.5, 4 + R() * 2, R() < 0.7 ? 'house' : 'apt')
  }

  // ── 自販機（路傍にぽつぽつ＝日本の街の象徴。夕/夜は前面が光って灯りになる） ──
  {
    const vendCols = [0xb24a44, 0x4a6692, 0xd6cebe, 0xbe9050] // くすんだ郷愁色（原色を抑える）
    for (let i = 0; i < 8; i++) {
      const side = R() < 0.5 ? -1 : 1
      const vx = side * (4.4 + R() * 1.6)
      const vz = -9 - R() * 64
      const col = vendCols[(R() * vendCols.length) | 0]
      const vm = toon(col)
      if (duskAmt > 0.1) { vm.emissive = new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.35); vm.emissiveIntensity = 0.3 + duskAmt * 0.7 }
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 0.72), vm)
      box.position.set(vx, heightAt(vx, vz) + 0.95, vz); box.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2
      box.castShadow = true; town.add(box)
    }
  }

  // ── 路傍の低木（植栽）と駐車中の車＝街路の密度・生活感 ──
  {
    const bushHex = season === 'spring' ? 0x7a9a4e : season === 'autumn' ? 0x977a3e : season === 'winter' ? 0x8a9488 : 0x5e7a44
    const bushMat = toon(bushHex)
    const carCols = [0xb0564a, 0xe8e2d4, 0x3a5a7a, 0x9a9488, 0x4a6a4a, 0x2a2a30]
    for (let i = 0; i < 14; i++) {
      const side = R() < 0.5 ? -1 : 1
      const bx = side * (5.2 + R() * 3.6)
      const bz = -6 - R() * 70
      const r = 0.6 + R() * 0.7
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), bushMat)
      bush.position.set(bx, heightAt(bx, bz) + r * 0.7, bz); bush.scale.y = 0.8; bush.castShadow = true; town.add(bush)
    }
    for (let i = 0; i < 6; i++) {
      const side = R() < 0.5 ? -1 : 1
      const cx = side * (3.3 + R() * 0.9)
      const cz = -12 - R() * 54
      const cy = heightAt(cx, cz)
      const car = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.0, 3.4), toon(carCols[(R() * carCols.length) | 0]))
      car.position.set(cx, cy + 0.55, cz); car.rotation.y = side > 0 ? 0.05 : -0.05; car.castShadow = true; town.add(car)
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.7), toon(0x2a2e34))
      cab.position.set(cx, cy + 1.25, cz - 0.1); town.add(cab)
    }
  }

  // ── 路沿いの小さな商店（庇＋袖看板。夕/夜は看板が灯る＝商店街の生活感） ──
  for (const sc of [[-5.6, -16, 0xcabfa6, 0xb0704a], [6, -30, 0xc0baa8, 0x5e7a5e], [-6, -48, 0xc6bdac, 0xa65a68], [5.6, -60, 0xc4bca8, 0xb09a58]]) { // 庇/看板はくすんだ郷愁色（原色のデバッグ感を排す）
    const sx = sc[0], sz = sc[1], gy = heightAt(sx, sz), facing = sx < 0 ? 1 : -1
    const b = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.3, 4), toon(sc[2])); b.position.set(sx, gy + 1.65, sz); b.castShadow = true; b.receiveShadow = true; town.add(b)
    const awn = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.4, 1.7), toon(sc[3])); awn.position.set(sx + facing * 1.1, gy + 2.45, sz); awn.rotation.z = facing * 0.12; awn.castShadow = true; town.add(awn)
    const lit = duskAmt > 0.2
    const sg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.0, 1.0), lit ? new THREE.MeshBasicMaterial({ color: sc[3], fog: true }) : toon(sc[3]))
    sg.position.set(sx + facing * 2.25, gy + 2.9, sz + 1.5); town.add(sg)
  }

  // ── 大きなランドマーク（大型スーパー＝平らな大箱＋駐車場＋屋上看板） ──
  {
    const x = 24, z = -20, gy = heightAt(x, z)
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(20, 9, 14), toon(0xe0d8c8))
    body.position.y = 4.5; body.castShadow = true; body.receiveShadow = true; g.add(body)
    const sign = new THREE.Mesh(new THREE.BoxGeometry(16, 2.2, 0.6), toon(0xc23a2c))
    sign.position.set(0, 9.6, 7.1); g.add(sign)
    // 屋上の看板塔（街から見える大きな看板）
    const tower = new THREE.Mesh(new THREE.BoxGeometry(12, 3.2, 0.8), toon(0xd23a4a))
    tower.position.set(0, 11.4, 0); g.add(tower)
    // 駐車場（店の手前の舗装）＋駐車中の車
    const lot = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, 13), toon(0x63636b))
    lot.position.set(0, 0.15, 15); lot.receiveShadow = true; g.add(lot)
    const pcols = [0xb0564a, 0xe8e2d4, 0x3a5a7a, 0x9a9488, 0x4a6a4a]
    for (let i = 0; i < 12; i++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.0, 3.2), toon(pcols[i % pcols.length]))
      car.position.set(-9.5 + (i % 6) * 3.8, 0.8, 12.5 + ((i / 6) | 0) * 4.5); car.castShadow = true; g.add(car)
    }
    g.position.set(x, gy, z); g.rotation.y = -0.3; town.add(g)
  }
  // ── パチンコ屋（建物＋縦長の袖看板。夜/夕にだけネオンが煌々と灯る。昼は派手にしない） ──
  {
    const x = -22, z = -28, gy = heightAt(x, z)
    const b = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 7), toon(0xa07888))
    b.position.set(x, gy + 3, z); b.castShadow = true; b.receiveShadow = true; town.add(b)
    const neonOn = duskAmt > 0.25
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 9, 0.4), neonOn ? new THREE.MeshBasicMaterial({ color: 0xff5a7a, fog: true }) : toon(0xcc6a7a))
    sign.position.set(x + 4.3, gy + 9, z); town.add(sign)
    if (neonOn) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(2.7, 9.4, 0.18), new THREE.MeshBasicMaterial({ color: 0x6ad0ff, fog: true }))
      edge.position.set(x + 4.3, gy + 9, z - 0.16); town.add(edge)
    }
  }
  // ── 新装開店の電気屋（バルーンの真下。カラフルな庇＋幟） ──
  {
    const x = 12, z = -14, gy = heightAt(x, z)
    const b = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 6), toon(0xc8ccd0))
    b.position.set(x, gy + 2.5, z); b.castShadow = true; town.add(b)
    const awn = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.5, 2.2), toon(0xd23a4a))
    awn.position.set(x, gy + 3.4, z + 3.4); town.add(awn)
    // 店先の幟（赤白の細い旗）
    for (let k = -2; k <= 2; k++) {
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 0.7), toon(k % 2 ? 0xffffff : 0xd23a4a))
      flag.position.set(x + k * 1.8, gy + 1.2, z + 4.4); town.add(flag)
    }
  }

  // ── 鳥居（神社の入口。赤い門＝郷愁の目印） ──
  {
    const x = -14, z = -42, gy = heightAt(x, z)
    const red = toon(0xc0392b)
    for (const sx of [-2.6, 2.6]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 7.5, 8), red)
      p.position.set(x + sx, gy + 3.75, z); p.castShadow = true; town.add(p)
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(8, 0.7, 1.1), red); top.position.set(x, gy + 7.4, z); top.castShadow = true; town.add(top)
    const top2 = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.45, 0.8), red); top2.position.set(x, gy + 6.3, z); town.add(top2)
  }
  // ── 商店街（小さな店が並ぶ一角＋色とりどりの庇） ──
  for (let i = 0; i < 7; i++) {
    const x = -34 + i * 5.2, z = -10, gy = heightAt(x, z)
    const b = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.6, 4.4), toon(wallCols[i % wallCols.length]))
    b.position.set(x, gy + 1.8, z); b.castShadow = true; b.receiveShadow = true; town.add(b)
    const aw = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.35, 1.5), toon([0xc23a2c, 0x3a6a9a, 0x3e8a4a, 0xd8a030][i % 4]))
    aw.position.set(x, gy + 2.5, z + 2.4); town.add(aw)
  }

  // ── 自動販売機（街角に灯る。昼夜とも光る前面＝平成の郷愁） ──
  const vmCols = [0xc83838, 0x3a64c8, 0xe0a420]
  for (const spot of [[-30, -7, 3], [11, -5, 2], [-7, -31, 2], [26, -8, 2]]) {
    for (let k = 0; k < spot[2]; k++) {
      const x = spot[0] + k * 1.3, z = spot[1], gy = heightAt(x, z)
      const vm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.0, 0.8), toon(vmCols[k % 3])); vm.position.set(x, gy + 1.0, z); vm.castShadow = true; town.add(vm)
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.4, 0.06), new THREE.MeshBasicMaterial({ color: 0xfff2cc, fog: true })); panel.position.set(x, gy + 1.15, z + 0.44); town.add(panel)
    }
  }
  // ── 児童公園（砂場・すべり台・ブランコの骨組み） ──
  {
    const px = -16, pz = -23, gy = heightAt(px, pz)
    const sand = new THREE.Mesh(new THREE.BoxGeometry(5, 0.25, 5), toon(0xd6c69a)); sand.position.set(px, gy + 0.12, pz); sand.receiveShadow = true; town.add(sand)
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 3), toon(0xcc3a4a)); slide.position.set(px + 3, gy + 1.0, pz); slide.rotation.x = 0.5; slide.castShadow = true; town.add(slide)
    const bar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 0.16), toon(0x6a8aa0)); bar.position.set(px - 2.5, gy + 2.0, pz); town.add(bar)
    for (const sx of [-4.0, -1.0]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2.0, 0.13), toon(0x6a8aa0)); post.position.set(px + sx, gy + 1.0, pz); post.castShadow = true; town.add(post) }
  }

  // ── 電柱・電線（手前から奥へ一列＝強い遠近＝立体感の決め手） ──
  const poleMat = toon(0x6a5c4a)
  const transMat = toon(0x8f8f93), insMat = toon(0xcfcabf) // 柱上変圧器・碍子（共有）
  let prevTop = null
  for (let i = 0; i < 12; i++) {
    const z = 6 - i * 7
    const x = -3 + Math.sin(i * 0.5) * 0.6
    const gy = heightAt(x, z)
    const ph = 9
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, ph, 6), poleMat)
    pole.position.set(x, gy + ph / 2, z); pole.castShadow = true; town.add(pole)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.18), poleMat)
    arm.position.set(x, gy + ph - 1.0, z); town.add(arm)
    // 柱上変圧器（半分の電柱に＝街の象徴）
    if (R() < 0.5) {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.95, 10), transMat)
      tr.position.set(x + 0.55, gy + ph - 2.3, z); tr.castShadow = true; town.add(tr)
    }
    // 碍子（腕の両端の小さな白い碍子）
    for (const ex of [-1.05, 1.05]) {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 6), insMat)
      ins.position.set(x + ex, gy + ph - 0.82, z); town.add(ins)
    }
    const top = new THREE.Vector3(x, gy + ph - 0.6, z)
    if (prevTop) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, prevTop.distanceTo(top), 4), new THREE.MeshBasicMaterial({ color: 0x2a2a30, fog: true }))
      wire.position.copy(prevTop).lerp(top, 0.5)
      wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(prevTop).normalize())
      town.add(wire)
    }
    prevTop = top
  }
  } // ← 建物・ランドマーク（街のみ）ここまで

  // ── 木立（トゥーンの丸い樹冠＋幹。そよ風に揺れる） ──
  const trunkMat = toon(0x6b4a2e)
  // 季節で葉の色を替える（春=桜と新緑の混在／秋=紅葉／冬=暗い常緑／夏=緑）
  const leafMats =
    season === 'spring'
      ? [toon(0xe9b8cf), toon(0xf0c8d8), toon(0x8fb06a), toon(0xe6acc6), toon(0x7fa05c)]
      : season === 'autumn'
        ? [toon(0xc97a3a), toon(0xd89a4a), toon(0xa85a36), toon(0x8a7a3e)]
        : weather === 'snow'
          ? [toon(0x4e6048), toon(0x586a50), toon(0x44543e)]
          : [toon(0x5c7c46), toon(0x6f9050), toon(0x4f6e3e)]
  const treesArr = []
  function tree(x, z, scale) {
    const gy = heightAt(x, z)
    const g = new THREE.Group()
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 2.0, 8), trunkMat) // 幹を8角＝丸く
    tr.position.y = 1.0; g.add(tr)
    const r = 1.6 + R() * 1.4
    // 葉は分割1の丸い塊＋もう一塊を重ね、角ばりを消して自然な樹冠に（detail0の20面の角を解消）。
    const leafMat = leafMats[(R() * leafMats.length) | 0]
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMat)
    leaf.position.y = 2.0 + r * 0.7; leaf.scale.set(1.05, 0.92 + R() * 0.18, 1.05); leaf.castShadow = true; g.add(leaf)
    const leaf2 = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.72, 1), leafMat)
    leaf2.position.set((R() - 0.5) * r * 0.9, 2.0 + r * 1.25, (R() - 0.5) * r * 0.9); g.add(leaf2) // 上に小さな塊＝樹冠の膨らみ
    g.position.set(x, gy, z); g.scale.setScalar(scale); town.add(g)
    g.userData = { ph: R() * 6.28, amp: 0.02 + R() * 0.02 }
    treesArr.push(g)
  }
  if (kind === 'yato') {
    // 里山（谷の左右と奥の斜面）を木々で覆う。谷底の棚田には木を置かない。
    for (let i = 0; i < 155; i++) {
      const x = (R() - 0.5) * 150, z = -92 + R() * 120
      if (Math.abs(x) < 14 && z > -46 && z < 8) continue   // 谷底（棚田）は空ける
      tree(x, z, 0.7 + R() * 0.9)
    }
    for (const c of [[-16, 19], [17, 20], [-21, 14], [21, 16]]) tree(c[0], c[1], 1.7 + R() * 0.5) // 手前の額装木立
  } else {
    for (let i = 0; i < 140; i++) {
      const x = (R() - 0.5) * 150, z = -100 + R() * 130
      if (Math.abs(x) < 4.5 && z > -2) continue          // 手前中央の道は空ける
      tree(x, z, 0.7 + R() * 0.8)
    }
    // 手前の縁の大きな木立（窓の下辺を額装する近景＝奥行きの起点）
    for (const c of [[-12, 20], [13, 21], [-18, 16], [18, 18]]) tree(c[0], c[1], 1.7 + R() * 0.5)
  }

  // ── 谷戸の中身（棚田・茅葺の横溝屋敷・屋敷林・せせらぎ・点在する農家）。谷戸のみ。 ──
  if (kind === 'yato') {
    // 棚田: 谷底に水田と青田が並ぶ。畦道は区画の隙間で表す。
    const waterMat = mottleMat(0x7ba6c8, 36, 0.10, [1, 1]) // 水を張った田（朝空を映す水色・さざ波のムラ。白飛びを抑え水らしく）
    const riceMat = mottleMat(0x6f8a44, 54, 0.15, [2, 2])  // 青田（稲の濃淡）
    const earthMat = mottleMat(0x9c8862, 40, 0.13, [1, 1]) // 畑の土（土塊のムラ）
    for (let pz = -44; pz <= 2.5; pz += 5.6) {
      for (let px = -11; px <= 11; px += 5.6) {
        const jx = (R() - 0.5) * 0.5
        const gy = heightAt(px + jx, pz)
        const r = R()
        const w = 4.9 + R() * 0.4
        const paddy = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, w), r > 0.5 ? waterMat : (r > 0.25 ? riceMat : earthMat))
        paddy.position.set(px + jx, gy + 0.12, pz); paddy.receiveShadow = true; town.add(paddy)
      }
    }
    // 畦道（あぜ）: 棚田を仕切る細い土の畝。水田の縁取り＝棚田らしさ。区画の境界に立てる。
    const bundMat = toon(0x8a7656)
    for (let bz = -46.8; bz <= 5.5; bz += 5.6) {
      const gy = heightAt(0, bz)
      const b = new THREE.Mesh(new THREE.BoxGeometry(25, 0.5, 0.7), bundMat)
      b.position.set(0, gy + 0.3, bz); b.castShadow = true; b.receiveShadow = true; town.add(b)
    }
    for (let bx = -13.8; bx <= 13.8; bx += 5.6) {
      const gy = heightAt(bx, -21)
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 50), bundMat)
      b.position.set(bx, gy + 0.3, -21); b.castShadow = true; b.receiveShadow = true; town.add(b)
    }
    // せせらぎ（谷を縫う細い水の流れ。きらり）
    for (let i = 0; i < 26; i++) {
      const z = 2 - i * 1.9, x = Math.sin(z * 0.13 + 0.6) * 3.2 - 1.0, gy = heightAt(x, z)
      const seg = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 2.0), toon(0xbcd2dc))
      seg.position.set(x, gy + 0.18, z); town.add(seg)
    }
    // 横溝屋敷（谷の主役）: 茅葺の寄棟主屋＋長屋門。屋敷林に抱かれる。
    {
      const fx = 0, fz = -18, fgy = heightAt(fx, fz)
      const g = new THREE.Group(); g.position.set(fx, fgy, fz); g.rotation.y = -0.16; g.scale.setScalar(1.25); town.add(g) // 主役なので大きめ
      const body = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 6.5), toon(0xe9e2d2)) // 主屋（白漆喰）
      body.position.y = 1.6; body.castShadow = true; body.receiveShadow = true; g.add(body)
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(9.1, 1.0, 6.6), toon(0x5e4d3c)); skirt.position.y = 0.5; g.add(skirt) // 下見板（腰壁）
      // 茅葺の質感（縦の茅の筋）。主屋と長屋門の屋根で共有。
      const tc = document.createElement('canvas'); tc.width = tc.height = 64
      const tcx = tc.getContext('2d'); const tb = new THREE.Color(0x6a5a3c)
      tcx.fillStyle = '#' + tb.getHexString(); tcx.fillRect(0, 0, 64, 64)
      for (let i = 0; i < 80; i++) { const col = tb.clone().offsetHSL((R() - 0.5) * 0.02, (R() - 0.5) * 0.05, (R() - 0.5) * 0.2); tcx.strokeStyle = '#' + col.getHexString(); tcx.lineWidth = 0.6 + R() * 1.2; tcx.globalAlpha = 0.5; const lx = R() * 64; tcx.beginPath(); tcx.moveTo(lx, 0); tcx.lineTo(lx + (R() - 0.5) * 5, 64); tcx.stroke() }
      tcx.globalAlpha = 1
      const thatchTex = new THREE.CanvasTexture(tc); thatchTex.wrapS = thatchTex.wrapT = THREE.RepeatWrapping; thatchTex.repeat.set(3, 1)
      const thatchMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: thatchTex })
      const roof = new THREE.Mesh(new THREE.ConeGeometry(7.8, 5.2, 4), thatchMat) // 茅葺の寄棟（縦の茅の筋）
      roof.rotation.y = Math.PI / 4; roof.position.y = 5.8; roof.scale.set(1.0, 1.0, 0.7); roof.castShadow = true; g.add(roof)
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.6, 0.8), toon(0x4e4534)); ridge.position.y = 8.2; g.add(ridge) // 棟
      const gateBody = new THREE.Mesh(new THREE.BoxGeometry(7, 2.2, 2.2), toon(0xddd4c4)) // 長屋門
      gateBody.position.set(0, 1.1, 5.8); gateBody.castShadow = true; g.add(gateBody)
      const gateRoof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.4, 4), thatchMat)
      gateRoof.rotation.y = Math.PI / 4; gateRoof.position.set(0, 3.0, 5.8); gateRoof.scale.set(1.8, 1.0, 0.6); gateRoof.castShadow = true; g.add(gateRoof)
      const gateOpen = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.7, 0.3), toon(0x241f18)); gateOpen.position.set(0, 0.95, 6.95); g.add(gateOpen) // 門の通り口（陰）
    }
    // 屋敷林（屋敷を抱く高木の木立）
    for (const c of [[-5, -20], [6, -19], [-4, -27], [7, -26], [0, -29.5], [-7, -24]]) tree(c[0], c[1], 1.4 + R() * 0.6)
    // 谷の斜面に点在する瓦屋根の農家（数軒）
    const farmRoof = [toon(0x6a6258), toon(0x7a5e50), toon(0x5e6a5c)]
    for (const c of [[-19, -8, 0.9], [20, -14, 1.0], [-22, -24, 1.1], [23, -30, 1.0], [-17, -36, 0.9]]) {
      const gy = heightAt(c[0], c[1])
      const fg = new THREE.Group(); fg.position.set(c[0], gy, c[1]); fg.scale.setScalar(c[2]); fg.rotation.y = (R() - 0.5) * 0.8; town.add(fg)
      const fb = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 3.4), toon(0xd8cfbf)); fb.position.y = 1.2; fb.castShadow = true; fg.add(fb)
      const fr = new THREE.Mesh(new THREE.ConeGeometry(3.0, 1.8, 4), farmRoof[(R() * 3) | 0]); fr.rotation.y = Math.PI / 4; fr.position.y = 3.1; fr.scale.set(1.0, 1.0, 0.85); fr.castShadow = true; fg.add(fr)
    }
  }

  // ── 祝賀のアドバルーン（赤い気球＋下がる細い垂れ幕＋係留索）。小ぶりで本物らしく。街のみ。 ──
  if (kind !== 'yato') {
    const x = 13, z = -16, gy = heightAt(x, z)
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(1.7, 16, 12), toon(0xb84a3e))
    balloon.position.set(x, gy + 19, z); town.add(balloon); adBalloons.push(balloon)
    const banner = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.5, 0.1), toon(0xf2ede2))
    banner.position.set(x, gy + 15.5, z); town.add(banner); adBalloons.push(banner)
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 13, 4), new THREE.MeshBasicMaterial({ color: 0x666666, fog: true }))
    rope.position.set(x, gy + 12, z); town.add(rope)
  }

  // ── 遠くの遊園地の観覧車（谷の向こうに小さく見える郷愁のランドマーク。ゆっくり回る）。街のみ。 ──
  if (kind !== 'yato') {
    const fx = -26, fz = -66, gy = heightAt(fx, fz)
    const grp = new THREE.Group()
    grp.position.set(fx, gy, fz)
    grp.rotation.y = 0.2 // ほんの少し斜め（正面すぎない佇まい）
    town.add(grp)
    const R0 = 12, hubY = 16
    const steelMat = toon(0xb0b6bc)
    // 支柱（左右のA字脚＝ハブへ集まる）
    for (const sx of [-1, 1]) {
      for (const dz of [-3.4, 3.4]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, hubY + 1, 6), steelMat)
        leg.position.set(sx * 3.0, (hubY) / 2, dz)
        leg.rotation.z = sx > 0 ? 0.34 : -0.34
        grp.add(leg)
      }
    }
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 7.6, 8), steelMat)
    axle.rotation.x = Math.PI / 2; axle.position.y = hubY; grp.add(axle)
    // 回る車輪（XY平面・Z軸回り）。二重リング＋スポーク＋ゴンドラ。
    const wheel = new THREE.Group()
    wheel.position.set(0, hubY, 0); grp.add(wheel)
    for (const rr of [R0, R0 - 0.7]) wheel.add(new THREE.Mesh(new THREE.TorusGeometry(rr, 0.17, 6, 44), steelMat))
    const N = 12
    const gondMats = [toon(0xcf5a4e), toon(0xe6cf7a), toon(0x5a86b0), toon(0xe8e2d6), toon(0x6fae8f), toon(0xd98f5a)]
    const litMat = new THREE.MeshBasicMaterial({ color: 0xfff0c8, fog: true }) // 夕/夜のゴンドラの灯り
    const gondolas = []
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, R0, 4), steelMat)
      spoke.position.set(Math.cos(a) * R0 / 2, Math.sin(a) * R0 / 2, 0)
      spoke.rotation.z = a - Math.PI / 2; wheel.add(spoke)
      const gond = new THREE.Group()
      gond.position.set(Math.cos(a) * (R0 + 0.9), Math.sin(a) * (R0 + 0.9), 0)
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 1.6), gondMats[i % gondMats.length]); gond.add(cab)
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 1.8), gondMats[(i + 2) % gondMats.length]); roof.position.y = 0.85; gond.add(roof)
      if (duskAmt > 0.25) { const lit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.05), litMat); lit.position.z = 0.83; gond.add(lit) }
      wheel.add(gond); gondolas.push(gond)
    }
    ferris = { wheel, gondolas }
  }

  // ── 遠景の低ポリ山（街の奥に重なる尾根。空気遠近で淡く青み＝奥行きの錨） ──
  // 常に作り mtns に保持（実写背景が読めたら上のコールバックで消す＝画像が無ければ山が残る）。
  const mtnNear = skyHorizon.clone().lerp(new THREE.Color(0x6e7e62), 0.7)
  const mtnFar = skyHorizon.clone().lerp(new THREE.Color(0x8a98a6), 0.5)
  for (let layer = 0; layer < 2; layer++) {
    const dist = layer === 0 ? 150 : 210
    const baseY = layer === 0 ? 4 : 10
    for (let i = 0; i < 9; i++) {
      const ang = (i / 8 - 0.5) * Math.PI * 1.1
      const x = Math.sin(ang) * dist + (R() - 0.5) * 30
      const z = -Math.cos(ang) * dist - 30
      const m = new THREE.Mesh(new THREE.ConeGeometry(42 + R() * 28, 34 + R() * 28, 7), toon((layer === 0 ? mtnNear : mtnFar).getHex()))
      m.position.set(x, baseY, z); m.rotation.y = R() * 6
      scene.add(m); mtns.push(m)
    }
  }

  // ── ふわふわの雲（白い球の塊＝立体的な積雲） ──
  const clouds = []
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xfbfaf6, fog: false })
  for (let i = 0; i < 11; i++) {
    const g = new THREE.Group()
    const n = 4 + ((R() * 4) | 0)
    for (let j = 0; j < n; j++) {
      const s = 5 + R() * 6
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), cloudMat)
      puff.position.set((R() - 0.5) * 18, (R() - 0.5) * 3, (R() - 0.5) * 9)
      puff.scale.y = 0.66
      g.add(puff)
    }
    g.position.set((R() - 0.5) * 240, 34 + R() * 20, -55 - R() * 80)
    scene.add(g); clouds.push(g)
  }

  // ── 渡る鳥（はばたきながら空を弧で渡る。数羽） ──
  const birds = []
  const birdMat = new THREE.MeshBasicMaterial({ color: isNight ? 0x223044 : 0x3a3a40, fog: true })
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Group()
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.4), birdMat)
      wing.position.x = s * 0.6; b.add(wing); wing.userData.side = s
    }
    b.userData = { cx: (R() - 0.5) * 40, cz: -40 - R() * 40, rad: 18 + R() * 16, yy: 30 + R() * 14, sp: 0.12 + R() * 0.08, ph: R() * 6.28 }
    scene.add(b); birds.push(b)
  }

  // ── 走る車・歩く住民（中央の通りを行き交う）。街のみ（谷戸では作らない）。 ──
  if (kind !== 'yato') {
  const carCols = [0xb0564a, 0xe8e2d4, 0x3a5a7a, 0x9a9488, 0x4a6a4a, 0xc8b84a]
  cars = []
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 3.4), toon(carCols[i % carCols.length]))
    body.position.y = 0.55; body.castShadow = true; g.add(body)
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 1.7), toon(0x26323e)); cab.position.set(0, 1.05, -0.1); g.add(cab)
    const dir = (i % 2 === 0) ? 1 : -1
    if (duskAmt > 0.2) { // ライト
      const lc = dir > 0 ? 0xfff0c0 : 0xff5a3a
      const light = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: lc, fog: true }))
      light.position.set(0, 0.5, dir > 0 ? -1.7 : 1.7); g.add(light)
    }
    g.userData = { dir, lane: dir > 0 ? -1.5 : 1.5, speed: 7 + R() * 5, z: -90 + R() * 110 }
    town.add(g); cars.push(g)
  }

  // ── 歩く住民（歩道を行き交う小さな人影） ──
  const peepCols = [0x5a78a0, 0xc06a6a, 0x6a8a5a, 0xb0a060, 0x8a6aa0, 0xd0d0c8]
  peeps = []
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.7, 3, 6), toon(peepCols[i % peepCols.length]))
    body.position.y = 0.7; body.castShadow = true; g.add(body)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), toon(0xf0c49c)); head.position.y = 1.35; g.add(head)
    const dir = (i % 2 === 0) ? 1 : -1
    g.userData = { dir, x: (dir > 0 ? -3.0 : 3.0) + (R() - 0.5), speed: 1.1 + R() * 0.8, z: -85 + R() * 105, ph: R() * 6.28 }
    town.add(g); peeps.push(g)
  }
  } // ← 車・住民（街のみ）ここまで

  // ── 降るもの（雪／桜の花びら）。季節・天気で空に舞う粒子。 ──
  let weatherPts = null
  if (weather === 'snow' || weather === 'petals' || weather === 'leaves') {
    const N = weather === 'snow' ? 700 : weather === 'petals' ? 420 : 360
    const baseSpd = weather === 'snow' ? 4 : weather === 'petals' ? 2.4 : 2.0
    const pos = new Float32Array(N * 3)
    const spd = new Float32Array(N) // 個別の落下速度
    const phs = new Float32Array(N) // 横揺れ位相
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (R() - 0.5) * 200
      pos[i * 3 + 1] = R() * 80
      pos[i * 3 + 2] = -120 + R() * 170
      spd[i] = baseSpd * (0.6 + R() * 0.8)
      phs[i] = R() * 6.28
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({
      color: weather === 'snow' ? 0xfdfdff : weather === 'petals' ? 0xf2bcd0 : 0xcf7e38, // 落ち葉=暖色の橙
      size: weather === 'snow' ? 0.5 : weather === 'petals' ? 0.85 : 0.95,
      transparent: true, opacity: weather === 'snow' ? 0.92 : 0.85,
      sizeAttenuation: true, fog: true, depthWrite: false,
    })
    const pts = new THREE.Points(geo, mat)
    pts.frustumCulled = false
    scene.add(pts)
    // 落ち葉・花びらは大きく舞う（横揺れを強く）。雪はまっすぐ静かに落ちる。
    weatherPts = { pts, pos, spd, phs, N, swirl: weather === 'snow' ? 0.9 : weather === 'petals' ? 2.6 : 3.0 }
  }

  // ── カメラ（高台のマンション上階の窓から見下ろす）。谷戸は少し低く寄せて谷を見渡す ──
  const camera = new THREE.PerspectiveCamera(62, W / H, 0.5, 600)
  const eye = kind === 'yato'
    ? new THREE.Vector3(0, 28, 27)  // 谷戸: 少し低く・谷へ寄る（棚田と茅葺屋敷が映える）
    : new THREE.Vector3(0, 31, 30)  // 街: 高台の上階から見下ろす
  active = {
    renderer, scene, camera, stage, raf: 0,
    yaw: 0, pitch: 0, yawTarget: 0, pitchTarget: 0,
    winOpen: 0, winOpenTarget: 0, // 窓をあける（ガラスが横にすべって外気が澄む）
    lean: 0, leanTarget: 0,        // 身を乗り出す（枠を越えて前へ＝視界が広がる）
    fovCur: 62,
    dispose() {
      // シーングラフ全体の geometry/material/texture を解放（連打切替でのGPUメモリ蓄積＝コンテキストロストを防ぐ）
      try {
        scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose()
          const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : [])
          for (const m of mats) {
            if (!m) continue
            if (m.map && m.map !== winMapBase) m.map.dispose() // 建物ごとの窓テクスチャのクローンを解放
            if (m.emissiveMap) m.emissiveMap.dispose()
            m.dispose()
          }
        })
        winMapBase.dispose()
        for (const e of winEmis) e.dispose()
      } catch (e) { /* 無視 */ }
      try { renderer.forceContextLoss() } catch (e) { /* 無視 */ } // GPUコンテキストを即解放＝連打切替でのコンテキスト蓄積/ロストを防ぐ
      renderer.dispose()
    },
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)

  const clock = new THREE.Clock()
  let lastT = 0
  let lastDraw = -1

  // ── 窓枠のHTMLオーバーレイ（最前景のサッシ＋横桟＋窓台＋ガラスの映り込み＋紙目）──
  // frame() から参照するので先に生成する。あける／乗り出すで毎フレーム動かす。
  // 大気のトーン（空のほのかな光のにじみ＋周辺減光）＝シネマ調の奥行きで低ポリを格上げ。
  const atmo = document.createElement('div')
  atmo.className = 'town3d-atmo'
  stage.appendChild(atmo)
  const paper = document.createElement('div')
  paper.className = 'town3d-paper'
  stage.appendChild(paper)
  const glass = document.createElement('div'); glass.className = 'town3d-glass'; stage.appendChild(glass)
  const cross = document.createElement('div'); cross.className = 'town3d-cross'; stage.appendChild(cross)
  const sill = document.createElement('div'); sill.className = 'town3d-sill'; stage.appendChild(sill)
  const frame2 = document.createElement('div')
  frame2.className = 'town3d-frame'
  stage.appendChild(frame2)
  let clarityCur = -1

  function frame() {
    if (!active) return
    active.raf = requestAnimationFrame(frame)
    if (document.hidden) return // 非アクティブ（タブ切替/画面ロック）時は描画も更新も止める＝発熱・電池配慮（CLAUDE.md）
    const t = clock.getElapsedTime()
    // 約30fpsへ間引く（描画と影パスを半減＝発熱を抑える）。dtはクロックから取るので動きは滑らかなまま。
    if (t - lastDraw < 0.032) return
    lastDraw = t
    const dt = Math.min(0.05, t - lastT); lastT = t
    // 車が通りを行き交う
    for (const c of cars) {
      const u = c.userData
      u.z += u.dir * u.speed * dt
      if (u.z > 22) u.z = -95
      if (u.z < -95) u.z = 22
      c.position.set(u.lane, heightAt(u.lane, u.z) + 0.1, u.z)
      c.rotation.y = u.dir > 0 ? 0 : Math.PI
    }
    // 住民が歩道を歩く（少し上下に弾む）
    for (const p of peeps) {
      const u = p.userData
      u.z += u.dir * u.speed * dt
      if (u.z > 20) u.z = -88
      if (u.z < -88) u.z = 20
      p.position.set(u.x, heightAt(u.x, u.z) + Math.abs(Math.sin(t * 5 + u.ph)) * 0.06, u.z)
      p.rotation.y = u.dir > 0 ? 0 : Math.PI
    }
    // 木がそよ風に揺れる
    for (const tr of treesArr) tr.rotation.z = Math.sin(t * 0.8 + tr.userData.ph) * tr.userData.amp
    // アドバルーンがふわり揺れる
    for (const ab of adBalloons) { ab.rotation.z = Math.sin(t * 0.6) * 0.05; ab.position.x += Math.sin(t * 0.5) * 0.002 }
    // 観覧車がゆっくり回り、ゴンドラは水平を保つ
    if (ferris) {
      ferris.wheel.rotation.z += dt * 0.12
      const wr = ferris.wheel.rotation.z
      for (const g of ferris.gondolas) g.rotation.z = -wr
    }
    // 雪／花びらが舞い降りる（横にゆらぎ、地面付近で空へ戻して循環）
    if (weatherPts) {
      const { pos, spd, phs, N, swirl } = weatherPts
      for (let i = 0; i < N; i++) {
        const k = i * 3
        pos[k + 1] -= spd[i] * dt
        pos[k] += Math.sin(t * 0.6 + phs[i]) * swirl * dt
        pos[k + 2] += Math.cos(t * 0.4 + phs[i]) * swirl * 0.4 * dt
        if (pos[k + 1] < -14) { pos[k + 1] = 66 + R() * 12; pos[k] = (R() - 0.5) * 200 }
      }
      weatherPts.pts.geometry.attributes.position.needsUpdate = true
    }
    // 鳥がはばたきながら空を渡る
    for (const b of birds) {
      const u = b.userData
      const a = t * u.sp + u.ph
      b.position.set(u.cx + Math.cos(a) * u.rad, u.yy + Math.sin(a * 0.7) * 2.0, u.cz + Math.sin(a) * u.rad)
      b.rotation.y = -a + Math.PI / 2
      const flap = Math.sin(t * 9 + u.ph) * 0.5
      b.children.forEach((w) => { w.rotation.z = w.userData.side * flap })
    }
    // 窓をあける／身を乗り出すをなめらかに追従（少しゆっくり＝動きがはっきり分かる）
    active.winOpen += (active.winOpenTarget - active.winOpen) * 0.07
    active.lean += (active.leanTarget - active.lean) * 0.06
    const wo = active.winOpen, lean = active.lean

    // 見回しを目標へ滑らかに追従（イージング＝指を離しても余韻があるヌルヌルの見回し）
    active.yaw += (active.yawTarget - active.yaw) * 0.16
    active.pitch += (active.pitchTarget - active.pitch) * 0.16
    // 見回し（息づかいの微揺れ付き）
    const yaw = active.yaw + Math.sin(t * 0.2) * 0.012
    const pitch = active.pitch
    // 乗り出すとカメラを前へ・下へ寄せ、画角を広げる（枠を越えて街へ顔を出す立体感）
    const ex = 0
    const ey = eye.y - lean * 4.5
    const ez = eye.z - lean * 9.0
    camera.position.set(ex, ey, ez)
    const fov = 62 + lean * 7
    if (Math.abs(fov - active.fovCur) > 0.04) { active.fovCur = fov; camera.fov = fov; camera.updateProjectionMatrix() }
    const look = new THREE.Vector3(
      ex + Math.sin(yaw) * 18,
      ey - 12 - lean * 4 + pitch * 14 + Math.sin(t * 0.5) * 0.05, // 乗り出すほど街を見下ろす
      ez - Math.cos(yaw) * 22,
    )
    camera.lookAt(look)

    // 窓ガラスと横桟は、あけると横へすべって消える（引き違い窓）。乗り出すと枠ごと外へ退く。
    glass.style.transform = `translateX(${(wo * 96).toFixed(1)}%) scale(${(1 + lean * 0.5).toFixed(3)})`
    glass.style.opacity = ((1 - wo * 0.92) * (1 - lean)).toFixed(3)
    cross.style.transform = `translateX(${(wo * 96).toFixed(1)}%)`
    cross.style.opacity = ((1 - wo) * (1 - lean)).toFixed(3)
    // サッシ・窓台は乗り出すと拡大しながら退いて外気だけに（枠を通り抜ける手応え）
    frame2.style.transform = `scale(${(1 + lean * 0.55).toFixed(3)})`
    frame2.style.opacity = (1 - lean * 0.96).toFixed(3)
    sill.style.transform = `translateY(${(lean * 130).toFixed(1)}%)`
    sill.style.opacity = (1 - lean * 0.9).toFixed(3)
    paper.style.opacity = (0.14 * (1 - lean * 0.6)).toFixed(3)
    // ガラス越しのくすみを、あけ／乗り出しに応じて晴らす（外気が澄む）。変化時だけ書き換え。
    const clarity = Math.min(1, wo * 0.6 + lean * 0.7)
    if (Math.abs(clarity - clarityCur) > 0.004) {
      clarityCur = clarity
      stage.style.filter =
        `saturate(${lerp(0.78, 0.95, clarity).toFixed(3)}) sepia(${lerp(0.06, 0.02, clarity).toFixed(3)}) ` +
        `brightness(${lerp(1.02, 1.06, clarity).toFixed(3)}) contrast(0.98)`
    }

    // 雲がゆっくり流れる
    for (const c of clouds) { c.position.x += 0.01; if (c.position.x > 130) c.position.x = -130 }
    renderer.render(scene, camera)
  }
  renderer.shadowMap.needsUpdate = true // 影を最初の描画で一度だけ焼く（以降は静的）
  frame()
  requestAnimationFrame(() => stage.classList.add('town3d-stage--in'))

  // 検証用: 見回しを外から設定（?dev=1 のサムネ/撮影で角度を指定）
  if (/[?&]dev=1/.test(location.search)) {
    window.__town3dSetView = (y, p) => { if (active) { active.yaw = active.yawTarget = y || 0; active.pitch = active.pitchTarget = p || 0 } }
  }

  // スワイプで見回す（自前のポインタ操作）。
  let dragging = false, lx = 0, ly = 0
  const dom = renderer.domElement
  const onDown = (e) => { dragging = true; lx = e.clientX; ly = e.clientY }
  const onMove = (e) => {
    if (!dragging || !active) return
    const w = stage.clientWidth || 1, h = stage.clientHeight || 1
    applyTown3dLook((e.clientX - lx) / w * -1.0, (e.clientY - ly) / h * 1.0)
    lx = e.clientX; ly = e.clientY
  }
  const onUp = () => { dragging = false }
  dom.addEventListener('pointerdown', onDown)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  // dispose に後始末を足す
  const baseDispose = active.dispose
  active.dispose = () => {
    dom.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('resize', resize)
    baseDispose()
  }
}
