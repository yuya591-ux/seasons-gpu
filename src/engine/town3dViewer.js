// 本物の3Dで「窓から見下ろす坂の街」を描くビューア（Three.js・低ポリ＋トゥーン）。
// フラグメントの平面画でなく、実体のある建物・電柱・木・雲・アドバルーンを立体配置し、
// スワイプで見回す。窓辺シリーズの“立体的に覗き込む”手応えを本物の3Dで出す。
// 連打切替に耐えるよう世代トークンで mount をキャンセル可能にする。

let token = 0
let active = null // { renderer, scene, camera, raf, dispose, stage }

const lerp = (a, b, t) => a + (b - a) * t

// トゥーンの段階を作る勾配テクスチャ（3段）。やわらかいセル影。
function makeGradient(THREE) {
  const data = new Uint8Array([150, 185, 220, 255]) // 影側を沈め過ぎない柔らかいトゥーン段階
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat)
  tex.needsUpdate = true
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  return tex
}

export function isTown3dActive() {
  return !!active
}

// 見回し（スワイプ）。nx,ny は累積の相対量。
export function applyTown3dLook(dx, dy) {
  if (!active) return
  active.yaw = Math.max(-0.9, Math.min(0.9, active.yaw + dx * 1.4))
  active.pitch = Math.max(-0.35, Math.min(0.5, active.pitch + dy * 1.0))
}

export function resetTown3dLook() {
  if (active) { active.yawTarget = 0; active.pitchTarget = 0 }
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
  stage.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const pal = opts.palette || {}
  const skyTop = new THREE.Color(pal.skyTop || '#7fb0d8')
  const skyHorizon = new THREE.Color(pal.horizon || '#f2dcc0')
  const sunCol = new THREE.Color(pal.sunGlow || '#ffe6c2')
  // 空気遠近の霞（遠景をやわらかく溶かす。濁らせない程度に）
  scene.fog = new THREE.Fog(skyHorizon.clone().lerp(skyTop, 0.3).getHex(), 36, 150)

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

  // 光（やわらかなトゥーン陰影）
  const sun = new THREE.DirectionalLight(sunCol.getHex(), 1.15)
  sun.position.set(-30, 40, 20)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 160
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60
  scene.add(sun)
  scene.add(new THREE.HemisphereLight(skyTop.getHex(), 0x6b5a44, 0.85))
  scene.add(new THREE.AmbientLight(0xffffff, 0.18))

  const grad = makeGradient(THREE)
  const toon = (hex) => new THREE.MeshToonMaterial({ color: hex, gradientMap: grad })
  const rng = (seed) => { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 } }
  const R = rng(7)

  const town = new THREE.Group()
  scene.add(town)

  // ── 起伏する地面（坂の街＝丘を駆け下る緑〜土の地面） ──
  {
    const g = new THREE.PlaneGeometry(260, 260, 48, 48)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      // 手前(z>0=カメラ側)が高く、奥(z<0)へ下る坂＋ゆるい起伏
      const slope = -z * 0.10
      const bump = Math.sin(x * 0.06 + 1.0) * 1.4 + Math.cos(z * 0.05) * 1.6 + Math.sin((x + z) * 0.13) * 0.8
      pos.setY(i, slope + bump)
    }
    g.computeVertexNormals()
    const ground = new THREE.Mesh(g, toon(0x86a65c))
    ground.receiveShadow = true
    town.add(ground)
  }
  const heightAt = (x, z) => -z * 0.10 + Math.sin(x * 0.06 + 1.0) * 1.4 + Math.cos(z * 0.05) * 1.6 + Math.sin((x + z) * 0.13) * 0.8

  // ── 建物（低ポリの箱＋切妻屋根） ──
  const wallCols = [0xd8cfbf, 0xcdbfae, 0xc8c2b4, 0xbfb0a0, 0xd2c0a8]
  const roofCols = [0x4a5a72, 0x6a4a3a, 0x44506a, 0x7a4a44]
  function house(x, z, w, d, h, gable) {
    const gy = heightAt(x, z)
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(wallCols[(R() * wallCols.length) | 0]))
    body.position.y = h / 2
    body.castShadow = true; body.receiveShadow = true
    g.add(body)
    if (gable) {
      // 切妻屋根（三角柱）
      const rg = new THREE.CylinderGeometry(d * 0.62, d * 0.62, w, 3, 1)
      rg.rotateZ(Math.PI / 2); rg.rotateY(Math.PI / 2)
      const roof = new THREE.Mesh(rg, toon(roofCols[(R() * roofCols.length) | 0]))
      roof.position.y = h + d * 0.30
      roof.scale.y = 0.7
      roof.castShadow = true
      g.add(roof)
    } else {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.4, d * 1.02), toon(0x9a9488))
      cap.position.y = h + 0.2; cap.castShadow = true; g.add(cap)
    }
    g.position.set(x, gy, z)
    g.rotation.y = (R() - 0.5) * 0.5
    town.add(g)
  }

  // 街区を碁盤にばらまく（奥へ広がる坂の街。手前中央は道＝視界が抜ける）
  for (let zi = -11; zi <= 2; zi++) {
    for (let xi = -8; xi <= 8; xi++) {
      if (Math.abs(xi) < 1.6 && zi > -3) continue // 手前中央は道（街を見通す抜け）
      if (R() < 0.26) continue
      const x = xi * 9 + (R() - 0.5) * 3
      const z = zi * 9 + (R() - 0.5) * 3
      const far = (zi + 11) / 13 // 0=奥 1=手前
      const w = lerp(3.2, 5.5, far) + R() * 1.4
      const d = lerp(3.2, 5.5, far) + R() * 1.4
      const h = (R() < 0.16) ? lerp(8, 16, R()) : lerp(3, 6, far) + R() * 2
      house(x, z, w, d, h, h < 7 && R() < 0.7)
    }
  }

  // ── 大きなランドマーク（大型スーパー＝平らな大箱＋看板） ──
  {
    const x = 22, z = -18, gy = heightAt(x, z)
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(20, 9, 14), toon(0xe0d8c8))
    body.position.y = 4.5; body.castShadow = true; body.receiveShadow = true; g.add(body)
    const sign = new THREE.Mesh(new THREE.BoxGeometry(16, 2.2, 0.6), toon(0xc23a2c))
    sign.position.set(0, 10, 7.1); g.add(sign)
    g.position.set(x, gy, z); g.rotation.y = -0.3; town.add(g)
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

  // ── 木立（トゥーンの丸い樹冠＋幹） ──
  const trunkMat = toon(0x6b4a2e)
  const leafMats = [toon(0x5c7c46), toon(0x6f9050), toon(0x4f6e3e)]
  for (let i = 0; i < 60; i++) {
    const x = (R() - 0.5) * 130, z = (R() - 0.5) * 120
    if (Math.abs(x) < 4 && z > -2) continue
    const gy = heightAt(x, z)
    const g = new THREE.Group()
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.0, 5), trunkMat)
    tr.position.y = 1.0; g.add(tr)
    const r = 1.6 + R() * 1.4
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leafMats[(R() * 3) | 0])
    leaf.position.y = 2.0 + r * 0.7; leaf.castShadow = true; g.add(leaf)
    g.position.set(x, gy, z); g.scale.setScalar(0.8 + R() * 0.7); town.add(g)
  }

  // ── 祝賀のアドバルーン（紅白の気球＋係留索） ──
  {
    const x = 12, z = -10, gy = heightAt(x, z)
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 12), toon(0xd83a30))
    balloon.position.set(x, gy + 22, z); balloon.castShadow = false; town.add(balloon)
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.42, 2.42, 0.8, 16, 1, true), new THREE.MeshToonMaterial({ color: 0xf4f0e8, gradientMap: grad, side: THREE.DoubleSide }))
    band.position.copy(balloon.position); town.add(band)
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 19, 4), new THREE.MeshBasicMaterial({ color: 0x555555, fog: true }))
    rope.position.set(x, gy + 11, z); town.add(rope)
  }

  // ── 遠景の低ポリ山（街を囲む丘・尾根） ──
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI - Math.PI * 0.5
    const dist = 120
    const x = Math.sin(ang) * dist, z = -Math.cos(ang) * dist - 20
    const m = new THREE.Mesh(new THREE.ConeGeometry(30 + R() * 20, 22 + R() * 18, 5), toon(0x6e7e62))
    m.position.set(x, 6, z); m.rotation.y = R() * 6
    scene.add(m)
  }

  // ── ふわふわの雲（白い球の塊＝立体的な積雲） ──
  const clouds = []
  const cloudMat = new THREE.MeshToonMaterial({ color: 0xfbfaf6, gradientMap: grad, fog: false })
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group()
    const n = 3 + ((R() * 4) | 0)
    for (let j = 0; j < n; j++) {
      const s = 4 + R() * 5
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), cloudMat)
      puff.position.set((R() - 0.5) * 14, (R() - 0.5) * 3, (R() - 0.5) * 8)
      puff.scale.y = 0.7
      g.add(puff)
    }
    g.position.set((R() - 0.5) * 220, 48 + R() * 26, -40 - R() * 120)
    scene.add(g); clouds.push(g)
  }

  // ── カメラ（高台のマンション上階の窓から街を見下ろす） ──
  const camera = new THREE.PerspectiveCamera(62, W / H, 0.5, 600)
  const eye = new THREE.Vector3(0, 31, 30) // 上階の窓の目線（高く・街の手前）
  active = {
    renderer, scene, camera, stage, raf: 0,
    yaw: 0, pitch: 0, yawTarget: 0, pitchTarget: 0,
    dispose() { renderer.dispose(); grad.dispose() },
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)

  const clock = new THREE.Clock()
  function frame() {
    if (!active) return
    active.raf = requestAnimationFrame(frame)
    const t = clock.getElapsedTime()
    // 見回しをなめらかに（息づかいの微揺れ付き）
    const yaw = active.yaw + Math.sin(t * 0.2) * 0.012
    const pitch = active.pitch
    camera.position.copy(eye)
    const look = new THREE.Vector3(
      eye.x + Math.sin(yaw) * 18,
      eye.y - 12 + pitch * 14 + Math.sin(t * 0.5) * 0.05, // 街を見下ろす角度（やや水平寄り＝街と空が映える）
      eye.z - Math.cos(yaw) * 22,
    )
    camera.lookAt(look)
    // 雲がゆっくり流れる
    for (const c of clouds) { c.position.x += 0.01; if (c.position.x > 130) c.position.x = -130 }
    renderer.render(scene, camera)
  }
  frame()

  // 窓枠（最前景のサッシ）。HTMLオーバーレイ。
  const frame2 = document.createElement('div')
  frame2.className = 'town3d-frame'
  stage.appendChild(frame2)
  requestAnimationFrame(() => stage.classList.add('town3d-stage--in'))

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
