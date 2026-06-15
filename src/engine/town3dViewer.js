// 本物の3Dで「窓から見下ろす坂の街」を描くビューア（Three.js・低ポリ＋トゥーン）。
// フラグメントの平面画でなく、実体のある建物・電柱・木・雲・アドバルーンを立体配置し、
// スワイプで見回す。窓辺シリーズの“立体的に覗き込む”手応えを本物の3Dで出す。
// 連打切替に耐えるよう世代トークンで mount をキャンセル可能にする。

let token = 0
let active = null // { renderer, scene, camera, raf, dispose, stage }

const lerp = (a, b, t) => a + (b - a) * t

// トゥーンの段階を作る勾配テクスチャ（3段）。やわらかいセル影。
function makeGradient(THREE) {
  const data = new Uint8Array([190, 206, 222, 240, 255]) // ほぼ平坦な柔らかい段階＝手描きイラスト調の陰影（硬い面を出さない）
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat)
  tex.needsUpdate = true
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
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
  active.yaw = Math.max(-yawMax, Math.min(yawMax, active.yaw + dx * 1.4))
  active.pitch = Math.max(-pitchDn, Math.min(pitchUp, active.pitch + dy * 1.0))
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
  const weather = opts.weather || null    // 'snow' | 'petals' | null（降るもの）
  const skyTop = new THREE.Color(pal.skyTop || '#7fb0d8')
  const skyHorizon = new THREE.Color(pal.horizon || '#f2dcc0')
  const sunCol = new THREE.Color(pal.sunGlow || '#ffe6c2')
  // 空気遠近の霞（遠景を空色へやわらかく溶かす＝絵画的な奥行き。手前は鮮明）。雪は濃く冷たく。
  const fogCol = weather === 'snow'
    ? skyHorizon.clone().lerp(new THREE.Color(0xeef2f6), 0.55).getHex()
    : skyHorizon.clone().lerp(skyTop, 0.5).getHex()
  scene.fog = new THREE.Fog(fogCol, weather === 'snow' ? 42 : 55, weather === 'snow' ? 180 : 215)

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

  const isNight = (skyTop.r + skyTop.g + skyTop.b) < 0.7 // 暗い palette = 夜
  // 光（やわらかなトゥーン陰影。夜は月明かりへ）
  const sun = new THREE.DirectionalLight(isNight ? 0xa8bbe4 : sunCol.getHex(), isNight ? 0.4 : 0.92)
  sun.position.set(isNight ? 24 : -30, 42, isNight ? -16 : 20)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
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

  const grad = makeGradient(THREE)
  const toon = (hex) => new THREE.MeshToonMaterial({ color: hex, gradientMap: grad })

  // 窓のテクスチャ（壁に窓の列。乗算マップ＝白地に灰の窓＋夕方に灯る暖色のemissive）。
  function makeWinTex(lit, seed) {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32
    const g = c.getContext('2d')
    g.fillStyle = lit ? '#000000' : '#ffffff'; g.fillRect(0, 0, 32, 32)
    let s = seed * 2654435761
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
    for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 3; xx++) {
      if (lit) { g.fillStyle = rnd() < 0.45 ? '#ffd089' : '#0a0a0a' }
      else { g.fillStyle = '#6f6f78' }
      g.fillRect(4 + xx * 9, 4 + yy * 7, 5.5, 4.5)
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.magFilter = THREE.NearestFilter
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

  // 谷のプロファイル: 手前(z>0)=自分の急な丘で高い → 谷底(z≈-30)で低い → 奥(z<-55)で向かいの丘・山が上がる。
  // 坂を7割登った高台から、谷へ下って広がる街を見下ろす立体感。
  const heightAt = (x, z) => {
    let vy
    if (z > 0) vy = z * 0.38 + 1.0                               // 手前の丘の肩（カメラ側ほど高い）
    else if (z > -52) vy = z * 0.17                              // 谷へ下る斜面（街が駆け下る）
    else vy = -52 * 0.17 + (-52 - z) * 0.16                       // 向かいの丘がゆるやかに立ち上がる（空を塞がない）
    const bump = Math.sin(x * 0.06 + 1.0) * 1.5 + Math.cos(z * 0.05) * 1.7 + Math.sin((x + z) * 0.13) * 0.9
    return vy + bump
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
    const ground = new THREE.Mesh(g, toon(groundHex))
    ground.receiveShadow = true
    town.add(ground)
  }
  // 中央の通り（舗装。電柱が沿い、車・人が行き交う）。地形に沿うリボン。
  {
    const rg = new THREE.PlaneGeometry(7.5, 130, 1, 56); rg.rotateX(-Math.PI / 2)
    const rp = rg.attributes.position
    for (let i = 0; i < rp.count; i++) {
      const lx = rp.getX(i), lz = rp.getZ(i)
      rp.setY(i, heightAt(lx, lz - 35) + 0.07)
    }
    rg.computeVertexNormals()
    const road = new THREE.Mesh(rg, toon(0x474750))
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

  // ── 建物（低ポリの箱＋切妻屋根） ──
  const wallCols = [0xd8cfbf, 0xcec0af, 0xc6c0b2, 0xc2b4a4, 0xd0c2ac, 0xbcc0b6]
  const roofCols = [0x59636e, 0x7a5e50, 0x4e5660, 0x6a6258, 0x5e6a5c, 0x86766a] // くすんだ瓦（スレート青/テラコッタ/紺/灰/苔/茶）
  function house(x, z, w, d, h, type) {
    const gy = heightAt(x, z)
    const g = new THREE.Group()
    const wm = toon(wallCols[(R() * wallCols.length) | 0])
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
      // 切妻 or 寄棟の瓦屋根
      const rc = roofCols[(R() * roofCols.length) | 0]
      if (R() < 0.6) {
        const rg = new THREE.CylinderGeometry(d * 0.62, d * 0.62, w, 3, 1)
        rg.rotateZ(Math.PI / 2); rg.rotateY(Math.PI / 2)
        const roof = new THREE.Mesh(rg, toon(rc)); roof.position.y = h + d * 0.30; roof.scale.y = 0.7; roof.castShadow = true; g.add(roof)
      } else {
        const rg = new THREE.ConeGeometry(Math.max(w, d) * 0.74, d * 0.62, 4); rg.rotateY(Math.PI / 4)
        const roof = new THREE.Mesh(rg, toon(rc)); roof.position.y = h + d * 0.30; roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); roof.castShadow = true; g.add(roof)
      }
    } else if (type === 'apt') {
      // 団地・アパート：陸屋根＋前面のベランダ（手すり付き＝平成の集合住宅）
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.5, d * 1.04), toon(0x8a8478)); cap.position.y = h + 0.25; cap.castShadow = true; g.add(cap)
      const floors = Math.max(2, Math.round(h / 2.8))
      const balMat = toon(0xbcb6a8), railMat = toon(0x68686c)
      for (let f = 1; f < floors; f++) {
        const yy = f * (h / floors)
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.18, 0.85), balMat); slab.position.set(0, yy, d / 2 + 0.38); g.add(slab)
        const rail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.5, 0.1), railMat); rail.position.set(0, yy + 0.32, d / 2 + 0.78); g.add(rail)
      }
    } else { // mid: 陸屋根＋塔屋＋屋上の水タンク
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 1.03, 0.4, d * 1.03), toon(0x9a9488)); cap.position.y = h + 0.2; cap.castShadow = true; g.add(cap)
      const ph = new THREE.Mesh(new THREE.BoxGeometry(w * 0.32, 1.8, d * 0.32), toon(0x8a8478)); ph.position.set(-w * 0.2, h + 1.1, -d * 0.1); ph.castShadow = true; g.add(ph)
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(d * 0.17, d * 0.17, 1.5, 8), toon(0x6e6a64)); tank.position.set(w * 0.24, h + 1.0, d * 0.2); tank.castShadow = true; g.add(tank)
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
    const pcols = [0xd24a3a, 0xe8e2d4, 0x3a5a7a, 0x9a9488, 0x4a6a4a]
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
    const top = new THREE.Vector3(x, gy + ph - 0.6, z)
    if (prevTop) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, prevTop.distanceTo(top), 4), new THREE.MeshBasicMaterial({ color: 0x2a2a30, fog: true }))
      wire.position.copy(prevTop).lerp(top, 0.5)
      wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(prevTop).normalize())
      town.add(wire)
    }
    prevTop = top
  }

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
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 2.0, 5), trunkMat)
    tr.position.y = 1.0; g.add(tr)
    const r = 1.6 + R() * 1.4
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leafMats[(R() * leafMats.length) | 0])
    leaf.position.y = 2.0 + r * 0.7; leaf.castShadow = true; g.add(leaf)
    g.position.set(x, gy, z); g.scale.setScalar(scale); town.add(g)
    g.userData = { ph: R() * 6.28, amp: 0.02 + R() * 0.02 }
    treesArr.push(g)
  }
  for (let i = 0; i < 140; i++) {
    const x = (R() - 0.5) * 150, z = -100 + R() * 130
    if (Math.abs(x) < 4.5 && z > -2) continue          // 手前中央の道は空ける
    tree(x, z, 0.7 + R() * 0.8)
  }
  // 手前の縁の大きな木立（窓の下辺を額装する近景＝奥行きの起点）
  for (const c of [[-12, 20], [13, 21], [-18, 16], [18, 18]]) tree(c[0], c[1], 1.7 + R() * 0.5)

  // ── 祝賀のアドバルーン（赤い気球＋下がる細い垂れ幕＋係留索）。小ぶりで本物らしく。 ──
  const adBalloons = []
  {
    const x = 13, z = -16, gy = heightAt(x, z)
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(1.7, 16, 12), toon(0xcc3a30))
    balloon.position.set(x, gy + 19, z); town.add(balloon); adBalloons.push(balloon)
    const banner = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.5, 0.1), toon(0xf2ede2))
    banner.position.set(x, gy + 15.5, z); town.add(banner); adBalloons.push(banner)
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 13, 4), new THREE.MeshBasicMaterial({ color: 0x666666, fog: true }))
    rope.position.set(x, gy + 12, z); town.add(rope)
  }

  // ── 遠くの遊園地の観覧車（谷の向こうに小さく見える郷愁のランドマーク。ゆっくり回る） ──
  let ferris = null
  {
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
  const mtnNear = skyHorizon.clone().lerp(new THREE.Color(0x6e7e62), 0.7)
  const mtnFar = skyHorizon.clone().lerp(new THREE.Color(0x8a98a6), 0.5)
  for (let layer = 0; layer < 2; layer++) {
    const dist = layer === 0 ? 150 : 210
    const baseY = layer === 0 ? 4 : 10
    for (let i = 0; i < 9; i++) {
      const ang = (i / 8 - 0.5) * Math.PI * 1.1
      const x = Math.sin(ang) * dist + (R() - 0.5) * 30
      const z = -Math.cos(ang) * dist - 30
      const m = new THREE.Mesh(new THREE.ConeGeometry(42 + R() * 28, 34 + R() * 28, 5), toon((layer === 0 ? mtnNear : mtnFar).getHex()))
      m.position.set(x, baseY, z); m.rotation.y = R() * 6
      scene.add(m)
    }
  }

  // ── ふわふわの雲（白い球の塊＝立体的な積雲） ──
  const clouds = []
  const cloudMat = new THREE.MeshToonMaterial({ color: 0xfbfaf6, gradientMap: grad, fog: false })
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

  // ── 走る車（中央の通りを行き交う。夕方はヘッドライト/テールが灯る） ──
  const carCols = [0xd24a3a, 0xe8e2d4, 0x3a5a7a, 0x9a9488, 0x4a6a4a, 0xc8b84a]
  const cars = []
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
  const peeps = []
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.7, 3, 6), toon(peepCols[i % peepCols.length]))
    body.position.y = 0.7; body.castShadow = true; g.add(body)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), toon(0xf0c49c)); head.position.y = 1.35; g.add(head)
    const dir = (i % 2 === 0) ? 1 : -1
    g.userData = { dir, x: (dir > 0 ? -3.0 : 3.0) + (R() - 0.5), speed: 1.1 + R() * 0.8, z: -85 + R() * 105, ph: R() * 6.28 }
    town.add(g); peeps.push(g)
  }

  // ── 降るもの（雪／桜の花びら）。季節・天気で空に舞う粒子。 ──
  let weatherPts = null
  if (weather === 'snow' || weather === 'petals') {
    const N = weather === 'snow' ? 700 : 420
    const pos = new Float32Array(N * 3)
    const spd = new Float32Array(N) // 個別の落下速度
    const phs = new Float32Array(N) // 横揺れ位相
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (R() - 0.5) * 200
      pos[i * 3 + 1] = R() * 80
      pos[i * 3 + 2] = -120 + R() * 170
      spd[i] = (weather === 'snow' ? 4 : 2.4) * (0.6 + R() * 0.8)
      phs[i] = R() * 6.28
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({
      color: weather === 'snow' ? 0xfdfdff : 0xf2bcd0,
      size: weather === 'snow' ? 0.5 : 0.85,
      transparent: true, opacity: weather === 'snow' ? 0.92 : 0.85,
      sizeAttenuation: true, fog: true, depthWrite: false,
    })
    const pts = new THREE.Points(geo, mat)
    pts.frustumCulled = false
    scene.add(pts)
    weatherPts = { pts, pos, spd, phs, N, swirl: weather === 'petals' ? 2.6 : 0.9 }
  }

  // ── カメラ（高台のマンション上階の窓から街を見下ろす） ──
  const camera = new THREE.PerspectiveCamera(62, W / H, 0.5, 600)
  const eye = new THREE.Vector3(0, 31, 30) // 上階の窓の目線（高く・街の手前）
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
        grad.dispose()
      } catch (e) { /* 無視 */ }
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

    // 見回しをなめらかに（息づかいの微揺れ付き）
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
    window.__town3dSetView = (y, p) => { if (active) { active.yaw = y || 0; active.pitch = p || 0 } }
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
