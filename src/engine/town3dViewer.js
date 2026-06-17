// 本物の3Dで「窓から見下ろす坂の街」を描くビューア（Three.js・低ポリ＋トゥーン）。
// フラグメントの平面画でなく、実体のある建物・電柱・木・雲・アドバルーンを立体配置し、
// スワイプで見回す。窓辺シリーズの“立体的に覗き込む”手応えを本物の3Dで出す。
// 連打切替に耐えるよう世代トークンで mount をキャンセル可能にする。

let token = 0
let active = null // { renderer, scene, camera, raf, dispose, stage }

const lerp = (a, b, t) => a + (b - a) * t

// ease-in-out（smoothstep）。0→1の線形進行を、出だしも止まりもやわらかい曲線へ変換する。
// 線形やexp追従(=ease-out)と違い、動き始めと止まり際の両方がそっと加減速する＝酔わない上質なカメラ運び。
const easeInOut = (p) => p * p * (3 - 2 * p)

// 線形進行 p を、目標へ毎フレーム一定速度(step)で近づける（overshoot無しでぴったり止まる）。
// 一定速度で進めた p に easeInOut をかけることで、開く時も戻る時も両端がやわらかい往復になる。
const approach = (p, target, step) => p + Math.sign(target - p) * Math.min(step, Math.abs(target - p))

// ── 窓辺カメラ演出の微調整パラメータ（この数値だけで動きの量・速さ・角度を後から調整できる） ──
// 一人称・カメラのみの移動。控えめな移動量/画角変化で3D酔いを避けつつ「窓から顔を出す」手応えを出す。
const CAM = {
  winOpenDur: 1.15, // 窓をあける所要時間(秒)。大きいほどゆっくり開く
  leanDur: 1.5,     // 身を乗り出す／もどる所要時間(秒)
  winFwd: 1.8,      // 窓あけでカメラが前へ進む量（控えめ＝視界がふっと開ける程度）
  winDown: 0.4,     // 窓あけでカメラが下がる量
  winFov: 3.5,      // 窓あけで画角が広がる量(度)
  leanFwd: 9.0,     // 乗り出しでカメラが前へ出る量（枠を越えて街へ顔を出す）
  leanDown: 4.5,    // 乗り出しでカメラが下がる量
  leanFov: 7.0,     // 乗り出しで画角が広がる量(度)
  leanLook: 4.0,    // 乗り出しで視線が下を覗き込む量（既定の見下ろし）
  leanPitchUp: 1.10, // 乗り出し時に上を見上げられる範囲（空・ビル上層まで仰げる）。大きいほど上が見える
  leanPitchDn: 0.20, // 乗り出し時に下を見下ろせる範囲の拡張
  lookPitch: 18,    // 見上げ/見下ろしの効き（pitch→視線の縦移動量）。大きいほど少しのスワイプで大きく振れる
  fov0: 62,         // 基準画角(度)
}

// 乗り出し量(0..1)に応じた見上げ/見下ろしの可動範囲。乗り出すほど上も下も大きく振れる。
// applyTown3dLook(スワイプ時)とframeループ(戻り時の追従)の両方で使い、範囲を一元管理する。
const pitchLimits = (lean) => ({ up: 0.5 + lean * CAM.leanPitchUp, dn: 0.35 + lean * CAM.leanPitchDn })

// トゥーンの段階を作る勾配テクスチャ。陰影がはっきり出るセル（暗部まで落とし、形が読める手描き調）。
// 浅い明るい段階だと拡散と同じ＝プラスチックに見えるため、影側をしっかり暗くし明確な帯にする。
function makeGradient(THREE) {
  // やわらかな水彩調の階調（低ポリ脱却＝曲面が丸く読める）。陰→陽を5段で、Linear補間でセルの
  // 硬い境界をほぐし、曲面（樹冠・地形・人・車）を丸く見せる。輪郭線＋紙目グレードが手描きの趣は保つ。
  const data = new Uint8Array([80, 122, 164, 204, 242]) // 影0.31 / 0.48 / 0.64 / 0.80 / 陽0.95
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat)
  tex.needsUpdate = true
  tex.magFilter = THREE.LinearFilter // 面の切り替わりをやわらげ曲面を丸く（プラスチックにしない範囲で）
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
  const lim = pitchLimits(l)     // 乗り出すと上（空・ビル上層）も下も大きく見られる
  // 目標値を動かし、frame loop でイージング追従（指を離しても余韻＝ヌルヌル）。感度UP。
  active.yawTarget = Math.max(-yawMax, Math.min(yawMax, active.yawTarget + dx * 2.4))
  active.pitchTarget = Math.max(-lim.dn, Math.min(lim.up, active.pitchTarget + dy * 1.6))
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
  // 近景の建物の角を丸める面取り用（低ポリの箱の角を脱す）。近景の数棟だけに使い性能は据え置く。
  const { RoundedBoxGeometry } = await import('three/examples/jsm/geometries/RoundedBoxGeometry.js')
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
    ? skyHorizon.clone().lerp(new THREE.Color(0xeef2f6), 0.55).getHex()
    : skyHorizon.clone().lerp(skyTop, 0.52).getHex() // 空色へ溶かす空気の層（俯瞰の霞）
  // 空気遠近の霞（調整可）: near=ここから霞み始める, far=ここで空に溶ける。手前へ寄せて遠景〜中景を
  // やわらかな大気に溶かし、「高台から街を眺める」水彩調の奥行きを出す（手前は鮮明に保つ）。
  const FOG = { near: weather === 'snow' ? 32 : 36, far: weather === 'snow' ? 135 : 150 }
  scene.fog = new THREE.Fog(fogCol, FOG.near, FOG.far)

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
  // セル/アニメ調の3D街モードでは実写の写真遠景は画風が衝突し、手前の低ポリ街と「二重像」になり
  // 境界にz-fightingの点ノイズも出るため無効化（低ポリのセル遠山を遠景に使う）。実写の窓モード(photoWindow)とは別物。
  const USE_PHOTO_BACKDROP = false // ←再有効化する場合は true
  const mtns = []
  if (USE_PHOTO_BACKDROP && opts.bg3d) {
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
  // CG的な締まりを出さない線形トーン（NoToneMapping）＝フィルミックな圧縮を排し、平坦な手描き/セル調に。
  renderer.toneMapping = THREE.NoToneMapping
  renderer.toneMappingExposure = isNight ? 1.25 : 1.0
  // 光（やわらかなトゥーン陰影。夜は月明かりへ）
  const sun = new THREE.DirectionalLight(isNight ? 0xa8bbe4 : sunCol.getHex(), isNight ? 0.62 : 1.02) // 方向光を主役に＝セルの明部/影部をはっきり（線形トーン用に白飛び防止）
  sun.position.set(isNight ? 24 : -30, 42, isNight ? -16 : 20)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048) // 影は一度だけ焼く静的影なので、高精細化しても実行時コストは増えない（精度↑）
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 160
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60
  scene.add(sun)
  // 空からの回り込み光（影側を黒く沈めない＝くすみ防止）。地面側は暖色で泥にしない。
  // 回り込み光を抑えて平坦フィルを脱す（影側が残る＝セルの陰影と形が出る）。地面側は暖色。
  scene.add(new THREE.HemisphereLight(skyTop.clone().lerp(new THREE.Color(0xffffff), 0.4).getHex(), 0x9a8a6e, isNight ? 0.34 : 0.34))
  scene.add(new THREE.AmbientLight(0xfff2e0, isNight ? 0.12 : 0.10)) // 夜の近景が真っ黒に沈まない程度に底上げ
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
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: isNight ? 0.4 : (season === 'autumn' ? 0.42 : 0.55), // 秋は逆光グローを弱め上空の白飛びを抑える
    }))
    glow.position.set(0, 16, -190) // 遠い地平。手前の街に隠れて“街の向こうのにじみ”になる
    glow.scale.set(220, 120, 1)    // 横長＝地平の光の帯
    scene.add(glow)
  }

  // 軽いトゥーン（やわらかな水彩調のセル影）。プラスチックな拡散を脱し手描き調へ（3Dの街モード専用）。
  const grad = makeGradient(THREE)
  // 雪の積もり: 上を向いた面（屋根・地面・樹冠の上面）だけ白を被せる＝「雪が乗っている」表現。
  // 壁など縦面(normal.y≈0)は白くならない。weather==='snow' の全トゥーン材に共有適用。
  const SNOW = weather === 'snow'
  const snowify = (m) => {
    if (!SNOW) return m
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWNSnow;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  vWNSnow = mat3(modelMatrix) * objectNormal;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWNSnow;')
        .replace('#include <dithering_fragment>', '  float snowK = smoothstep(0.30, 0.72, normalize(vWNSnow).y);\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.93, 0.95, 0.985), snowK * 0.82);\n#include <dithering_fragment>')
    }
    m.customProgramCacheKey = () => 'snowcap'
    return m
  }
  const toon = (hex) => snowify(new THREE.MeshToonMaterial({ color: hex, gradientMap: grad }))
  // 手描き調の輪郭線（反転ハル）。背面を黒で少し大きく描き、シルエットに線を出す。共有・軽量・霞で遠景は淡く。
  // OUTLINE=線の太さ（後から調整可）。fog:true で遠景の線も空気遠近で淡くなる。
  const OUTLINE = 1.022 // 線の太さ（背面ハルの拡大率。太いと箱の角で剥離して浮くため細めに。調整可）
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x16120b, side: THREE.BackSide, fog: true })
  function addOutline(mesh) {
    const o = new THREE.Mesh(mesh.geometry, outlineMat)
    o.position.copy(mesh.position); o.rotation.copy(mesh.rotation)
    o.scale.copy(mesh.scale).multiplyScalar(OUTLINE) // 中心から一様にふくらませて背面を出す＝シルエットの線
    o.castShadow = false; o.receiveShadow = false; o.renderOrder = -1
    return o
  }

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
      const px = 8 + xx * 18, py = 7 + yy * 14, pw = 11, ph = 9
      if (lit) {
        g.fillStyle = rnd() < 0.45 ? '#ffd089' : '#0a0a0a'
        g.fillRect(px, py, pw, ph)
      } else {
        // ガラス：上ほど空を映してやや明るく→下ほど室内で翳る縦グラデ＝ベタ灰の板でなく「硝子」。
        // 窓ごとに寒暖を振る（空映りの寒色／障子・カーテンの暖色）＝のっぺり一様を脱し生活感。
        const cool = rnd() < 0.5
        const grad = g.createLinearGradient(0, py, 0, py + ph)
        if (cool) { grad.addColorStop(0, '#8e9aa8'); grad.addColorStop(1, '#5c606a') }
        else { grad.addColorStop(0, '#827e7a'); grad.addColorStop(1, '#5a5652') }
        g.fillStyle = grad
        g.fillRect(px, py, pw, ph)
        // 中桟（上げ下げ窓の横さん）＝ガラスが2枚に割れて見える立体
        g.fillStyle = 'rgba(150,150,158,0.45)'
        g.fillRect(px, py + ph * 0.5 - 0.5, pw, 1)
      }
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
      else if (z > -46) base = -1.6 - Math.floor((4 - z) / 5.6) * 0.42 + Math.sin(z * 0.08) * 0.1 // 谷底＝手前から奥へ段々に下る棚田（5.6mごとに一段）
      else base = -4.96 + (-46 - z) * 0.42                        // 奥の向かいの斜面が立ち上がる（段々の終端から連続）
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
    const m = new THREE.MeshToonMaterial({ color: 0xffffff, map: makeMottle(baseHex, n, spread), gradientMap: grad })
    m.map.repeat.set(rep[0], rep[1])
    return snowify(m)
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
    // 横の通り（数本）。アスファルトのムラ材を共有＝ベタ灰の平面を脱す（俯瞰で映える路面の質感）。
    const crossMat = mottleMat(0x474750, 80, 0.12, [6, 2])
    for (const cz of [-6, -28, -50]) {
      const cg = new THREE.PlaneGeometry(120, 6, 48, 1); cg.rotateX(-Math.PI / 2)
      const cp = cg.attributes.position
      for (let i = 0; i < cp.count; i++) { const lx = cp.getX(i), lz = cp.getZ(i); cp.setY(i, heightAt(lx, lz + cz) + 0.06) }
      cg.computeVertexNormals()
      const cr = new THREE.Mesh(cg, crossMat); cr.position.z = cz; cr.receiveShadow = true; town.add(cr)
    }
    // 横断歩道（手前の交差点に白い縞＝近景の路面標示・生活感。路面のすぐ上に薄板で）
    const cwMat = new THREE.MeshLambertMaterial({ color: 0xc8c4ba })
    for (let i = 0; i < 5; i++) {
      const bz = -3.4 - i * 0.62
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.03, 0.34), cwMat)
      stripe.position.set(0, heightAt(0, bz) + 0.085, bz); town.add(stripe)
    }
    // マンホール（路面の轍に沿って点々と＝近景の生活痕。鉄蓋の濃灰）
    const mhMat = toon(0x47474c)
    for (const [mx, mz] of [[-1.4, 3], [1.5, -9], [-1.6, -23], [1.3, -37], [-1.4, -51], [1.5, -67]]) {
      const mh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 14), mhMat)
      mh.position.set(mx, heightAt(mx, mz) + 0.06, mz); town.add(mh)
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
  // 屋上に干す布団の色（くすんだ生活色・上から見下ろす窓に映える彩り）。共有マテリアルで描画数を抑える。
  const futonMats = [0x9fb0c4, 0xc9a6b0, 0xc4bca0, 0xd8c8a0, 0xb0b8a8, 0xd0cabc].map(toon)
  // 屋上のささやかな緑（プランター菜園・鉢＝俯瞰で映える生活の緑）。共有マテリアル。
  const gardenMats = [0x6a8a4a, 0x7e9850, 0x5c7c42].map(toon)
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
    // 屋上に布団を干す（平らな色面＝窓から見下ろすと映える生活の彩り。昭和平成の風物詩）。晴天の昼夕のみ・雪は除く。
    if (!SNOW && R() < 0.5) {
      const nf = 1 + ((R() * 3) | 0)
      for (let i = 0; i < nf; i++) {
        const fw = w * 0.26 + R() * w * 0.16, fd = d * 0.34 + R() * d * 0.12
        const fut = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.09, fd), futonMats[(R() * futonMats.length) | 0])
        fut.position.set((R() - 0.5) * w * 0.5, h + 0.07, (R() - 0.5) * d * 0.45); fut.castShadow = true; g.add(fut)
      }
    }
    // 屋上のささやかな菜園（プランターの緑が点々＝俯瞰で映える生活の緑）。雪は除く・一部の屋上に。
    if (!SNOW && R() < 0.24) {
      const gm = gardenMats[(R() * gardenMats.length) | 0]
      const ng = 2 + ((R() * 2) | 0)
      const bx = (R() - 0.5) * w * 0.4, bz = (R() - 0.5) * d * 0.4 // 一角にまとめて並べる
      for (let i = 0; i < ng; i++) {
        const pl = new THREE.Mesh(new THREE.BoxGeometry(0.5 + R() * 0.28, 0.17, 0.32), gm)
        pl.position.set(bx + (R() - 0.5) * 0.5, h + 0.1, bz + i * 0.42 - 0.2); pl.castShadow = true; g.add(pl)
      }
    }
  }
  // 壁面の縦グラデを頂点色で（足元=接地のAOで翳り→上=空の光で明るい）。平らな箱面の一様さを破り、
  // 接地感と大気の奥行きを足して「低ポリの箱」感を脱す。頂点色なので描画コストは増えない。
  function wallAO(geo, hh) {
    const pos = geo.attributes.position
    const col = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.max(0, (pos.getY(i) + hh / 2) / Math.max(0.001, hh))) // 0=底 1=上
      const ao = Math.min(1, t / 0.26)                 // 下26%で接地の翳り
      const v = 0.72 + 0.28 * ao + 0.06 * t            // 底0.72→中1.0→上1.06(空の光)
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  }
  function house(x, z, w, d, h, type) {
    const gy = heightAt(x, z)
    const g = new THREE.Group()
    const wm = toon(wallCols[(R() * wallCols.length) | 0]) // 壁は軽量な拡散材（多数あるため性能優先）
    wm.vertexColors = true // 壁面の縦グラデ（接地AO＋空の光）を頂点色で乗せる
    const rep = Math.max(1, Math.round(w / 2.6)), repV = Math.max(1, Math.round(h / 2.4))
    const m = winMapBase.clone(); m.repeat.set(rep, repV); m.needsUpdate = true
    wm.map = m
    if (duskAmt > 0.12) { // 夕方は窓が灯る
      const e = winEmis[(R() * winEmis.length) | 0].clone(); e.repeat.set(rep, repV); e.needsUpdate = true
      wm.emissiveMap = e; wm.emissive = new THREE.Color(0xffcaa0); wm.emissiveIntensity = 0.32 + duskAmt * 0.6 // 発光を抑え主従を付ける（夜の電飾貼り絵感を解消）
    }
    // 近景の建物だけ角を面取りして「低ポリの箱」の鋭い角を脱す（奥は霞むので箱のまま＝軽量）。
    const near = z > -12
    const bodyGeo = near
      ? new RoundedBoxGeometry(w, h, d, 1, Math.min(0.2, Math.min(w, d) * 0.09))
      : new THREE.BoxGeometry(w, h, d)
    wallAO(bodyGeo, h) // 壁の足元を翳らせ上を明るく＝接地と大気の縦グラデ
    const body = new THREE.Mesh(bodyGeo, wm)
    body.position.y = h / 2
    body.castShadow = true; body.receiveShadow = true
    g.add(body)
    if (h > 4.6 || type !== 'house') g.add(addOutline(body)) // 大きめの建物のみ輪郭（性能配慮・小さな家は省く）
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
      // 太陽熱温水器（昭和の屋根の象徴。一部の家に＝平たい集熱パネル＋横長の貯湯タンク。屋根に傾けて乗せる）
      if (R() < 0.28) {
        const sg = new THREE.Group(); sg.position.set((R() - 0.5) * w * 0.28, h + d * 0.3, (R() - 0.5) * d * 0.15); sg.rotation.x = -0.5
        sg.add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.08, d * 0.42), toon(0x2a3848))) // 集熱パネル(濃紺)
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, w * 0.48, 8), toon(0xc8c4ba)); tank.rotation.z = Math.PI / 2; tank.position.set(0, 0.22, -d * 0.18); sg.add(tank) // 貯湯タンク
        g.add(sg)
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
      const futCols = [0x9fb0c4, 0xc9a6b0, 0xc4bca0, 0xb0b8a8, 0xd8c8a0] // 布団・洗濯物のくすんだ色
      for (let f = 1; f < floors; f++) {
        const yy = f * (h / floors)
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.18, 0.85), balMat); slab.position.set(0, yy, d / 2 + 0.38); g.add(slab)
        const rail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.5, 0.1), railMat); rail.position.set(0, yy + 0.32, d / 2 + 0.78); g.add(rail)
        // 手すりに布団／洗濯物を干す（時々）＝平成の集合住宅の生活感・ほのかな彩り
        if (R() < 0.4) {
          const fw = w * 0.28 + R() * w * 0.32
          const fut = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.66, 0.12), toon(futCols[(R() * futCols.length) | 0]))
          fut.position.set((R() - 0.5) * (w * 0.55), yy + 0.12, d / 2 + 0.85); g.add(fut)
        }
      }
    } else { // mid: 陸屋根＋屋上設備（塔屋・水タンク・室外機・アンテナ）
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 1.03, 0.4, d * 1.03), toon(0x9a9488)); cap.position.y = h + 0.2; cap.castShadow = true; g.add(cap)
      addRoofClutter(g, w, d, h + 0.4)
    }
    // 1階を店舗に（時々・中層/集合住宅）＝混在用途のにぎわい。庇＋店先のくすんだ色帯
    if ((type === 'mid' || type === 'apt') && h > 6 && R() < 0.34) {
      const sh = 1.9
      const shop = new THREE.Mesh(new THREE.BoxGeometry(w * 1.012, sh, d * 1.012), toon([0xb8a890, 0xa89878, 0xc2b2a0, 0xa8a0a8][(R() * 4) | 0]))
      shop.position.y = sh / 2 + 0.02; g.add(shop)
      const awn = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, 0.12, 0.72), toon([0xb0604a, 0x5e7a5e, 0x4a6a8a, 0xb09a58][(R() * 4) | 0]))
      awn.position.set(0, sh, d / 2 + 0.36); awn.castShadow = true; g.add(awn)
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
      const car = new THREE.Mesh(new RoundedBoxGeometry(1.7, 1.0, 3.4, 2, 0.26), toon(carCols[(R() * carCols.length) | 0])) // 面取りで丸みのある車体
      car.position.set(cx, cy + 0.55, cz); car.rotation.y = side > 0 ? 0.05 : -0.05; car.castShadow = true; town.add(car)
      const cab = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.7, 1.7, 2, 0.2), toon(0x2a2e34))
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
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x2a2a30, fog: true }) // 電線（共有・軽量）
  // スズメ（夕暮れの電線に集まる小鳥）の共有部材＝体・尾・頭。近い数スパンに数羽だけ＝郷愁の決め手。
  const sparrowMat = toon(0x554a3c), sparrowBody = new THREE.SphereGeometry(0.1, 6, 5), sparrowTail = new THREE.BoxGeometry(0.045, 0.03, 0.17)
  let prevAnchors = null
  for (let i = 0; i < 12; i++) {
    const z = 6 - i * 7
    const x = -3 + Math.sin(i * 0.5) * 0.6
    const gy = heightAt(x, z)
    const ph = 9
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, ph, 12), poleMat) // 近景の縦線＝丸く（低ポリの六角柱を脱す）
    pole.position.set(x, gy + ph / 2, z); pole.castShadow = true; town.add(pole)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.18), poleMat)
    arm.position.set(x, gy + ph - 1.0, z); town.add(arm)
    // 街灯（夜のみ・一部の電柱に）。暖色の灯り＋足元の淡い光だまりで、近景の坂を照らし暗黒を救う。
    if (isNight && i % 2 === 0) {
      const lampX = x + 0.9
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd79a, fog: true }))
      lamp.position.set(lampX, gy + ph - 1.6, z); town.add(lamp)
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffcf8a, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))
      glow.position.copy(lamp.position); town.add(glow)
      const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 16), new THREE.MeshBasicMaterial({ color: 0xffcc88, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }))
      pool.rotation.x = -Math.PI / 2; pool.position.set(lampX, gy + 0.12, z); town.add(pool) // 路面の光だまり
    }
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
    // 支線（電柱を支える斜めのワイヤー＝日本の電柱の細部。一部の柱に）
    if (R() < 0.4) {
      const ax = x + (R() < 0.5 ? 2.3 : -2.3)
      const topG = new THREE.Vector3(x, gy + ph - 1.4, z), anc = new THREE.Vector3(ax, gy + 0.1, z + 0.3)
      const guy = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, topG.distanceTo(anc), 4), wireMat)
      guy.position.copy(topG).lerp(anc, 0.5); guy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), anc.clone().sub(topG).normalize()); town.add(guy)
    }
    // 引き込み線（電柱から家の軒へ＝細い斜めの線。一部の柱に。本物の街は電柱から各戸へ線が伸びる）
    if (R() < 0.5) {
      const sgn = R() < 0.5 ? 1 : -1
      const top2 = new THREE.Vector3(x + sgn * 0.9, gy + ph - 1.2, z)
      const eave = new THREE.Vector3(x + sgn * (5.0 + R() * 2.5), gy + 3.0 + R() * 1.6, z + (R() - 0.5) * 3)
      const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, top2.distanceTo(eave), 4), wireMat)
      drop.position.copy(top2).lerp(eave, 0.5); drop.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), eave.clone().sub(top2).normalize()); town.add(drop)
    }
    // 電線を複数本に（碍子の両端＋下段の通信ケーブル＝日本の街の“電線の多さ”が本物感の決め手）
    const anchors = [
      new THREE.Vector3(x - 1.05, gy + ph - 0.7, z),
      new THREE.Vector3(x + 1.05, gy + ph - 0.7, z),
      new THREE.Vector3(x - 0.35, gy + ph - 2.7, z), // 下段（通信ケーブル）
      new THREE.Vector3(x + 0.35, gy + ph - 3.0, z),
    ]
    if (prevAnchors) {
      for (let k = 0; k < anchors.length; k++) {
        const a = prevAnchors[k], bn = anchors[k]
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, a.distanceTo(bn), 4), wireMat)
        wire.position.copy(a).lerp(bn, 0.5)
        wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bn.clone().sub(a).normalize())
        town.add(wire)
      }
      // スズメが上段の線にとまる（夜は塒へ帰り不在）。最も近いスパンは並んで一列＝郷愁の決め手、
      // 奥のスパンは時々まばらに。頭を上げ尾を跳ね上げた小さな影。
      if (!isNight && (i === 1 || (i <= 3 && R() < 0.6))) {
        const a = prevAnchors[0], bn = anchors[0] // 上段の線
        const row = i === 1 // 最寄りは確実に一列
        const n = row ? 4 : 1 + ((R() * 2) | 0)
        for (let s = 0; s < n; s++) {
          const t = row ? 0.16 + s * 0.20 + (R() - 0.5) * 0.04 : 0.2 + R() * 0.6
          const p = a.clone().lerp(bn, t)
          const bird = new THREE.Group()
          const body = new THREE.Mesh(sparrowBody, sparrowMat); body.scale.set(1, 1.05, 1.35); bird.add(body)
          const head = new THREE.Mesh(sparrowBody, sparrowMat); head.scale.setScalar(0.6); head.position.set(0, 0.08, 0.12); bird.add(head)
          const tail = new THREE.Mesh(sparrowTail, sparrowMat); tail.position.set(0, 0.03, -0.16); tail.rotation.x = 0.55; bird.add(tail)
          bird.position.set(p.x, p.y + 0.12, p.z); bird.rotation.y = (row ? -0.3 : 0) + (R() - 0.5) * 1.4 // ほぼ同じ向き＋少しばらす
          town.add(bird)
        }
      }
    }
    prevAnchors = anchors
  }
  // ── カーブミラー（坂の角の凸面鏡。日本の生活道路の象徴＝本物感） ──
  for (const [mx, mz, face] of [[4.3, -20, -1], [-4.6, -50, 1]]) {
    const gy = heightAt(mx, mz)
    const g = new THREE.Group(); g.position.set(mx, gy, mz)
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 3.1, 6), toon(0xd9913f)); post.position.y = 1.55; post.castShadow = true; g.add(post)
    const head = new THREE.Group(); head.position.set(face * 0.45, 3.05, 0); head.rotation.y = face * 0.5
    const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 16), toon(0xd9913f)); frame.rotation.x = Math.PI / 2; head.add(frame)
    const mirror = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16), toon(0xaebcc8)); mirror.rotation.x = Math.PI / 2; mirror.position.z = 0.06; head.add(mirror)
    g.add(head); town.add(g)
  }
  // ── 道沿いの生垣（低い緑の連なりが通りを縁取る＝住宅街の生活感。門口で時々途切れる） ──
  const hedgeCol = season === 'autumn' ? 0x867c46 : weather === 'snow' ? 0x6e7a64 : season === 'spring' ? 0x6f8a4a : 0x577142 // 季節で色味
  const hMat = toon(hedgeCol)
  // 生垣の季節の彩り（春＝ツツジの紅桃白、秋＝色づき/実の紅橙、冬＝雪に映える山茶花の紅。夏は青々と無し）。
  const bloomCols =
    season === 'spring' ? [0xe884a4, 0xf0a8be, 0xf6ecf0]
      : season === 'autumn' ? [0xc24a38, 0xcf7a36]
        : weather === 'snow' ? [0xc83a44]
          : null
  const bloomMats = bloomCols && bloomCols.map(toon)
  const bloomGeo = bloomMats && new THREE.IcosahedronGeometry(0.2, 0) // 花房の共有玉（低ポリ・乗算で柔らかく）
  for (const side of [-1, 1]) {
    for (let z = 8; z > -60; z -= 4.0) {
      if (R() < 0.42) continue // 門・駐車場の切れ目
      const hx = side * (4.1 + R() * 0.5)
      const hy = heightAt(hx, z)
      const hw = 3.4 + R() * 0.6
      const seg = new THREE.Mesh(new THREE.BoxGeometry(hw, 0.9 + R() * 0.3, 0.85), hMat)
      seg.position.set(hx, hy + 0.5, z); seg.castShadow = true; seg.receiveShadow = true; town.add(seg)
      // 生垣の上面に季節の花房を（春のツツジは咲き満ちて密に＝面で覆う・秋冬は実がまばらに）
      const spr = season === 'spring'
      if (bloomMats && R() < (spr ? 0.9 : 0.4)) {
        const nb = spr ? 3 + ((R() * 3) | 0) : 1 + ((R() * 2) | 0)
        for (let b = 0; b < nb; b++) {
          const fb = new THREE.Mesh(bloomGeo, bloomMats[(R() * bloomMats.length) | 0])
          fb.position.set(hx + (R() - 0.5) * (hw - 0.3), hy + 0.96 + R() * 0.12, z + (R() - 0.4) * 0.6)
          const s = spr ? 1.0 + R() * 0.7 : 0.6 + R() * 0.4
          fb.scale.set(s, s * 0.65, s); town.add(fb)
        }
      }
    }
  }
  // ── 玄関先の植木鉢（通り沿いにぽつぽつ＝日本の住宅街の生活感。鉢＋小さな緑） ──
  const potMat = toon(0x9a6a4e), potGreens = [toon(0x6a8a4a), toon(0x7e9850), toon(0x8aa055), toon(0xb08a64)]
  for (let i = 0; i < 12; i++) {
    const px = (R() < 0.5 ? -1 : 1) * (3.85 + R() * 0.7)
    const pz = 6 - R() * 44
    const py = heightAt(px, pz)
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.32, 8), potMat); pot.position.set(px, py + 0.16, pz); pot.castShadow = true; town.add(pot)
    const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25 + R() * 0.1, 0), potGreens[(R() * potGreens.length) | 0]); pl.position.set(px, py + 0.48, pz); pl.scale.y = 1.2; pl.castShadow = true; town.add(pl)
  }
  // ── 赤い丸ポスト（日本の街の象徴。通り沿いに1本） ──
  {
    const px = 4.0, pz = -8, py = heightAt(px, pz)
    const g = new THREE.Group(); g.position.set(px, py, pz)
    const red = toon(0xb83128)
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8), red); leg.position.y = 0.2; g.add(leg)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 1.5, 12), red); body.position.y = 0.95; body.castShadow = true; g.add(body)
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), red); dome.position.y = 1.7; g.add(dome)
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.05), toon(0x201a18)); slot.position.set(0, 1.36, 0.33); g.add(slot) // 投函口
    town.add(g)
  }
  // ── 停止線（横断歩道の手前・白い太線＝近景の路面標示） ──
  {
    const sz = -1.3
    const line = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.03, 0.42), new THREE.MeshLambertMaterial({ color: 0xc8c4ba }))
    line.position.set(-1.6, heightAt(-1.6, sz) + 0.085, sz); town.add(line)
  }
  // ── バス停の標識（細い支柱＋丸看板＝通りの生活感） ──
  {
    const px = -4.2, pz = -26, py = heightAt(px, pz)
    const g = new THREE.Group(); g.position.set(px, py, pz)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), toon(0x9a9488)); pole.position.y = 1.3; pole.castShadow = true; g.add(pole)
    const sign = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 16), toon(0xe8e2d0)); sign.rotation.x = Math.PI / 2; sign.position.set(0, 2.5, 0.1); g.add(sign)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 20), toon(0x3a6a4a)); ring.position.set(0, 2.5, 0.16); g.add(ring)
    town.add(g)
  }
  } // ← 建物・ランドマーク（街のみ）ここまで

  // ── 木立（トゥーンの丸い樹冠＋幹。そよ風に揺れる） ──
  const trunkMat = toon(0x6b4a2e)
  // 季節で葉色を「下＝陰の濃い色／上＝陽の当たる淡い色」の対で持つ＝樹冠に陰影の立体（綿玉のベタ球を脱す）。
  // 同じ添字どうしが対（春の桜/新緑、秋の紅葉/常緑…「種」が揃う）。春=桜と新緑、秋=紅葉＋常緑、冬=暗い常緑、夏=緑。
  const [leafBase, leafHi] =
    season === 'spring'
      ? [[0xd99cb8, 0xcf90ad, 0x7fa05c, 0xd29ab4], [0xf3d4e2, 0xf7e6ee, 0x9ec078, 0xedccdc]] // 桜（陰の薔薇色→陽の白桜）＋新緑
      : season === 'autumn'
        ? [[0xb86a32, 0xa85a36, 0x9a6a30, 0x4e6048, 0x586a50], [0xe0a858, 0xd89a4a, 0xc98a40, 0x687a54, 0x70845a]] // 紅葉＋常緑(杉松)
        : weather === 'snow'
          ? [[0x44543e, 0x4e6048, 0x42503c], [0x586a50, 0x627458, 0x54664e]]
          : [[0x4f6e3e, 0x547640, 0x5c7c46], [0x6f9050, 0x7a9c5a, 0x82a262]]
  const leafBaseMats = leafBase.map(toon)
  const leafHiMats = leafHi.map(toon)
  const treesArr = []
  function tree(x, z, scale) {
    const gy = heightAt(x, z)
    const g = new THREE.Group()
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 2.3, scale > 1.4 ? 10 : 7), trunkMat) // 幹を少し高く細く＝幹が見える（近景は丸く）
    tr.position.y = 1.15; tr.castShadow = true; g.add(tr)
    const r = 1.6 + R() * 1.4
    const ci = (R() * leafBaseMats.length) | 0 // 木ごとの「種」（下＝陰色／上＝陽色の対を揃える）
    const det = scale > 1.4 ? 2 : 1 // 近景の大木だけ細分を上げて樹冠の輪郭を丸く（低ポリのカクカク輪郭を脱す。奥は1=軽量）
    // 下の主房＝陰の濃い色。広く扁平に（樹冠は背より幅広く＝billowing、綿玉の真球を崩す）。
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, det), leafBaseMats[ci])
    leaf.position.y = 2.1 + r * 0.62; leaf.scale.set(1.12, 0.84 + R() * 0.12, 1.12); leaf.castShadow = true; g.add(leaf)
    // 上の房＝陽の当たる淡い色。上＋横へずらして陽だまりの片寄りと膨らみを出す（球の輪郭を崩す）。
    const leaf2 = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.74, det), leafHiMats[ci])
    leaf2.position.set((R() - 0.5) * r * 0.7, 2.1 + r * 1.18, (R() - 0.4) * r * 0.7); leaf2.scale.set(1.0, 0.95, 1.0); leaf2.castShadow = true; g.add(leaf2)
    // 近景の額装木立(大)だけ、もう一房の小さな陽だまりを足して「綿玉」でなく房の重なりに（数本＝描画負荷僅か）。
    if (scale > 1.4) {
      const leaf3 = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.5, 2), leafHiMats[ci])
      leaf3.position.set((R() - 0.5) * r * 1.2, 2.1 + r * 0.95, (R() - 0.5) * r * 1.2); leaf3.castShadow = true; g.add(leaf3)
    }
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
        const paddy = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, w), r > 0.32 ? waterMat : (r > 0.10 ? riceMat : earthMat)) // 水を張った田を主体に＝棚田の水鏡
        paddy.position.set(px + jx, gy + 0.13, pz); paddy.receiveShadow = true; town.add(paddy)
      }
    }
    // 畦道（あぜ）: 段の境界に立つ「土手の擁壁」＝棚田の階段感の決め手。横断(段境界)は高く厚く。
    const bundMat = toon(0x8a7656)
    for (let bz = -46.8; bz <= 5.5; bz += 5.6) {
      const gy = heightAt(0, bz)
      const b = new THREE.Mesh(new THREE.BoxGeometry(25, 1.15, 0.85), bundMat) // 段の擁壁（高くして段差を見せる）
      b.position.set(0, gy + 0.5, bz); b.castShadow = true; b.receiveShadow = true; town.add(b)
    }
    for (let bx = -13.8; bx <= 13.8; bx += 5.6) {
      const gy = heightAt(bx, -21)
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 50), bundMat) // 縦の畦（段内の仕切り＝細い）
      b.position.set(bx, gy + 0.32, -21); b.castShadow = true; b.receiveShadow = true; town.add(b)
    }
    // せせらぎ（谷の左の縁を縫う細い水の流れ。棚田と重ねず、連続した一筋に）
    for (let i = 0; i < 32; i++) {
      const z = 5 - i * 1.6, x = Math.sin(z * 0.11 + 0.4) * 1.4 - 9.0, gy = heightAt(x, z)
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.13, 1.9), toon(0xbcd2dc))
      seg.position.set(x, gy + 0.16, z); town.add(seg)
    }
    // 横溝屋敷（谷の主役）: 茅葺の寄棟主屋＋長屋門。屋敷林に抱かれる。
    {
      const fx = 0, fz = -18, fgy = heightAt(fx, fz)
      const g = new THREE.Group(); g.position.set(fx, fgy, fz); g.rotation.y = -0.16; g.scale.setScalar(1.5); town.add(g) // 谷の主役なので大きく立てる
      const body = new THREE.Mesh(new RoundedBoxGeometry(9, 3.2, 6.5, 1, 0.18), toon(0xe9e2d2)) // 主屋（白漆喰・角をわずかに面取り）
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
      const gateBody = new THREE.Mesh(new RoundedBoxGeometry(7, 2.2, 2.2, 1, 0.16), toon(0xddd4c4)) // 長屋門（角をわずかに面取り）
      gateBody.position.set(0, 1.1, 5.8); gateBody.castShadow = true; g.add(gateBody)
      const gateRoof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.4, 4), thatchMat)
      gateRoof.rotation.y = Math.PI / 4; gateRoof.position.set(0, 3.0, 5.8); gateRoof.scale.set(1.8, 1.0, 0.6); gateRoof.castShadow = true; g.add(gateRoof)
      const gateOpen = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.7, 0.3), toon(0x241f18)); gateOpen.position.set(0, 0.95, 6.95); g.add(gateOpen) // 門の通り口（陰）
    }
    // 屋敷林（屋敷を「後ろから」抱く高木の木立）。主屋(z=-18)の手前を空け、背後と側面奥にのみ立てる。
    for (const c of [[-8, -26], [8, -25], [-6, -31], [7, -30], [0, -33], [-11, -28], [11, -27]]) tree(c[0], c[1], 1.3 + R() * 0.5)
    // 谷の斜面に点在する瓦屋根の農家（数軒。奥にも足して空の間延びを締める）
    const farmRoof = [toon(0x6a6258), toon(0x7a5e50), toon(0x5e6a5c)]
    for (const c of [[-19, -8, 0.9], [20, -14, 1.0], [-22, -24, 1.1], [23, -30, 1.0], [-17, -36, 0.9], [16, -41, 0.95], [-24, -43, 1.0], [9, -45, 0.85]]) {
      const gy = heightAt(c[0], c[1])
      const fg = new THREE.Group(); fg.position.set(c[0], gy, c[1]); fg.scale.setScalar(c[2]); fg.rotation.y = (R() - 0.5) * 0.8; town.add(fg)
      const fb = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 3.4), toon(0xd8cfbf)); fb.position.y = 1.2; fb.castShadow = true; fg.add(fb)
      const fr = new THREE.Mesh(new THREE.ConeGeometry(3.0, 1.8, 4), farmRoof[(R() * 3) | 0]); fr.rotation.y = Math.PI / 4; fr.position.y = 3.1; fr.scale.set(1.0, 1.0, 0.85); fr.castShadow = true; fg.add(fr)
    }
    // 子メッシュを位置指定して群に足す小ヘルパ（mesh.position は読み取り専用なので set を使う）
    const addAt = (g, mesh, x, y, z) => { mesh.position.set(x, y, z); g.add(mesh); return mesh }
    // ── 案山子（棚田に点々と。十字の竿＋菅笠＋古着＝谷戸の農の生活） ──
    const clothCols = [toon(0x9a7a5a), toon(0x7a8a6a), toon(0x8a6a6a), toon(0xa08858)]
    for (const c of [[-6, -10], [5, -23], [-8, -33], [9, -39]]) {
      const gy = heightAt(c[0], c[1])
      const g = new THREE.Group(); g.position.set(c[0], gy + 0.2, c[1]); g.rotation.y = (R() - 0.5) * 1.2
      addAt(g, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.0, 5), toon(0x6a5a3c)), 0, 1.0, 0).castShadow = true // 竿
      addAt(g, new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.08), toon(0x6a5a3c)), 0, 1.5, 0) // 腕の横木
      addAt(g, new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.18), clothCols[(R() * clothCols.length) | 0]), 0, 1.45, 0) // 古着
      addAt(g, new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), toon(0xe8dcc0)), 0, 1.98, 0) // 頭
      addAt(g, new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.28, 10), toon(0xc8a860)), 0, 2.14, 0) // 菅笠
      town.add(g)
    }
    // ── 白鷺（水を張った田に佇む。谷戸の象徴の一点） ──
    const heronMat = toon(0xf2f2f0)
    for (const c of [[-2, -14], [7, -29], [-9, -41]]) {
      const gy = heightAt(c[0], c[1])
      const g = new THREE.Group(); g.position.set(c[0], gy + 0.18, c[1]); g.rotation.y = R() * 6.28
      addAt(g, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4), toon(0x3a3a3a)), 0, 0.3, 0) // 脚
      const body = addAt(g, new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), heronMat), 0, 0.72, 0); body.scale.set(1, 0.8, 1.7)
      const neck = addAt(g, new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 5), heronMat), 0, 1.0, 0.08); neck.rotation.x = 0.35
      addAt(g, new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), heronMat), 0, 1.22, 0.18) // 頭
      const beak = addAt(g, new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.18, 4), toon(0xd8b048)), 0, 1.22, 0.34); beak.rotation.x = Math.PI * 0.5
      town.add(g)
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

  // ── 走る車・歩く住民（中央の通りを行き交う）。街のみ（谷戸では作らない）。 ──
  if (kind !== 'yato') {
  const carCols = [0xb0564a, 0xe8e2d4, 0x3a5a7a, 0x9a9488, 0x4a6a4a, 0xc8b84a]
  cars = []
  const wheelMat = toon(0x18181c), glassMat = toon(0x8aa2b4)
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group()
    const col = carCols[i % carCols.length]
    // 車体・客室は面取りした箱（RoundedBox）＝丸みのある車に（低ポリの角張った箱を脱す）。
    const body = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.6, 3.4, 2, 0.24), toon(col))
    body.position.y = 0.66; body.castShadow = true; g.add(body)
    const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.54, 0.52, 1.8, 2, 0.2), glassMat); cabin.position.set(0, 1.12, -0.1); g.add(cabin) // 窓(水色ガラス)
    const roof = new THREE.Mesh(new RoundedBoxGeometry(1.58, 0.12, 1.55, 1, 0.06), toon(col)); roof.position.set(0, 1.42, -0.1); roof.castShadow = true; g.add(roof) // 屋根(車体色)
    for (const wx of [-0.82, 0.82]) for (const wz of [-1.05, 1.1]) { // 4輪
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 12), wheelMat)
      wheel.rotation.z = Math.PI / 2; wheel.position.set(wx, 0.32, wz); g.add(wheel)
    }
    const dir = (i % 2 === 0) ? 1 : -1
    // テールランプ（赤・常時）
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.08), new THREE.MeshBasicMaterial({ color: 0xc23a2c, fog: true }))
    tail.position.set(0, 0.6, dir > 0 ? 1.72 : -1.72); g.add(tail)
    if (duskAmt > 0.2) { // ヘッドライト（夕/夜）
      const light = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: true }))
      light.position.set(0, 0.58, dir > 0 ? -1.72 : 1.72); g.add(light)
    }
    g.userData = { dir, lane: dir > 0 ? -1.5 : 1.5, speed: 7 + R() * 5, z: -90 + R() * 110 }
    town.add(g); cars.push(g)
  }

  // ── 歩く住民（歩道を行き交う小さな人影） ──
  const peepCols = [0x5a78a0, 0xc06a6a, 0x6a8a5a, 0xb0a060, 0x8a6aa0, 0xd0d0c8]
  const pantsCols = [0x3a3a44, 0x4a4036, 0x33414e, 0x46342e], hairCols = [0x2a221c, 0x1e1a16, 0x3a2e24]
  const skinMat = toon(0xf0c49c)
  peeps = []
  for (let i = 0; i < 11; i++) {
    const g = new THREE.Group()
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.32), toon(pantsCols[(R() * pantsCols.length) | 0])); legs.position.y = 0.4; legs.castShadow = true; g.add(legs) // ズボン
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.42, 3, 6), toon(peepCols[i % peepCols.length])); torso.position.y = 0.98; torso.castShadow = true; g.add(torso) // 上着
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 6), skinMat); head.position.y = 1.42; g.add(head)
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.245, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), toon(hairCols[(R() * hairCols.length) | 0])); hair.position.y = 1.45; g.add(hair) // 髪
    g.scale.setScalar(0.86 + R() * 0.28) // 背丈の個体差（子供〜大人）
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
    winOpen: 0, winOpenTarget: 0, // 窓をあける（ガラスが横にすべって外気が澄む）。winOpen=ease済みの実値
    winOpenP: 0,                  // 窓あけの線形進行(0..1)。これに ease-in-out をかけて winOpen にする
    lean: 0, leanTarget: 0,        // 身を乗り出す（枠を越えて前へ＝視界が広がる）。lean=ease済みの実値
    leanP: 0,                     // 乗り出しの線形進行(0..1)
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

  // ════════════════════════════════════════════════════════════════════════
  // 「いつもと違う光景」定期イベント（ぼーっと眺めていると時々おきる小さな驚き）。
  // 多重タイムスケール: 頻繁な小イベント〜まれな大当たり（雨上がりの虹・夜の花火）。数値で調整可。
  // 各イベントは scene にメッシュを足し、寿命が尽きたら自分で取り除く（静的影は焼き済み＝影に不参加）。
  // ════════════════════════════════════════════════════════════════════════
  const fxList = []
  const addFx = (fx) => { fx.age = 0; fxList.push(fx) }
  const disposeObj = (o) => o.traverse((c) => {
    if (c.geometry) c.geometry.dispose()
    const m = c.material; if (m) { Array.isArray(m) ? m.forEach((x) => x.dispose()) : m.dispose() }
  })
  const delayFx = (sec, fn) => addFx({ update: (age) => { if (age >= sec) { fn(); return false } return true }, cleanup: () => {} }) // sec秒後に1回実行
  function updateFx(dt) {
    for (let i = fxList.length - 1; i >= 0; i--) {
      const fx = fxList[i]; fx.age += dt
      let keep = true
      try { keep = fx.update(fx.age, dt) !== false } catch (e) { keep = false }
      if (!keep) { try { fx.cleanup() } catch (e) { /* 無視 */ } fxList.splice(i, 1) }
    }
  }
  let rainActive = false // 雨は重複させない

  // ── 雨が通り過ぎる（晴れでも一時的に降ってやむ）。奥が少しけむり、雨上がりに虹を呼ぶ ──
  function evRain(dur = 30) {
    if (rainActive) return
    rainActive = true
    const N = 520, len = 2.6 // 雨脚の長さ。点でなく短い“筋”にして雨らしく（風で少し斜め）
    const pos = new Float32Array(N * 2 * 3) // 各雨脚＝2頂点（上端・下端）
    const head = new Float32Array(N * 3); const spd = new Float32Array(N)
    for (let i = 0; i < N; i++) { head[i * 3] = (R() - 0.5) * 210; head[i * 3 + 1] = R() * 95; head[i * 3 + 2] = -130 + R() * 190; spd[i] = 32 * (0.7 + R() * 0.6) }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.LineBasicMaterial({ color: 0xc4d4e2, transparent: true, opacity: 0, fog: true, depthWrite: false })
    const seg = new THREE.LineSegments(geo, mat); seg.frustumCulled = false; scene.add(seg)
    const writeSeg = () => { for (let i = 0; i < N; i++) { const h = i * 3, p = i * 6; pos[p] = head[h]; pos[p + 1] = head[h + 1]; pos[p + 2] = head[h + 2]; pos[p + 3] = head[h] + 0.6; pos[p + 4] = head[h + 1] - len; pos[p + 5] = head[h + 2] } }
    const fogFar0 = scene.fog.far
    let rbDone = false
    addFx({
      update: (age, dt) => {
        const k = Math.min(1, age / 5) * Math.min(1, Math.max(0, (dur - age) / 8)) // 立ち上がり5s・終い8s
        mat.opacity = 0.6 * k
        scene.fog.far = fogFar0 * (1 - 0.16 * k) // 雨で奥がけむる
        for (let i = 0; i < N; i++) { head[i * 3 + 1] -= spd[i] * dt; head[i * 3] += 4 * dt; if (head[i * 3 + 1] < -14) { head[i * 3 + 1] = 82 + R() * 16; head[i * 3] = (R() - 0.5) * 210 } }
        writeSeg(); geo.attributes.position.needsUpdate = true
        if (!rbDone && age >= dur - 7) { rbDone = true; evRainbow(); evWetRoad() } // 雨上がりに虹＋濡れた路面のきらめき
        if (age >= dur) { rainActive = false; scene.fog.far = fogFar0; return false }
        return true
      },
      cleanup: () => { scene.remove(seg); geo.dispose(); mat.dispose(); scene.fog.far = fogFar0; rainActive = false },
    })
  }

  // ── 雨上がりの虹（半円アーチ。赤(外)→紫(内)を計算で。淡くフェードイン/アウト） ──
  function evRainbow() {
    // 主虹＋淡い副虹（色反転・外側）。白を多めに混ぜ、帯の縁をやわらかくして“水彩のにじみ”に＝CG臭を消す。
    const grp = new THREE.Group()
    grp.position.set(0, -16, eye.z - 195) // 街の奥・地平から立ち上がる大アーチ（手前の建物に下部が隠れる＝奥にかかる虹。fog:false）
    const mats = []
    const makeBow = (inner, outer, reversed, opScale) => {
      const geo = new THREE.RingGeometry(inner, outer, 120, 1, 0, Math.PI)
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
        uniforms: { uOp: { value: 0 }, uInner: { value: inner }, uOuter: { value: outer }, uRev: { value: reversed ? 1 : 0 }, uScale: { value: opScale } },
        vertexShader: 'varying float vR; void main(){ vR=length(position.xy); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
        fragmentShader: 'varying float vR; uniform float uOp,uInner,uOuter,uRev,uScale;' +
          'vec3 hsv(float h){ vec3 p=abs(fract(h+vec3(0.,2./3.,1./3.))*6.-3.); return clamp(p-1.,0.,1.); }' +
          'void main(){ float rr=(vR-uInner)/(uOuter-uInner);' +
          'float h=mix(0.78,0.0,rr); if(uRev>0.5) h=mix(0.0,0.78,rr);' +          // 主虹:外赤内紫 / 副虹:反転
          'vec3 col=mix(vec3(1.0),hsv(h),0.58);' +                                // 白を多めに＝水彩の空気感
          'float edge=smoothstep(0.0,0.22,rr)*(1.0-smoothstep(0.78,1.0,rr));' +   // 帯の縁をやわらかく溶かす
          'gl_FragColor=vec4(col, edge*uOp*uScale); }',
      })
      const ring = new THREE.Mesh(geo, mat); ring.frustumCulled = false; grp.add(ring); mats.push(mat)
    }
    makeBow(80, 103, false, 1.0)   // 主虹
    makeBow(112, 131, true, 0.28)  // 副虹（外側・色反転・ごく淡い）
    scene.add(grp)
    const dur = 46
    addFx({
      update: (age) => { const env = 0.62 * Math.min(1, age / 7) * Math.min(1, Math.max(0, (dur - age) / 17)); for (const m of mats) m.uniforms.uOp.value = env; return age < dur },
      cleanup: () => { scene.remove(grp); disposeObj(grp) },
    })
  }

  // ── 渡り鳥の群れ（はばたきながら横切る） ──
  function evBirdFlock() {
    const g = new THREE.Group()
    const mat = new THREE.MeshBasicMaterial({ color: isNight ? 0x2a3a4e : 0x39393f, fog: true })
    const n = 13 + ((R() * 8) | 0); const sub = []
    for (let i = 0; i < n; i++) {
      const b = new THREE.Group()
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 0.42), mat); w.position.x = s * 0.62; w.userData.side = s; b.add(w) }
      b.userData = { ph: R() * 6.28, rk: Math.ceil(i / 2), sd: i === 0 ? 0 : (i % 2 === 0 ? 1 : -1) }; g.add(b); sub.push(b)
    }
    const dir = R() < 0.5 ? 1 : -1
    // V字編隊: 先頭1羽、後方(dirの逆)へ左右(z)に開く。縦窓は横画角が狭いので枠外から入れて確実に横切らせる。
    for (const b of sub) b.position.set(-dir * b.userData.rk * 1.7 + (R() - 0.5) * 0.5, (R() - 0.5) * 1.2, b.userData.sd * b.userData.rk * 1.5 + (R() - 0.5) * 0.5)
    g.position.set(dir > 0 ? -46 : 46, 46 + R() * 18, -38 - R() * 26); scene.add(g) // 空を背に飛ばす（山に紛れず映える）
    const baseY = g.position.y
    addFx({
      update: (age, dt) => { g.position.x += dir * 10 * dt; g.position.y = baseY + Math.sin(age * 0.5) * 0.7; for (const b of sub) { const f = Math.sin(age * 9 + b.userData.ph) * 0.5; b.children.forEach((w) => { w.rotation.z = w.userData.side * f }) } return Math.abs(g.position.x) < 50 },
      cleanup: () => { scene.remove(g); disposeObj(g) },
    })
  }

  // ── 気球がふわりと横切る（昼） ──
  function evBalloon() {
    const g = new THREE.Group()
    const hues = [0xc07a68, 0x6a8db5, 0x82a878, 0xcdb074, 0x9a82b0] // 街のくすみパレットに寄せた中間色
    const env = new THREE.Mesh(new THREE.SphereGeometry(4.2, 16, 12), toon(hues[(R() * hues.length) | 0])); env.scale.y = 1.25; env.position.y = 5; g.add(env)
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), toon(0x6a4a2a)))
    // 籠から気球へ伸びる細いゴンドラロープ（低コストで本物感）
    g.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.6, 0.5, -0.6, -1.5, 2.7, -1.5, 0.6, 0.5, -0.6, 1.5, 2.7, -1.5, -0.6, 0.5, 0.6, -1.5, 2.7, 1.5, 0.6, 0.5, 0.6, 1.5, 2.7, 1.5]), 3)),
      new THREE.LineBasicMaterial({ color: 0x4a3a28, fog: true }),
    ))
    const dir = R() < 0.5 ? 1 : -1
    // 縦長の窓は横画角が狭いので、見える幅の少し外から入れてゆっくり横断させる
    g.position.set(dir > 0 ? -44 : 44, 26 + R() * 16, -48 - R() * 22); scene.add(g)
    addFx({
      update: (age, dt) => { g.position.x += dir * 5 * dt; g.position.y += 0.22 * dt; g.rotation.z = Math.sin(age * 0.5) * 0.05; return Math.abs(g.position.x) < 48 },
      cleanup: () => { scene.remove(g); disposeObj(g) },
    })
  }

  // ── 流れ星（夜・ひと筋の光が尾を引いて流れる） ──
  function evShootingStar() {
    const g = new THREE.Group()
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfffbe0, fog: false, transparent: true })
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), headMat))
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 16, 8, 0]), 3)) // 速度の逆向き＝後方へ伸びる尾
    const trailMat = new THREE.LineBasicMaterial({ color: 0xfff0c0, transparent: true, fog: false })
    g.add(new THREE.Line(tg, trailMat))
    g.position.set(40 + R() * 40, 72 + R() * 18, -90 - R() * 30); scene.add(g)
    const vx = -33 - R() * 12, vy = -16 - R() * 7, dur = 2.4 // ゆったり長く流れて見逃さない
    addFx({
      update: (age, dt) => { g.position.x += vx * dt; g.position.y += vy * dt; const o = Math.min(1, age / 0.25) * Math.max(0, 1 - age / dur); headMat.opacity = o; trailMat.opacity = o * 0.85; return age < dur },
      cleanup: () => { scene.remove(g); disposeObj(g) },
    })
  }
  // たまに2〜3個が時間差で流れる＝流星群の趣（夜の頻繁バンドから呼ぶ）
  function evShootingStars() { evShootingStar(); if (R() < 0.5) delayFx(0.5 + R() * 0.7, evShootingStar); if (R() < 0.25) delayFx(1.3 + R() * 0.9, evShootingStar) }

  // ── 花火（夜・連発。色玉が開いて重力で散り、消える） ──
  function evFireworks() {
    const live = []; let bursts = 0, nextBurst = 0
    const mkBurst = () => {
      const N = 92, pos = new Float32Array(N * 3), vel = []
      const cx = (R() - 0.5) * 60, cy = 56 + R() * 18, cz = -70 - R() * 30
      for (let i = 0; i < N; i++) { pos[i * 3] = cx; pos[i * 3 + 1] = cy; pos[i * 3 + 2] = cz; const th = R() * 6.28, ph = Math.acos(2 * R() - 1), sp = 11 + R() * 7; vel.push([Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp]) }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const mat = new THREE.PointsMaterial({ color: new THREE.Color().setHSL(R(), 0.78, 0.66).getHex(), size: 1.5, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: true })
      const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts)
      live.push({ pts, geo, mat, pos, vel, N, age: 0 })
      // 開花の“芯”＝中心の白い大玉を一瞬だけ強く（パッと開く手応え）
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([cx, cy, cz]), 3))
      const fm = new THREE.PointsMaterial({ color: 0xfff6e8, size: 7, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: true })
      const fp = new THREE.Points(fg, fm); fp.frustumCulled = false; scene.add(fp)
      live.push({ pts: fp, geo: fg, mat: fm, N: 0, age: 0, flash: true })
    }
    const dur = 10
    addFx({
      update: (age, dt) => {
        nextBurst -= dt
        if (bursts < 4 && nextBurst <= 0) { mkBurst(); bursts++; nextBurst = 1.0 + R() * 1.3 }
        for (let b = live.length - 1; b >= 0; b--) {
          const B = live[b]; B.age += dt
          if (B.flash) { B.mat.opacity = Math.max(0, 1 - B.age / 0.4); if (B.age > 0.4) { scene.remove(B.pts); B.geo.dispose(); B.mat.dispose(); live.splice(b, 1) } continue }
          for (let i = 0; i < B.N; i++) { B.vel[i][1] -= 9 * dt; B.pos[i * 3] += B.vel[i][0] * dt; B.pos[i * 3 + 1] += B.vel[i][1] * dt; B.pos[i * 3 + 2] += B.vel[i][2] * dt }
          B.geo.attributes.position.needsUpdate = true; B.mat.opacity = Math.max(0, 1 - B.age / 2.5)
          if (B.age > 2.5) { scene.remove(B.pts); B.geo.dispose(); B.mat.dispose(); live.splice(b, 1) }
        }
        return age < dur || live.length > 0
      },
      cleanup: () => { for (const B of live) { scene.remove(B.pts); B.geo.dispose(); B.mat.dispose() } },
    })
  }

  // ── 飛行機雲（高空をゆっくり横切り、白い帯が後ろへ伸びていく。日常の“あ、飛行機”の発見） ──
  function evContrail() {
    const dir = R() < 0.5 ? 1 : -1
    const g = new THREE.Group()
    const plane = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.5), new THREE.MeshBasicMaterial({ color: isNight ? 0x8a98ac : 0x4a5564, fog: true })) // 空を背に暗い点＝機体が見える
    g.add(plane)
    const MAXP = 130, tpos = new Float32Array(MAXP * 3)
    const tgeo = new THREE.BufferGeometry(); tgeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3))
    const tmat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: true, depthWrite: false })
    g.add(new THREE.Line(tgeo, tmat)); scene.add(g)
    plane.position.set(dir > 0 ? -48 : 48, 52 + R() * 12, -80 - R() * 32) // 見える高さの空に（高すぎると枠外に出る）
    const pts2 = []; let rec = 0
    addFx({
      update: (age, dt) => {
        plane.position.x += dir * 7 * dt
        rec -= dt
        if (rec <= 0) { rec = 0.12; pts2.push(plane.position.x, plane.position.y, plane.position.z); if (pts2.length > MAXP * 3) pts2.splice(0, 3) }
        for (let i = 0; i < pts2.length; i++) tpos[i] = pts2[i]
        tgeo.setDrawRange(0, pts2.length / 3); tgeo.attributes.position.needsUpdate = true
        tmat.opacity = 0.6 * Math.min(1, age / 3) * Math.min(1, Math.max(0, (16 - age) / 4)) // 伸びて、やがて薄れて消える
        return age < 16 && Math.abs(plane.position.x) < 54
      },
      cleanup: () => { scene.remove(g); disposeObj(g) },
    })
  }

  // ── 雲が陽を横切る翳り（全体がふっと翳って、また明るむ。最も静かな“整う”演出。昼のみ） ──
  let shadeActive = false
  function evCloudShade() {
    if (isNight || shadeActive) return
    shadeActive = true
    const i0 = sun.intensity
    addFx({
      update: (age) => { const k = Math.min(1, age / 3) * Math.min(1, Math.max(0, (10 - age) / 4)); sun.intensity = i0 * (1 - 0.38 * k); return age < 10 },
      cleanup: () => { sun.intensity = i0; shadeActive = false },
    })
  }

  // ── 宵の口（夜・一部の窓が時間差でぽっと明るむ。街に灯りが点っていく気配＝最も“整う”夜の演出） ──
  function evDuskLights() {
    if (!isNight) return
    // 灯る窓のマテリアルを scene から拾い、一部を時間差で明るませる（配列参照を持たず scene 走査で完結）
    const mats = []
    scene.traverse((o) => { const m = o.material; if (m && m.emissiveMap && m.emissiveIntensity > 0.1 && R() < 0.2) mats.push(m) })
    if (!mats.length) return
    const items = mats.map((m) => ({ m, base: m.emissiveIntensity, t0: R() * 6 }))
    const dur = 13
    addFx({
      update: (age) => {
        for (const it of items) { const a = age - it.t0; const k = a <= 0 ? 0 : Math.min(1, a / 1.6) * Math.min(1, Math.max(0, (dur - it.t0 - a) / 3)); it.m.emissiveIntensity = it.base + 0.42 * k }
        return age < dur
      },
      cleanup: () => { for (const it of items) it.m.emissiveIntensity = it.base },
    })
  }

  // ── 雨上がりの濡れた路面のきらめき（通りに空/灯りの照り返しがちらちら。雨の“第三幕”） ──
  function evWetRoad() {
    const N = 90
    const pos = new Float32Array(N * 3); const aph = new Float32Array(N)
    for (let i = 0; i < N; i++) { pos[i * 3] = (R() - 0.5) * 9; pos[i * 3 + 1] = 0.12; pos[i * 3 + 2] = 18 - R() * 112; aph[i] = R() * 6.28 }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aph', new THREE.BufferAttribute(aph, 1))
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uOp: { value: 0 }, uCol: { value: new THREE.Color(isNight ? 0xffd6a0 : 0xcfe4f2) } },
      vertexShader: 'attribute float aph; varying float vtw; uniform float uT; void main(){ vtw=0.35+0.65*(0.5+0.5*sin(uT*2.6+aph)); vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=3.2*(60.0/max(1.0,-mv.z)); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying float vtw; uniform vec3 uCol; uniform float uOp; void main(){ float a=smoothstep(0.5,0.0,length(gl_PointCoord-0.5)); gl_FragColor=vec4(uCol, a*vtw*uOp); }',
    })
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; town.add(pts) // town座標系（街と一緒に動く）
    const dur = 17
    addFx({
      update: (age) => { mat.uniforms.uT.value = age; mat.uniforms.uOp.value = 0.62 * Math.min(1, age / 3) * Math.min(1, Math.max(0, (dur - age) / 6)); return age < dur },
      cleanup: () => { town.remove(pts); geo.dispose(); mat.dispose() },
    })
  }

  // ── オーロラ（夜の超レア大当たり。緑〜紫のカーテンが空に揺らめき流れる。計算で描画） ──
  function evAurora() {
    const geo = new THREE.PlaneGeometry(340, 96)
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uOp: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader:
        'varying vec2 vUv; uniform float uT,uOp;' +
        'void main(){ float x=vUv.x, y=vUv.y; float t=uT*0.12; float curt=0.0;' +
        'for(int i=0;i<3;i++){ float fi=float(i); float ph=x*(7.0+fi*5.0)+t*(1.0+fi*0.5)+fi*2.1; curt+=(sin(ph)*0.5+0.5)*(0.5-fi*0.12); }' +
        'curt/=1.4; float ray=pow(curt,1.4);' +              // 縦のカーテン状の濃淡が横に流れる
        'float vfall=smoothstep(1.0,0.12,y)*smoothstep(0.0,0.18,y);' + // 上下端へやわらかく消える
        'vec3 green=vec3(0.30,1.0,0.55), violet=vec3(0.66,0.34,1.0);' +
        'vec3 col=mix(green,violet,smoothstep(0.30,0.95,y));' +        // 色はフルに保ち、濃淡はアルファで（加算でも色が出る）
        'gl_FragColor=vec4(col, ray*vfall*uOp); }',
    })
    const m = new THREE.Mesh(geo, mat); m.position.set(0, 74, eye.z - 205); m.frustumCulled = false; scene.add(m)
    const dur = 56
    addFx({
      update: (age) => { mat.uniforms.uT.value = age; mat.uniforms.uOp.value = 1.08 * Math.min(1, age / 10) * Math.min(1, Math.max(0, (dur - age) / 16)); return age < dur },
      cleanup: () => { scene.remove(m); geo.dispose(); mat.dispose() },
    })
  }

  // タイムスケール別の発火表。最初の発火は早め（眺めてすぐ何か起きる）、以降は間隔をあける。数値で調整可。
  const EV = {
    birds: { run: evBirdFlock },
    balloon: { run: evBalloon, ok: () => !isNight },
    star: { run: evShootingStars, ok: () => isNight },
    contrail: { run: evContrail },
    cloudShade: { run: evCloudShade, ok: () => !isNight && !shadeActive }, // 雲の翳り（昼の静かな整う演出）
    duskLights: { run: evDuskLights, ok: () => isNight }, // 宵の口（夜・窓がぽっと灯る）
    rainbowSolo: { run: evRainbow, ok: () => !rainActive }, // 雨無しの単独虹（中バンドに低確率）＝見せ場を観られる機会を増やす
    rain: { run: () => evRain(30), ok: () => !rainActive },
    fireworks: { run: evFireworks, ok: () => isNight },
    aurora: { run: evAurora, ok: () => isNight },
  }
  const fxBands = [
    { next: 10 + R() * 8, min: 24, max: 42, quiet: 0.3, pool: ['birds', 'balloon', 'star', 'cloudShade', 'duskLights'] },         // 頻繁（小さな驚き）。3割は“何も起きない素の街”の余白
    { next: 45 + R() * 35, min: 70, max: 150, pool: ['contrail', 'balloon', 'star', 'cloudShade', 'duskLights', 'rainbowSolo'] }, // 中（少し特別）
    { next: 80 + R() * 90, min: 480, max: 1500, pool: ['rain', 'fireworks'] },                                      // まれ（大当たり＝雨→虹／花火）
    { next: 360 + R() * 360, min: 1800, max: 3600, pool: ['aurora'] },                                              // 超レア（30〜60分に一度の“特別な空”＝オーロラ。最初は6〜12分で一度）
  ]
  function scheduleFx(dt) {
    for (const b of fxBands) {
      b.next -= dt
      if (b.next > 0) continue
      b.next = b.min + R() * (b.max - b.min)
      if (b.quiet && R() < b.quiet) continue // 何も起きない“余白”をたまに挟む（アンビエントの締まり）
      const ok = b.pool.filter((k) => { const e = EV[k]; return e && (!e.ok || e.ok()) })
      if (ok.length) EV[ok[(R() * ok.length) | 0]].run()
    }
  }
  // 検証用フック（dev）: 任意のイベントを即時に起こす
  if (/[?&]dev=1/.test(location.search)) window.__town3dEvent = (n) => ({ rain: () => evRain(16), rainbow: evRainbow, wetRoad: evWetRoad, birds: evBirdFlock, balloon: evBalloon, star: evShootingStars, contrail: evContrail, cloudShade: evCloudShade, duskLights: evDuskLights, fireworks: evFireworks, aurora: evAurora }[n] || (() => {}))()

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
    // 窓あけ／乗り出しの「線形進行(0..1)」を所要時間ぶんだけ目標へ一定速度で進め、ease-in-out をかける。
    // exp追従(従来)は出だしだけ急＝ease-outで戻りが不自然だった。線形進行+smoothstepなら開く時も
    // 戻る時も出だし・止まり際の両方がそっと加減速する＝ヌルヌルで酔わない窓の開閉・覗き込みになる。
    active.winOpenP = approach(active.winOpenP, active.winOpenTarget, dt / CAM.winOpenDur)
    active.leanP = approach(active.leanP, active.leanTarget, dt / CAM.leanDur)
    const wo = easeInOut(active.winOpenP)
    const lean = easeInOut(active.leanP)
    active.winOpen = wo; active.lean = lean // 外部参照（見回し幅の算出など）用に実値を保持

    // 乗り出しを戻すと見上げの可動域も縮むので、目標ピッチも追従して下げる（上を向いたまま固まらない）
    const plim = pitchLimits(lean)
    active.pitchTarget = Math.max(-plim.dn, Math.min(plim.up, active.pitchTarget))
    // 見回しを目標へ滑らかに追従（イージング＝指を離しても余韻があるヌルヌルの見回し）
    active.yaw += (active.yawTarget - active.yaw) * 0.16
    active.pitch += (active.pitchTarget - active.pitch) * 0.16
    // 見回し（息づかいの微揺れ付き）
    const yaw = active.yaw + Math.sin(t * 0.2) * 0.012
    const pitch = active.pitch
    // 窓をあけると視界がふっと前へ開け(=控えめ)、乗り出すとさらに前へ・下へ寄って画角が広がる（枠を越えて街へ顔を出す）
    const ex = 0
    const ey = eye.y - wo * CAM.winDown - lean * CAM.leanDown
    const ez = eye.z - wo * CAM.winFwd - lean * CAM.leanFwd
    camera.position.set(ex, ey, ez)
    const fov = CAM.fov0 + wo * CAM.winFov + lean * CAM.leanFov
    if (Math.abs(fov - active.fovCur) > 0.04) { active.fovCur = fov; camera.fov = fov; camera.updateProjectionMatrix() }
    const look = new THREE.Vector3(
      ex + Math.sin(yaw) * 18,
      ey - 12 - lean * CAM.leanLook + pitch * CAM.lookPitch + Math.sin(t * 0.5) * 0.05, // 既定は見下ろし／上スワイプで空・ビル上層も仰げる
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
        `saturate(${lerp(0.85, 0.96, clarity).toFixed(3)}) sepia(${lerp(0.045, 0.02, clarity).toFixed(3)}) ` +
        `brightness(${lerp(1.03, 1.06, clarity).toFixed(3)}) contrast(0.99)`
    }

    // 雲がゆっくり流れる
    for (const c of clouds) { c.position.x += 0.01; if (c.position.x > 130) c.position.x = -130 }
    // 「いつもと違う光景」定期イベントを進め、各タイムスケールで時々起こす
    updateFx(dt)
    scheduleFx(dt)
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
