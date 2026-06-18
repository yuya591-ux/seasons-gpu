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
  leanLook: 3.2,    // 乗り出しで視線が下を覗き込む量（手前の木立へ落ち込み過ぎない程度に抑制＝評価UX-H2）
  leanPitchUp: 1.10, // 乗り出し時に上を見上げられる範囲（空・ビル上層まで仰げる）。大きいほど上が見える
  leanPitchDn: 0.55, // 乗り出し時に下を見下ろせる範囲の拡張（ユーザー要望でさらに下＝足下の街まで覗ける）
  lookPitch: 18,    // 見上げ/見下ろしの効き（pitch→視線の縦移動量）。大きいほど少しのスワイプで大きく振れる
  fov0: 62,         // 基準画角(度)
}

// ── 浮遊（空を飛ぶ）／散策（歩く）モードの調整パラメータ ──
// 白猫の“ぷにコン”式スティック（左=移動／右=見回し）で操る。離すと慣性で減速しホバリング。
// 視点の少し後ろ上から街を広く望む“浮遊カメラ”（アバター無し）。旋回でバンク・慣性・風で飛翔感を出す。
const FLY = {
  // 速度・慣性（鳥/グライダーの“重さ”）
  speed: 12.5,      // 飛行の最大速度(u/s)。御しやすさ優先で少し控えめに（全倒しで到達）
  walkSpeed: 5.5,   // 歩行の最大速度(u/s)
  climbSpeed: 6.5,  // （旧）上昇/下降の速さ。スキームAでは未使用
  moveEase: 2.8,    // 速度の追従(1/s)。小さいほど重い加速／離すと惰性で滑空して停止
  // ── スキームA: オート巡航＋ドラッグ操舵（一本指） ──
  cruiseSpeed: 7.5, // 自動巡航の速さ(u/s)。ゆっくり前進
  steerEase: 0.13,  // ドラッグで操った進路(向き)へ機首が向く滑らかさ
  steerYaw: 2.4,    // 横ドラッグ→旋回の効き（画面幅いっぱいのドラッグでこのrad）
  steerPitch: 2.2,  // 縦ドラッグ→上昇下降(機首上下)の効き
  // 画角
  fov: 72, walkFov: 68,
  fovSpeedGain: 7,  // 高速時に画角が広がる量(度)＝速度の高揚
  // 出入り・見回し
  enterDur: 1.7, pitchMax: 1.2, landDur: 1.4,
  lookEase: 0.18,   // 見回し（右ドラッグ）の追従
  // 引いた三人称“浮遊カメラ”（後方上から望む）
  camBack: 9.5, camUp: 3.2, camAhead: 9,      // 飛行: 後方/上/注視先
  walkBack: 1.5, walkUp: 0.4, walkAhead: 4.5, // 歩行: 一人称寄り（通行人と目線を揃える＝地に足のついた散策。アバター無し）
  camLag: 0.12,     // カメラ位置の遅れ追従（わずかな揺らぎ＝空気の流れ）
  // 旋回バンク（飛行の没入の要）
  bankMax: 0.32,    // 最大ロール(rad≈18°)。穏当に（酔い配慮）
  bankGain: 2.2,    // 旋回・横移動入力→バンク量
  bankEase: 0.07,   // バンクの追従（ゆっくり傾く）
  // 目線・スティック
  eye: 1.62,        // 立ったときの目線の高さ（地形+この高さ）
  stickRadius: 62,  // スティックの最大振れ(px)。これで全速
  stickDead: 0.14,  // 不感帯（微小な震えを無視）
  turnRate: 1.7,    // 白猫式: 横へ倒すほど速く向き直る旋回速度(rad/s)
  turnEase: 0.16,   // 旋回入力のスムージング（手ブレで進路が暴れない・急に曲がらない＝快適）
  // 飛べる箱（街を包む範囲）。これを越えない＝手描きの街の縁・未生成の余白を見せない。街区拡張に合わせ広げた。
  bound: { x: 80, zMin: -112, zMax: 40, yMax: 108, yFloor: 4.5 },
}

// 乗り出し量(0..1)に応じた見上げ/見下ろしの可動範囲。乗り出すほど上も下も大きく振れる。
// applyTown3dLook(スワイプ時)とframeループ(戻り時の追従)の両方で使い、範囲を一元管理する。
const pitchLimits = (lean) => ({ up: 0.5 + lean * CAM.leanPitchUp, dn: 0.45 + lean * CAM.leanPitchDn })

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
  // 歩行（白猫式）のときの右ドラッグ＝見回し（上下で機首・左右でオフセット、離すと戻る）。飛行はapplyTown3dSteerを使う。
  if (active.flyTarget) {
    active.flyPitchTarget = Math.max(-FLY.pitchMax, Math.min(FLY.pitchMax, active.flyPitchTarget + dy * 0.9))
    active.lookYawOffTarget = Math.max(-1.3, Math.min(1.3, active.lookYawOffTarget + dx * 1.6))
    return
  }
  const l = active.lean || 0
  const yawMax = 0.9 + l * 0.7   // 乗り出すと左右に大きく見渡せる
  const lim = pitchLimits(l)     // 乗り出すと上（空・ビル上層）も下も大きく見られる
  // 目標値を動かし、frame loop でイージング追従（指を離しても余韻＝ヌルヌル）。感度UP。
  active.yawTarget = Math.max(-yawMax, Math.min(yawMax, active.yawTarget + dx * 2.4))
  active.pitchTarget = Math.max(-lim.dn, Math.min(lim.up, active.pitchTarget + dy * 1.2)) // 縦の感度を下げ、手前の木立へ視線が落ち込み過ぎないように（評価UX-H2）
}

// 飛行（スキームA）のドラッグ操舵: 進む向き(flyYaw)と機首の上下(flyPitch)を動かす。dx/dy は画面比の移動量
// （右ドラッグ=dx+ / 下ドラッグ=dy+）。横で旋回、上で上昇・下で下降。離しても巡航は続く。
export function applyTown3dSteer(dx, dy) {
  if (!active) return
  active.flyYawTarget += dx * FLY.steerYaw // 右ドラッグ＝右へ旋回
  active.flyPitchTarget = Math.max(-FLY.pitchMax, Math.min(FLY.pitchMax, active.flyPitchTarget - dy * FLY.steerPitch)) // 上ドラッグ＝機首上げ＝上昇
}

// とまる／すすむ（スキームA）。とまる中はその場でホバリング、すすむで自動巡航を再開。
export function setTown3dCruise(on) {
  if (active) active.cruise = !!on
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

// 空へ飛び立つ／窓へもどる（浮遊モード）。飛び立つ瞬間にいまの窓の視点・視線を引き継ぎ、
// 景色がワープせず地続きに浮かび上がる。frame loop が flyP を 0↔1 にイージングして滑らかに出入りする。
export function setTown3dFly(on) {
  if (!active || !active.flyEnabled) return
  if (on) {
    if (active.mode === 'window') {
      // 窓の景色から地続きに飛び立つ（いまの視点・視線を引き継ぐ）
      const cp = active.camera.position, wl = active.winLook
      active.flyPos.copy(cp)
      let dx = wl.x - cp.x, dy = wl.y - cp.y, dz = wl.z - cp.z
      const len = Math.hypot(dx, dy, dz) || 1
      dx /= len; dy /= len; dz /= len
      active.flyYaw = active.flyYawTarget = Math.atan2(dx, -dz)      // 0=奥(-z)を向く
      active.flyPitch = active.flyPitchTarget = Math.asin(Math.max(-1, Math.min(1, dy))) // いまの見下ろしから地続きに
      active.camReady = false // 引いたカメラ位置を次フレームでスナップ初期化
    } else if (active.mode === 'walk') {
      active.flyPitchTarget = 0.18 // 歩きから飛び立つ＝視線を少し上げてふわりと
    }
    active.vel.set(0, 0, 0); active.moveX = 0; active.moveY = 0; active.bankCur = 0; active.turnSmooth = 0
    active.cruise = true // スキームA: 飛び立ったら自動巡航から
    active.mode = 'fly'
    active.flyTarget = 1
  } else {
    active.mode = 'window'
    active.flyTarget = 0
    active.moveX = 0; active.moveY = 0
  }
}

// 飛び降りて着地して歩く／また飛び立つ（一人称散策）。land=true で現在地の真下へなめらかに下りる。
export function setTown3dLand(land) {
  if (!active || !active.flyEnabled) return
  if (land) {
    if (active.mode === 'window') return // 窓辺から直接は歩けない（空を経由）
    // いまの真下の安全な地点へ着地（建物/樹冠に埋もれないよう退避）し、街路の抜ける方を向く
    const [sx, sz] = active.resolveSpawn(active.flyPos.x, active.flyPos.z)
    active.flyPos.x = sx; active.flyPos.z = sz
    active.flyYaw = active.flyYawTarget = active.openYaw(sx, sz) // 壁や木を正面にせず、抜けのある方へ向き直る
    active.flyPitchTarget = -0.05 // 立って街路をそっと見渡す
    active.vel.set(0, 0, 0); active.moveX = 0; active.moveY = 0; active.bankCur = 0; active.turnSmooth = 0; active.camReady = false
    active.landedFired = false // 接地した瞬間に砂ぼこり＋沈み込みを起こす
    active.mode = 'walk'
    active.flyTarget = 1
  } else {
    setTown3dFly(true) // 歩きから空へ（飛び立つ）
  }
}

// この情景が浮遊/散策できるか（立体の街エンジンのときだけ）。UIのボタン表示判定に使う。
export function isTown3dFlyable() {
  return !!(active && active.flyEnabled)
}

// 設定（明るさ・描き込み品質）を3Dの街にも効かせる（従来は設定が3Dに無反応だった）。
export function setTown3dSettings(s) {
  if (!active || !s) return
  if (s.brightness != null && active.setBrightness) active.setBrightness(s.brightness)
  if (s.quality && active.setQuality) active.setQuality(s.quality)
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
  // 全建物の基礎（接地のコンクリ土台）を1メッシュに統合するためのジオメトリ結合ユーティリティ。
  const BufferGeometryUtils = await import('three/examples/jsm/utils/BufferGeometryUtils.js')
  if (my !== token) return

  const stage = document.createElement('div')
  stage.className = 'town3d-stage'
  parent.appendChild(stage)

  const W = stage.clientWidth || window.innerWidth
  const H = stage.clientHeight || window.innerHeight
  // 描き込み品質（設定/自動品質）でtown3dも重さを調整＝低性能端末の発熱・カクつきを抑える（従来は品質設定を無視していた）。
  const QUAL = opts.quality || 'standard'
  const LIGHT = QUAL === 'light'
  const PR_CAP = LIGHT ? 1.25 : QUAL === 'soft' ? 2 : 1.6
  const SHADOW_SIZE = LIGHT ? 1024 : 2048
  const renderer = new THREE.WebGLRenderer({ antialias: !LIGHT, alpha: false })
  let curPR = Math.min(window.devicePixelRatio || 1, PR_CAP)
  renderer.setPixelRatio(curPR)
  renderer.setSize(W, H)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap // PCFSoftShadowMapは非推奨で実際は自動でPCFに落ちる→明示してThree.jsの警告を消す（静的影なので見た目は同一）
  // 影を「一度だけ焼く」静的影に（太陽は固定＝建物/木の影は不変）。毎フレームの影パス（数百の投影体の再ラスタライズ）を撤廃して発熱を大きく下げる。動く車/人の影は捨てる（小さく目立たない）。
  renderer.shadowMap.autoUpdate = false
  stage.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const pal = opts.palette || {}
  const season = opts.season || 'summer' // 季節で地面・木の色を替える
  const weather = opts.weather || null    // 'snow' | 'petals' | 'leaves' | null（降るもの）
  const kind = opts.kind || 'town'        // 'town'（坂の街）| 'yato'（谷戸＝棚田と茅葺の屋敷）
  const onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : () => {} // 定期イベント発火を外へ伝える（音の結線）
  const onSpeed = typeof opts.onSpeed === 'function' ? opts.onSpeed : () => {} // 飛行速度(0..1)を外へ伝える（風音の膨らみ）
  const onFoot = typeof opts.onFoot === 'function' ? opts.onFoot : () => {} // 歩行で一歩ごとに伝える（足音）
  const onBirdFlush = typeof opts.onBirdFlush === 'function' ? opts.onBirdFlush : () => {} // 鳥が驚いて飛び立つ（羽音）
  const onAltitude = typeof opts.onAltitude === 'function' ? opts.onAltitude : () => {} // 飛行高度(0..1)を外へ伝える（高空で環境音をしぼる）
  const reduceMotion = !!opts.reduceMotion // 視差軽減: 突発・大きな動き（花火/気球/飛行機雲/流れ星等）の定期イベントを止める
  const skyTop = new THREE.Color(pal.skyTop || '#7fb0d8')
  const skyHorizon = new THREE.Color(pal.horizon || '#f2dcc0')
  const sunCol = new THREE.Color(pal.sunGlow || '#ffe6c2')
  // 空気遠近の霞（遠景を空色へやわらかく溶かす＝絵画的な奥行き。手前は鮮明）。雪は濃く冷たく。
  const fogCol = weather === 'snow'
    ? skyHorizon.clone().lerp(new THREE.Color(0xc8d2de), 0.5).getHex() // 雪霞は純白でなく淡い青灰に＝白飛びを止める（評価 美術-M5）
    : skyHorizon.clone().lerp(skyTop, 0.52).getHex() // 空色へ溶かす空気の層（俯瞰の霞）
  // 空気遠近の霞（調整可）: near=ここから霞み始める, far=ここで空に溶ける。手前へ寄せて遠景〜中景を
  // やわらかな大気に溶かし、「高台から街を眺める」水彩調の奥行きを出す（手前は鮮明に保つ）。
  // 雪は near を手前にし過ぎると街が真っ白に潰れる→少し奥へ（中景の階調を残す）。
  const FOG = { near: weather === 'snow' ? 40 : 30, far: weather === 'snow' ? 146 : 132 } // 大気遠近を一段深め、中景から空気に溶け始める水彩の奥行きへ（手前は鮮明に保つ）
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
  // 大気オーバーレイ(CSS)を「その情景の光」に同調させる。固定の暖色グローでなく、各情景の
  // 太陽/地平の色で空がにじみ、隅は空色を深く沈めた冷色で翳る＝どの時間帯でも“一つの光に
  // 包まれた一枚の絵”へ局所色をまとめる（水彩の最高到達点が持つ色の調和を低ポリ3Dにも与える）。
  {
    const rgbStr = (c) => `${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}`
    const shadeCol = skyTop.clone().lerp(new THREE.Color(0x0e0b14), 0.62) // 隅の翳り＝空色を深く沈めた冷色の影
    stage.style.setProperty('--t3d-glow', rgbStr(sunCol))
    stage.style.setProperty('--t3d-shade', rgbStr(shadeCol))
    // 統一ウォッシュの濃さ＝昼は控えめに暖色で空気を一枚に、夜/雪は弱める（白飛び・寒色の濁りを避ける）
    stage.style.setProperty('--t3d-wash-a', isNight ? '0.10' : weather === 'snow' ? '0.12' : '0.20')
  }
  // 光（やわらかなトゥーン陰影。夜は月明かりへ）
  const sun = new THREE.DirectionalLight(isNight ? 0xa8bbe4 : sunCol.getHex(), isNight ? 0.62 : 1.02) // 方向光を主役に＝セルの明部/影部をはっきり（線形トーン用に白飛び防止）
  sun.position.set(isNight ? 24 : -30, 42, isNight ? -16 : 20)
  sun.castShadow = true
  sun.shadow.mapSize.set(SHADOW_SIZE, SHADOW_SIZE) // 影は一度だけ焼く静的影なので高精細化してもコスト増ゼロ。light端末は1024に落として焼き負荷とメモリを抑える
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
    // ベタ白の円を脱す（評価 美術-M3）: わずかに暖色のクリーム＋柔らかなハロー（加算スプライト）で月らしく。
    const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 16), new THREE.MeshBasicMaterial({ color: 0xf6f1e2, fog: false }))
    moon.position.set(70, 90, -120); scene.add(moon)
    const mhc = document.createElement('canvas'); mhc.width = mhc.height = 64
    const mhx = mhc.getContext('2d'); const mhg = mhx.createRadialGradient(32, 32, 0, 32, 32, 32)
    mhg.addColorStop(0, 'rgba(244,242,232,0.62)'); mhg.addColorStop(0.4, 'rgba(214,224,240,0.26)'); mhg.addColorStop(1, 'rgba(214,224,240,0)')
    mhx.fillStyle = mhg; mhx.fillRect(0, 0, 64, 64)
    const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(mhc), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))
    moonHalo.position.copy(moon.position); moonHalo.scale.set(42, 42, 1); scene.add(moonHalo)
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
        .replace('#include <dithering_fragment>', '  float snowK = smoothstep(0.34, 0.74, normalize(vWNSnow).y);\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.88, 0.90, 0.95), snowK * 0.7);\n#include <dithering_fragment>')
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
    // 128pxへ拡張＝歩行・低空で近づいても窓が崩れない。サッシ枠・十字桟・窓台を描き、ベタ硝子の板を脱す。
    const S = 128
    const c = document.createElement('canvas'); c.width = c.height = S
    const g = c.getContext('2d')
    let s = seed * 2654435761
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
    if (lit) { g.fillStyle = '#000000'; g.fillRect(0, 0, S, S) }
    else {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S)
      // コンクリ/モルタルの微細なムラ（乗算なので暗いほど陰る＝のっぺり白を避ける）
      for (let i = 0; i < 360; i++) {
        const v = 206 + (rnd() * 49 | 0)
        g.fillStyle = `rgba(${v},${v},${v - 8},0.20)`
        g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 5, 1 + rnd() * 5)
      }
      // 縦の雨だれ筋（窓下から伸びる経年の汚れ＝建物のリアルさ）
      for (let k = 0; k < 13; k++) {
        const sx = rnd() * S
        g.fillStyle = `rgba(118,120,128,${0.05 + rnd() * 0.06})`
        g.fillRect(sx, rnd() * S * 0.4, 1.2 + rnd() * 1.4, S * (0.3 + rnd() * 0.5))
      }
    }
    // 窓の格子（3列×4段）。各窓にサッシ枠＋十字桟＋窓台を描く＝近接で「窓」と読める立体。
    for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 3; xx++) {
      const px = 16 + xx * 36, py = 14 + yy * 28, pw = 24, ph = 19
      if (lit) {
        const on = rnd() < 0.45
        g.fillStyle = on ? '#ffd089' : '#0a0a0a'
        g.fillRect(px, py, pw, ph)
        if (on) { // 灯った窓は十字桟が影で抜ける＝障子/サッシのシルエット
          g.fillStyle = 'rgba(40,28,12,0.55)'
          g.fillRect(px, py + ph * 0.5 - 0.7, pw, 1.4)
          g.fillRect(px + pw * 0.5 - 0.7, py, 1.4, ph)
        }
      } else {
        // サッシ枠（窓周りの一段明るい縁＝コンクリの窓台/見切り）
        g.fillStyle = 'rgba(238,236,232,0.9)'
        g.fillRect(px - 2, py - 2, pw + 4, ph + 4)
        // ガラス：上ほど空を映してやや明るく→下ほど室内で翳る縦グラデ＝硝子。窓ごとに寒暖を振る。
        const cool = rnd() < 0.5
        const grad = g.createLinearGradient(0, py, 0, py + ph)
        if (cool) { grad.addColorStop(0, '#90a0b2'); grad.addColorStop(1, '#586068') }
        else { grad.addColorStop(0, '#867f78'); grad.addColorStop(1, '#574f49') }
        g.fillStyle = grad
        g.fillRect(px, py, pw, ph)
        // 十字桟（上下・左右に割れて見える立体の窓）
        g.fillStyle = 'rgba(214,214,220,0.5)'
        g.fillRect(px, py + ph * 0.5 - 0.6, pw, 1.2)
        g.fillRect(px + pw * 0.5 - 0.6, py, 1.2, ph)
        // 上辺の空映りのハイライト＋窓台の影（下）＝窓がへこんで付いて見える
        g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(px, py, pw, 1.4)
        g.fillStyle = 'rgba(60,58,64,0.34)'; g.fillRect(px - 2, py + ph + 1.4, pw + 4, 2)
      }
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.magFilter = THREE.LinearFilter // 微細な壁質感を滑らかに（Nearestのブロック感を脱す）
    t.anisotropy = LIGHT ? 1 : 4 // 斜め見の壁面でも窓がにじまない（歩行・低空で効く）
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
  // 歩行時の当たり判定（円で近似）。建物の敷地＋木の幹を積む＝散策で建物を貫通せず、幹も避けて歩く。
  const colliders = []
  // 着地で避ける場所（建物＋木の樹冠）。樹冠は大きめ＝木に埋もれて降りない・壁ぎわで降りない。
  const spawnAvoid = []
  // 鎮守の森の神社（飛んでいく目的地のランドマーク）。街の左手の一角を空けて建てる。建物/木の生成で共用するので関数本体スコープに。
  const SHRINE = { x: -32, z: -18, r: 11 }
  // 川（街の左手の谷筋をz方向に流れる）。地形を掘って河床を作る＝飛んで川沿いを渡れる水辺のランドマーク。
  const RIVER = { x: -52, halfW: 2.6, bankW: 5.5, depth: 4 }
  // 駅（街の右手の一角）。商店街は中央の道沿い。人の集まる目的地。
  const STATION = { x: 34, z: -44, r: 10 }
  // 公園（街の中ほどの広場）。浅い池に空を映し、太鼓橋・桜・石灯籠・ベンチで憩う。飛んで降りる目的地。
  const PARK = { x: 16, z: -27, r: 12, pondR: 5.4, pondDepth: 2.4 }
  // 全建物の基礎（接地のコンクリ土台）。house() が積み、最後に1メッシュへ統合＝接地感を出しつつ1ドローコール。
  const plinthGeos = []
  // 接地階の入口（玄関/店先の戸）。前面に暗い戸口を差し、まとめて1メッシュへ＝歩くと“住んでいる街”に。
  const doorGeos = []

  // 谷のプロファイル: 手前(z>0)=自分の急な丘で高い → 谷底(z≈-30)で低い → 奥(z<-55)で向かいの丘・山が上がる。
  // 坂を7割登った高台から、谷へ下って広がる街を見下ろす立体感。
  // 棚田の段境界のうねり（x方向）。heightAt と畦の擁壁で共用＝段が等高線に沿って湾曲して整合する。
  const undX = (x) => Math.sin(x * 0.16) * 2.0 + Math.sin(x * 0.075 - 1.0) * 1.3
  const heightAt = (x, z) => {
    if (kind === 'yato') {
      // 谷戸の地形: 中央(|x|<13)が平らな谷底（棚田）、左右の里山が|x|で立ち上がり、奥で向かいの斜面が上がる。
      let base
      if (z > 6) base = (z - 6) * 0.6 + 1.5                       // 手前=自分の丘（カメラ側ほど高い）
      // 谷底＝手前から奥へ段々に下る棚田。段の境界を x でうねらせ「等高線に沿う有機的な段」へ（剛体の横縞を脱す＝評価指摘）。
      else if (z > -46) base = -1.6 - Math.floor(((4 - z) + undX(x)) / 5.6) * 0.42 + Math.sin(z * 0.08) * 0.1
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
    // 川の谷を掘る（x=RIVER.x を中心になだらかに沈める＝河床）。護岸が水際の段を作るので地面は緩やかでよい。
    const rd = Math.max(0, 1 - Math.abs(x - RIVER.x) / RIVER.bankW)
    const dip = Math.pow(rd, 1.5) * RIVER.depth
    // 公園の池を掘る（PARK中心の浅い円い窪み）。石組みの縁で水際の段を作る。
    const pd = Math.max(0, 1 - Math.hypot(x - PARK.x, z - PARK.z) / PARK.pondR)
    const pondDip = Math.pow(pd, 1.6) * PARK.pondDepth
    return vy + bump - dip - pondDip
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
    const g = new THREE.PlaneGeometry(280, 300, 96, 104) // 川の谷を滑らかに出すため分割を上げる
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
    const rcol = []
    for (let i = 0; i < rp.count; i++) {
      const lx = rp.getX(i), lz = rp.getZ(i)
      rp.setY(i, heightAt(lx, lz - 35) + 0.07)
      // 低周波の路面の濃淡（補修跡・日焼け・轍の汚れ）。テクスチャの反復に乗らない地形ベースの長い
      // うねりで、のっぺり灰の平面を脱して「使い込まれた路面」に（俯瞰で効く）。
      const m = 0.9 + 0.15 * Math.sin(lz * 0.16 + 1.3) + 0.08 * Math.sin(lz * 0.43 + lx)
      rcol.push(m, m, m)
    }
    rg.setAttribute('color', new THREE.Float32BufferAttribute(rcol, 3))
    rg.computeVertexNormals()
    // 舗装テクスチャ: アスファルトのムラ＋黄色のセンターライン（破線）＋路肩線（実写の路面標示。メッシュ増なし）
    const rtc = document.createElement('canvas'); rtc.width = 64; rtc.height = 256
    const rtx = rtc.getContext('2d')
    rtx.fillStyle = '#474750'; rtx.fillRect(0, 0, 64, 256)
    for (let i = 0; i < 70; i++) { const v = 58 + ((R() * 34) | 0); rtx.fillStyle = `rgba(${v},${v},${v + 5},0.16)`; rtx.fillRect(R() * 64, R() * 256, 2 + R() * 7, 2 + R() * 12) }
    rtx.fillStyle = 'rgba(206,196,150,0.55)'; for (let y = 0; y < 256; y += 44) rtx.fillRect(31, y + 8, 3, 22) // 黄色のセンターライン（破線）
    rtx.fillStyle = 'rgba(198,198,198,0.26)'; rtx.fillRect(6, 0, 2, 256); rtx.fillRect(56, 0, 2, 256) // 路肩線
    const roadTex = new THREE.CanvasTexture(rtc); roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping; roadTex.repeat.set(1, 8)
    const road = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ map: roadTex, vertexColors: true }))
    road.position.z = -35; road.receiveShadow = true; town.add(road)
    // 縁石（道の両肩）。短い箱を地形に沿って並べ1メッシュへ統合＝歩くと路肩が立ち、街路が地に着く。
    {
      const curbGeos = []
      for (const sideC of [-1, 1]) {
        for (let z = 28; z > -98; z -= 2.4) {
          const cx = sideC * 3.95, cy = heightAt(cx, z) + 0.11
          const seg = new THREE.BoxGeometry(0.34, 0.22, 2.5)
          seg.applyMatrix4(new THREE.Matrix4().makeTranslation(cx, cy, z))
          curbGeos.push(seg)
        }
      }
      if (BufferGeometryUtils.mergeGeometries) {
        const cm = BufferGeometryUtils.mergeGeometries(curbGeos, false)
        if (cm) { const curb = new THREE.Mesh(cm, toon(season === 'winter' ? 0xc4c0b6 : 0xb6b0a4)); curb.receiveShadow = true; town.add(curb) }
      }
      curbGeos.forEach((g) => g.dispose())
    }
    // カーブミラー（曲がり角の凸面鏡）＝日本の生活道路の象徴。ポール＋橙の枠＋淡い鏡面。
    {
      const mPole = toon(0x8f8f8f), mRing = toon(0xcf7a2e), mGlass = toon(0xc2ccd2)
      for (const [mx, mz] of [[4.8, 7], [-4.8, -13], [5.3, -31], [-5.1, -49], [4.9, -67], [-5.0, 19]]) {
        const gym = heightAt(mx, mz), grp = new THREE.Group()
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 2.7, 6), mPole); pole.position.y = 1.35; grp.add(pole)
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 6, 16), mRing); ring.position.y = 2.55; grp.add(ring)
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.37, 16), mGlass); disc.position.set(0, 2.55, 0.03); grp.add(disc)
        grp.position.set(mx, gym, mz); grp.rotation.y = mx > 0 ? -0.6 : 0.6; town.add(grp)
      }
    }
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
    // 停止線（横断歩道の手前の白い太線＝交差点の標示）
    const stopMat = new THREE.MeshLambertMaterial({ color: 0xd2cec4 })
    for (const sz of [-7.4, -29.4, -51.4]) {
      const sl = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.03, 0.42), stopMat)
      sl.position.set(0, heightAt(0, sz) + 0.085, sz); town.add(sl)
    }
    // 側溝（縁石の内側の暗いコンクリ溝＝路肩の締まり）。地形に沿わせ1メッシュへ統合。
    {
      const gutGeos = []
      for (const sideU of [-1, 1]) {
        for (let z = 28; z > -98; z -= 2.4) {
          const gx = sideU * 3.55, gy3 = heightAt(gx, z)
          const seg = new THREE.BoxGeometry(0.42, 0.05, 2.5)
          seg.applyMatrix4(new THREE.Matrix4().makeTranslation(gx, gy3 + 0.065, z))
          gutGeos.push(seg)
        }
      }
      if (BufferGeometryUtils.mergeGeometries) {
        const gum = BufferGeometryUtils.mergeGeometries(gutGeos, false)
        if (gum) { const gutter = new THREE.Mesh(gum, toon(0x6e6c68)); gutter.receiveShadow = true; town.add(gutter) }
      }
      gutGeos.forEach((g) => g.dispose())
    }
  }

  // ── 建物・ランドマーク（低ポリの箱＋切妻屋根）。街のみ（谷戸では作らない）。 ──
  if (kind !== 'yato') {
  // 壁色は全て淡い同系ベージュだと俯瞰で街が「均一な箱の群れ」に見える（屋根は色幅があるのに壁が単調）。
  // 色相（青灰・セージ・くすんだテラコッタ）と明度（暗めのアンカー数棟＋オフ白）に幅を出す。
  // 全て低彩度に抑え、共通グレードで街全体が一つの空気にまとまる前提（彩度はグレードが整える）。
  const wallCols = [
    0xd8cfbf, // 温かい白灰
    0xcec0af, // ベージュ
    0xc2b4a4, // 温かいトープ
    0xbcc0b6, // 灰緑
    0xaab2b8, // 淡い青灰（寒色の変化＝日本家屋のサイディング/瓦）
    0xb6a892, // 深いトープ（やや暗く＝明度の幅で街を締める）
    0xcabb9f, // クリームタン
    0xa9a094, // 中明度の灰褐（暗部のアンカー）
    0xc7a695, // くすんだテラコッタ（暖色の差し色・ごく控えめ）
    0xa7b09c, // くすんだセージ（緑がかった壁）
    0xe2ddd0, // オフホワイト（明るい壁＝明度の上側）
  ]
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
    // 屋根の向きを散らす（碁盤の同一方向を崩す）。多くは街路にゆるく沿い、時々大きく振れて棟の向きが変わる。
    g.rotation.y = R() < 0.26 ? (R() - 0.5) * 1.5 : (R() - 0.5) * 0.5
    town.add(g)
    const foot = (w + d) * 0.25 + 0.5
    colliders.push({ x, z, r: foot })        // 歩行の当たり判定（敷地を円で近似＋人の半径）
    spawnAvoid.push({ x, z, r: foot + 1.0 }) // 着地は壁ぎわを避けて少し離れて降りる
    // 基礎（接地のコンクリ土台）。壁より一回り広く低い帯を建物の足元に。回転・位置を焼き込んで後で統合。
    const plH = 0.45
    const pg = new THREE.BoxGeometry(w * 1.06, plH, d * 1.06)
    pg.applyMatrix4(new THREE.Matrix4().makeTranslation(0, plH / 2, 0))
    pg.applyMatrix4(new THREE.Matrix4().makeRotationY(g.rotation.y))
    pg.applyMatrix4(new THREE.Matrix4().makeTranslation(x, gy, z))
    plinthGeos.push(pg)
    // 接地階の戸口（前面 +z 面に暗いパネル）。回転・位置を焼き込んで後で統合。
    if (h > 2.6) {
      const dw = type === 'house' ? 0.92 : 1.3, dh = type === 'house' ? 1.9 : 2.15
      const dg = new THREE.BoxGeometry(dw, dh, 0.07)
      dg.applyMatrix4(new THREE.Matrix4().makeTranslation((R() - 0.5) * w * 0.42, dh / 2 + 0.02, d / 2 + 0.04))
      dg.applyMatrix4(new THREE.Matrix4().makeRotationY(g.rotation.y))
      dg.applyMatrix4(new THREE.Matrix4().makeTranslation(x, gy, z))
      doorGeos.push(dg)
    }
  }

  // 街区をばらまく（奥へ広がる坂の街。手前中央は道＝視界が抜ける）。等間隔の碁盤に見えないよう、
  // 格子からの揺らぎを大きめに取り、区画の大きさも独立に振って、見下ろしの「市松の屋根」を崩す。
  for (let zi = -13; zi <= 2; zi++) {
    for (let xi = -9; xi <= 9; xi++) {
      if (Math.abs(xi) < 1.6 && zi > -3) continue // 手前中央は道（街を見通す抜け）
      if (R() < 0.12) continue // 空地・駐車場・庭で時々抜く（碁盤の規則性を崩す）
      if (zi < -11 && R() < 0.42) continue // 最奥の列は疎に（遠景の点描・性能の余裕を残す）
      const x = xi * 9 + (R() - 0.5) * 5.4 // 格子からの揺らぎを大きく（隣と不揃いに寄る＝密集の自然さ）
      const z = zi * 9 + (R() - 0.5) * 5.4
      if (Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.r) continue // 神社の境内は空ける
      if (Math.abs(x - RIVER.x) < RIVER.bankW + 2) continue // 川筋は空ける
      if (Math.hypot(x - STATION.x, z - STATION.z) < STATION.r) continue // 駅前は空ける
      if (Math.hypot(x - PARK.x, z - PARK.z) < PARK.r) continue // 公園の広場は空ける
      const far = (zi + 13) / 15 // 0=奥 1=手前
      // 敷地の大小を独立に・広めに振る（同寸の屋根が並ぶ均質感を崩す。時々大きな町工場/団地の塊）
      const big = R() < 0.12 ? 1.7 : 1.0
      const w = (lerp(3.0, 5.2, far) + R() * 2.4) * big
      const d = (lerp(3.0, 5.2, far) + R() * 2.4) * (big > 1.0 ? 0.7 + R() * 0.6 : 1.0)
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

  // ── 全建物の基礎（接地のコンクリ土台）を1メッシュに統合＝足元が地に着く（俯瞰では薄く・歩行で効く）。──
  if (plinthGeos.length && BufferGeometryUtils.mergeGeometries) {
    const merged = BufferGeometryUtils.mergeGeometries(plinthGeos, false)
    if (merged) {
      const plinth = new THREE.Mesh(merged, toon(season === 'winter' ? 0x9a978f : 0x8a8278)) // くすんだコンクリ色
      plinth.receiveShadow = true; plinth.castShadow = false; town.add(plinth)
    }
    plinthGeos.forEach((g) => g.dispose()) // 統合済みの素片は解放
    const dmerged = doorGeos.length && BufferGeometryUtils.mergeGeometries(doorGeos, false)
    if (dmerged) { const doors = new THREE.Mesh(dmerged, toon(0x40382f)); doors.receiveShadow = true; town.add(doors) } // 暗い戸口（玄関/店先）
    doorGeos.forEach((g) => g.dispose())
  }

  // ── 川（街の左手の谷筋）。空を映す水面＋護岸＋橋＝飛んで川沿いを渡れる水辺のランドマーク。──
  {
    const rx = RIVER.x
    const waterLevel = (z) => heightAt(rx, z) + RIVER.depth - 1.2 // 河床(掘った底)から少し上＝水位
    // 水面（空を映す水鏡。MeshToonの空グラデで白飛びを防ぐ）。zに沿って河床のうねりに合わせる。
    const wc = document.createElement('canvas'); wc.width = wc.height = 64; const wcx = wc.getContext('2d')
    const wg = wcx.createLinearGradient(0, 0, 0, 64)
    wg.addColorStop(0, '#' + new THREE.Color(0x6ea2c4).lerp(skyTop, 0.34).getHexString())
    wg.addColorStop(1, '#' + new THREE.Color(0x46708e).lerp(skyHorizon, 0.18).getHexString())
    wcx.fillStyle = wg; wcx.fillRect(0, 0, 64, 64)
    const wsg = wcx.createLinearGradient(20, 64, 44, 0)
    wsg.addColorStop(0, 'rgba(255,255,255,0)'); wsg.addColorStop(0.5, '#' + sunCol.clone().lerp(new THREE.Color(0xffffff), 0.2).getHexString()); wsg.addColorStop(1, 'rgba(255,255,255,0)')
    wcx.globalAlpha = 0.4; wcx.fillStyle = wsg; wcx.fillRect(0, 0, 64, 64); wcx.globalAlpha = 1
    for (let i = 0; i < 40; i++) { wcx.fillStyle = `rgba(255,255,255,${0.05 + R() * 0.05})`; wcx.fillRect(R() * 64, R() * 64, 1 + R() * 2, 1) } // さざ波
    const wtex = new THREE.CanvasTexture(wc); wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.repeat.set(1, 10)
    const wgeo = new THREE.PlaneGeometry(RIVER.halfW * 2, 130, 1, 80); wgeo.rotateX(-Math.PI / 2)
    const wp = wgeo.attributes.position
    for (let i = 0; i < wp.count; i++) wp.setY(i, waterLevel(wp.getZ(i) - 36)) // mesh は z=-36 中心
    wgeo.computeVertexNormals()
    const water = new THREE.Mesh(wgeo, new THREE.MeshToonMaterial({ color: 0xffffff, map: wtex, gradientMap: grad, fog: true }))
    water.position.set(rx, 0, -36); water.receiveShadow = true; town.add(water)
    // 護岸（水際の左右のコンクリ壁。天端は堤の肩＝grade、底は水面下。地形に沿わせ1メッシュへ）
    const bankGeos = []
    for (const side of [-1, 1]) {
      for (let z = 28; z > -98; z -= 2.4) {
        const bx = rx + side * (RIVER.halfW + 0.2)
        const top = heightAt(rx + side * (RIVER.bankW + 0.8), z), bottom = waterLevel(z) - 1.0
        const hgt = Math.max(0.8, top - bottom)
        const seg = new THREE.BoxGeometry(0.5, hgt, 2.5)
        seg.applyMatrix4(new THREE.Matrix4().makeTranslation(bx, bottom + hgt / 2, z))
        bankGeos.push(seg)
      }
    }
    if (BufferGeometryUtils.mergeGeometries) { const bm = BufferGeometryUtils.mergeGeometries(bankGeos, false); if (bm) { const banks = new THREE.Mesh(bm, toon(0x908c84)); banks.receiveShadow = true; banks.castShadow = true; town.add(banks) } }
    bankGeos.forEach((g) => g.dispose())
    // 橋（川を渡る一本）。デッキ＋欄干＋橋脚。橋面は grade（堤の肩）に合わせる。
    const bz = -16, bTop = heightAt(rx, bz) + RIVER.depth
    const deck = new THREE.Mesh(new THREE.BoxGeometry(RIVER.halfW * 2 + 4.4, 0.4, 4), toon(0x9a958c)); deck.position.set(rx, bTop, bz); deck.castShadow = true; deck.receiveShadow = true; town.add(deck)
    for (const rs of [-1.8, 1.8]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(RIVER.halfW * 2 + 4.4, 0.5, 0.16), toon(0xb0a48a)); rail.position.set(rx, bTop + 0.45, bz + rs); town.add(rail) }
    for (const ps of [-RIVER.halfW, RIVER.halfW]) { const pier = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.6), toon(0x7a766e)); pier.position.set(rx + ps, bTop - 2, bz); pier.castShadow = true; town.add(pier) }
  }

  // ── 商店街ゲート（中央の道の入口に架かるアーチ看板）＋提灯。人の集まる通りの象徴。──
  {
    const gz = -12, gy = heightAt(0, gz)
    const gateMat = toon(0x4a7a5e), lightMat = new THREE.MeshBasicMaterial({ color: 0xffce86 })
    const grp = new THREE.Group(); grp.position.set(0, gy, gz); town.add(grp)
    for (const gx of [-4.3, 4.3]) { const pil = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.2, 0.5), gateMat); pil.position.set(gx, 2.6, 0); pil.castShadow = true; grp.add(pil) }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.6, 0.7), gateMat); beam.position.set(0, 5.3, 0); beam.castShadow = true; grp.add(beam)
    // 看板（商店街名のバナー）
    const bc = document.createElement('canvas'); bc.width = 256; bc.height = 64
    const bx2 = bc.getContext('2d'); bx2.fillStyle = '#3c6650'; bx2.fillRect(0, 0, 256, 64); bx2.strokeStyle = '#e8e0c8'; bx2.lineWidth = 4; bx2.strokeRect(3, 3, 250, 58)
    bx2.fillStyle = '#f4efe0'; bx2.font = 'bold 34px sans-serif'; bx2.textAlign = 'center'; bx2.textBaseline = 'middle'; bx2.fillText('しょうてんがい', 128, 36)
    const banner = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.1, 0.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc) })); banner.position.set(0, 4.35, 0.22); grp.add(banner)
    for (let i = -3; i <= 3; i++) { const lt = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), lightMat); lt.position.set(i * 1.3, 5.75, 0); grp.add(lt) } // アーチ上の灯り
    // 提灯（赤い提灯を通り沿いに連ねる）
    const lantMat = toon(0xc23a2e), capMat = toon(0x2a2622)
    for (const lx of [-2.9, 2.9]) for (let z = -15; z > -40; z -= 3.0) {
      const lan = new THREE.Group(); lan.position.set(lx, heightAt(lx, z) + 3.8, z)
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 10), lantMat); body.scale.y = 1.15; lan.add(body)
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 0.1, 8), capMat); cap.position.y = 0.33; lan.add(cap)
      town.add(lan)
    }
  }

  // ── 駅（街の右手。人の集まる目的地。駅舎＋ホーム＋駅名標＋短い線路）。──
  {
    const stx = STATION.x, stz = STATION.z, sy = heightAt(stx, stz)
    const grp = new THREE.Group(); grp.position.set(stx, sy, stz); town.add(grp)
    const wallMat = toon(0xd8d0be), roofMat = toon(0x6a4e44), platMat = toon(0xb8b2a6), railMat = toon(0x55555c)
    const body = new THREE.Mesh(new THREE.BoxGeometry(7, 3.4, 5), wallMat); body.position.set(0, 1.7, 0); body.castShadow = true; body.receiveShadow = true; grp.add(body); grp.add(addOutline(body))
    const rg = new THREE.CylinderGeometry(2.9, 2.9, 7.4, 3, 1); rg.rotateZ(Math.PI / 2); rg.rotateY(Math.PI / 2)
    const roof = new THREE.Mesh(rg, roofMat); roof.position.set(0, 3.7, 0); roof.scale.set(1, 0.7, 1.15); roof.castShadow = true; grp.add(roof)
    const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16), new THREE.MeshBasicMaterial({ color: 0xf0ead8 })); clock.rotation.x = Math.PI / 2; clock.position.set(0, 2.9, 2.55); grp.add(clock) // 駅の時計
    const plat = new THREE.Mesh(new THREE.BoxGeometry(13, 0.6, 3), platMat); plat.position.set(0, 0.3, -5.2); plat.receiveShadow = true; grp.add(plat) // ホーム
    for (const px of [-5, 0, 5]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 6), toon(0x8a8680)); post.position.set(px, 1.9, -5.2); grp.add(post) } // ホーム上屋の柱
    const proof = new THREE.Mesh(new THREE.BoxGeometry(13, 0.16, 3.2), toon(0x9a9690)); proof.position.set(0, 3.2, -5.2); proof.castShadow = true; grp.add(proof)
    // 駅名標（ホームの看板）
    const nc = document.createElement('canvas'); nc.width = 128; nc.height = 48
    const ncx = nc.getContext('2d'); ncx.fillStyle = '#f4efe4'; ncx.fillRect(0, 0, 128, 48); ncx.fillStyle = '#3a6a4a'; ncx.fillRect(0, 38, 128, 10)
    ncx.fillStyle = '#2a3a4a'; ncx.font = 'bold 26px sans-serif'; ncx.textAlign = 'center'; ncx.textBaseline = 'middle'; ncx.fillText('みなみ', 64, 20)
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(nc) })); sign.position.set(-2, 2.1, -3.9); grp.add(sign)
    for (const sp of [-3, -1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 6), toon(0x8a8680)); post.position.set(sp, 0.85, -3.9); grp.add(post) }
    // 線路（枕木＋2本のレール。ホームの外側に短く）
    const sleepGeos = [], railGeos = []
    for (let t = -6.5; t <= 6.5; t += 0.9) { const sl = new THREE.BoxGeometry(2.6, 0.12, 0.4); sl.applyMatrix4(new THREE.Matrix4().makeTranslation(t, 0.06, -7.4)); sleepGeos.push(sl) }
    for (const rr of [-0.8, 0.8]) { const ra = new THREE.BoxGeometry(13, 0.1, 0.12); ra.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0.16, -7.4 + rr)); railGeos.push(ra) }
    if (BufferGeometryUtils.mergeGeometries) {
      const sm = BufferGeometryUtils.mergeGeometries(sleepGeos, false); if (sm) grp.add(new THREE.Mesh(sm, toon(0x5e554a)))
      const rm = BufferGeometryUtils.mergeGeometries(railGeos, false); if (rm) grp.add(new THREE.Mesh(rm, railMat))
    }
    sleepGeos.concat(railGeos).forEach((g) => g.dispose())
    colliders.push({ x: stx, z: stz, r: 4 }) // 歩行: 駅舎には入らない
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

  // ── 隣室の壁（角部屋の右手の高層マンションの壁面）。右へ見回すと迫り出して街を遮る＝角部屋にいる手応え。kind:'corner'のみ。 ──
  if (kind === 'corner') {
    const nwMat = toon(0xb4b0a6)
    const rep = 7
    const nm = winMapBase.clone(); nm.repeat.set(rep, rep * 1.5); nm.needsUpdate = true; nwMat.map = nm
    if (duskAmt > 0.12) { // 夕/夜は隣室の窓も灯る
      const ne = winEmis[(R() * winEmis.length) | 0].clone(); ne.repeat.set(rep, rep * 1.5); ne.needsUpdate = true
      nwMat.emissiveMap = ne; nwMat.emissive = new THREE.Color(0xffcaa0); nwMat.emissiveIntensity = 0.3 + duskAmt * 0.6
    }
    const wall = new THREE.Mesh(new THREE.BoxGeometry(3.5, 58, 44), nwMat)
    wall.position.set(15.5, 18, 9); wall.castShadow = true; wall.receiveShadow = true; scene.add(wall)
    const gap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 58, 44), toon(0x2a2722)); gap.position.set(13.55, 18, 9); scene.add(gap) // 壁との間の暗い路地＝奥行き
  }

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
    const r = 1.6 + R() * 1.4
    const ci = (R() * leafBaseMats.length) | 0 // 木ごとの「種」（下＝陰色／上＝陽色の対を揃える）
    const det = scale > 1.4 ? 2 : 1 // 近景の大木だけ細分を上げて輪郭を丸く（奥は1=軽量）
    // 樹形のばらつき＝同形のロリポップ畑を脱す（評価 美術-H3）。縦長(杉檜風)/横広(落葉樹の傘)/標準を振る。
    const form = R()
    const tall = form > 0.68, broad = form < 0.28
    const trunkH = tall ? 3.0 : broad ? 1.7 : 2.3
    const ax = broad ? 1.32 : tall ? 0.72 : 1.06           // 樹冠の横倍率
    const ay = tall ? 1.5 : broad ? 0.74 : 0.9 + R() * 0.16 // 樹冠の縦倍率
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.36, trunkH, det > 1 ? 9 : 6), trunkMat)
    tr.position.y = trunkH / 2; tr.castShadow = true; g.add(tr)
    // 主房（陰の濃色）を縦長/横広に変形＝輪郭を木ごとに変える。
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, det), leafBaseMats[ci])
    leaf.position.y = trunkH + r * ay * 0.5; leaf.scale.set(ax, ay, ax); leaf.castShadow = true; g.add(leaf)
    // 房を上＋横へ不規則に重ねる（陽の淡色／陰の濃色を交互）＝樹冠の不整形・綿玉脱却。
    // 近景の額装木立は房を多く（豊か）、奥の木は1〜2に抑える（霞むので軽量＝ドローコール削減）。
    // 近景の大木は房を増やして不整形の豊かな樹冠に（歩いて見上げる木が綿玉にならない）。奥は軽量に据え置き。
    const nC = scale > 1.4 ? 3 + ((R() * 2) | 0) : 1 + (R() < 0.45 ? 1 : 0)
    for (let k = 0; k < nC; k++) {
      const cr = r * (0.44 + R() * 0.42)
      const cl = new THREE.Mesh(new THREE.IcosahedronGeometry(cr, det), (k % 2 ? leafHiMats : leafBaseMats)[ci])
      cl.position.set((R() - 0.5) * r * ax * 1.5, trunkH + r * ay * (0.42 + (k + 1) / (nC + 1) * 0.95), (R() - 0.4) * r * ax * 1.1)
      cl.scale.setScalar(0.85 + R() * 0.3); cl.castShadow = true; g.add(cl)
    }
    g.position.set(x, gy, z); g.scale.setScalar(scale); town.add(g)
    g.userData = { ph: R() * 6.28, amp: 0.02 + R() * 0.02, tilt: (R() - 0.5) * 0.12 } // わずかな基準傾き＝不揃いの自然さ
    g.rotation.z = g.userData.tilt
    colliders.push({ x, z, r: scale * 0.35 + 0.3 })   // 歩行: 幹だけ避ける（樹冠の下はくぐれる）
    spawnAvoid.push({ x, z, r: scale * 1.7 + 0.5 })   // 着地: 樹冠に埋もれて降りない
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
    for (let i = 0; i < 165; i++) {
      const x = (R() - 0.5) * 168, z = -118 + R() * 152
      if (Math.abs(x) < 4.5 && z > -2) continue          // 手前中央の道は空ける
      if (Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.r) continue // 神社の境内は専用の木立で囲む
      if (Math.abs(x - RIVER.x) < RIVER.bankW + 1) continue // 川筋は空ける（水際の木は別途）
      if (Math.hypot(x - STATION.x, z - STATION.z) < STATION.r - 2) continue // 駅前は空ける
      if (Math.hypot(x - PARK.x, z - PARK.z) < PARK.r - 1) continue // 公園は専用の木立で囲む
      tree(x, z, 0.7 + R() * 0.8)
    }
    // 手前の縁の大きな木立（窓の下辺を額装する近景＝奥行きの起点）
    for (const c of [[-12, 20], [13, 21], [-18, 16], [18, 18]]) tree(c[0], c[1], 1.7 + R() * 0.5)

    // ── 鎮守の森の神社（飛んでいく目的地のランドマーク）。鳥居・社・石段・灯籠＋囲む木立。──
    {
      const sx = SHRINE.x, sz = SHRINE.z, baseY = heightAt(sx, sz)
      const woodMat = toon(0x8a6a48), vermilion = toon(0xc1442e), stoneMat = toon(0x9a958c), roofMat = toon(0x55585e)
      const grp = new THREE.Group(); grp.position.set(sx, baseY, sz); grp.rotation.y = Math.atan2(-sx, -sz) // 参道(+z)を街の中心へ向ける
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9, 1.4, 24), stoneMat); plat.position.y = 0.2; plat.receiveShadow = true; grp.add(plat) // 石の基壇
      const body = new THREE.Mesh(new THREE.BoxGeometry(5, 2.6, 3.8), woodMat); body.position.set(0, 2.2, -3.5); body.castShadow = true; grp.add(body) // 拝殿
      const rg = new THREE.CylinderGeometry(2.5, 2.5, 6, 3, 1); rg.rotateZ(Math.PI / 2); rg.rotateY(Math.PI / 2)
      const roof = new THREE.Mesh(rg, roofMat); roof.position.set(0, 3.9, -3.5); roof.scale.set(1, 0.78, 1.15); roof.castShadow = true; grp.add(roof); grp.add(addOutline(roof)) // 切妻屋根
      for (const px of [-2.3, 2.3]) { const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 5.2, 10), vermilion); pil.position.set(px, 3.5, 5.2); pil.castShadow = true; grp.add(pil) } // 鳥居の柱
      const kasagi = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.55, 0.8), vermilion); kasagi.position.set(0, 6.0, 5.2); kasagi.castShadow = true; grp.add(kasagi)
      const nuki = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.34, 0.42), vermilion); nuki.position.set(0, 5.0, 5.2); grp.add(nuki)
      for (let s = 0; s < 4; s++) { const st = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 0.7), stoneMat); st.position.set(0, 0.78 - s * 0.16, 6.6 + s * 0.7); st.receiveShadow = true; grp.add(st) } // 石段
      for (const lx of [-2.7, 2.7]) { // 灯籠×2
        const lan = new THREE.Group(); lan.position.set(lx, 0.9, 2.2)
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.5, 8), stoneMat)
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.2, 8), stoneMat); post.position.y = 0.85
        const fire = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.62), duskAmt > 0.2 ? new THREE.MeshBasicMaterial({ color: 0xffce86 }) : toon(0xb0a890)); fire.position.y = 1.7 // 火袋（夕夜はほのかに灯る）
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.42, 4), stoneMat); cap.rotation.y = Math.PI / 4; cap.position.y = 2.12
        for (const m of [foot, post, fire, cap]) { m.castShadow = true; lan.add(m) }
        grp.add(lan)
      }
      town.add(grp)
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, rr = 7.5 + R() * 3.5; tree(sx + Math.cos(a) * rr, sz + Math.sin(a) * rr, 1.5 + R() * 0.8) } // 鎮守の森
      colliders.push({ x: sx, z: sz - 3.5, r: 3.2 }) // 歩行: 社殿には入らない
    }

    // ── 公園（街の中ほどの広場）。空を映す池＋太鼓橋＋桜・石灯籠・ベンチ＝飛んで降りて憩う水辺の広場。──
    {
      const px0 = PARK.x, pz0 = PARK.z, pondR = PARK.pondR
      const pondGround = heightAt(px0, pz0) + PARK.pondDepth // 掘る前の中心地面
      const waterY = pondGround - 0.7
      const stoneMat = toon(0x9a958c), woodMat = toon(0x8a6a48)
      // 水面（空を映す水鏡。MeshToonの空グラデで白飛びを防ぐ）。池なので淡くおだやかに。
      const pc = document.createElement('canvas'); pc.width = pc.height = 64; const pcx = pc.getContext('2d')
      const pg = pcx.createLinearGradient(0, 0, 0, 64)
      pg.addColorStop(0, '#' + new THREE.Color(0x7aa6c4).lerp(skyTop, 0.4).getHexString())
      pg.addColorStop(1, '#' + new THREE.Color(0x4f748e).lerp(skyHorizon, 0.22).getHexString())
      pcx.fillStyle = pg; pcx.fillRect(0, 0, 64, 64)
      for (let i = 0; i < 30; i++) { pcx.fillStyle = `rgba(255,255,255,${0.04 + R() * 0.05})`; pcx.fillRect(R() * 64, R() * 64, 1 + R() * 2, 1) } // さざ波
      const ptex = new THREE.CanvasTexture(pc)
      const pondGeo = new THREE.CircleGeometry(pondR + 0.1, 36); pondGeo.rotateX(-Math.PI / 2)
      const pond = new THREE.Mesh(pondGeo, new THREE.MeshToonMaterial({ color: 0xffffff, map: ptex, gradientMap: grad, fog: true }))
      pond.position.set(px0, waterY, pz0); pond.receiveShadow = true; town.add(pond)
      // 石組みの縁（地形に沿って水際に段を作る＝池の輪郭がはっきりする。不揃いの石を1メッシュへ）。
      const rimGeos = []
      for (let i = 0; i < 42; i++) {
        const a = i / 42 * 6.283 + R() * 0.05
        const rr = pondR + 0.25 + (R() - 0.5) * 0.5
        const rx2 = px0 + Math.cos(a) * rr, rz2 = pz0 + Math.sin(a) * rr
        const top = heightAt(rx2, rz2), bottom = waterY - 0.8
        const h = Math.max(0.5, top - bottom), s = 0.7 + R() * 0.5
        const seg = new THREE.BoxGeometry(s, h, s); seg.rotateY(R())
        seg.applyMatrix4(new THREE.Matrix4().makeTranslation(rx2, bottom + h / 2, rz2))
        rimGeos.push(seg)
      }
      if (BufferGeometryUtils.mergeGeometries) { const rm = BufferGeometryUtils.mergeGeometries(rimGeos, false); if (rm) { const rim = new THREE.Mesh(rm, stoneMat); rim.castShadow = true; rim.receiveShadow = true; town.add(rim) } }
      rimGeos.forEach((g) => g.dispose())
      // 太鼓橋（池に架かる朱の反り橋）。円弧に沿う板＋欄干。span を池より少し長く取り両岸に乗せる。
      {
        const deckMat = toon(0xc24a33), span = pondR * 2 + 2.8, archH = 1.6, baseLift = 0.7, N = 13, width = 2.2
        const grp = new THREE.Group(); grp.position.set(px0, 0, pz0); town.add(grp)
        for (let i = 0; i < N; i++) {
          const t = i / (N - 1)
          const lx = (t - 0.5) * span
          const ly = waterY + baseLift + archH * Math.sin(Math.PI * t)
          const ang = Math.atan2(archH * Math.PI * Math.cos(Math.PI * t), span) // 円弧の接線の傾き
          const plank = new THREE.Mesh(new THREE.BoxGeometry(span / (N - 1) * 1.25, 0.28, width), deckMat)
          plank.position.set(lx, ly, 0); plank.rotation.z = -ang; plank.castShadow = true; plank.receiveShadow = true; grp.add(plank)
          if (i % 2 === 0) for (const rs of [-1, 1]) { // 欄干の親柱
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), deckMat); post.position.set(lx, ly + 0.35, rs * (width / 2 - 0.12)); grp.add(post)
          }
        }
        for (const rs of [-1, 1]) for (let i = 0; i < N - 1; i++) { // 欄干の手すり（弧に沿う）
          const t = (i + 0.5) / (N - 1), lx = (t - 0.5) * span
          const ly = waterY + baseLift + archH * Math.sin(Math.PI * t) + 0.58
          const ang = Math.atan2(archH * Math.PI * Math.cos(Math.PI * t), span)
          const rail = new THREE.Mesh(new THREE.BoxGeometry(span / (N - 1) * 1.2, 0.12, 0.12), deckMat)
          rail.position.set(lx, ly, rs * (width / 2 - 0.12)); rail.rotation.z = -ang; grp.add(rail)
        }
      }
      // 桜（淡紅の花房。緑の木立に色を差す）。橋の線（x軸）を避けて配置。
      for (const c of [[px0 - 6.5, pz0 + 5.5], [px0 + 6, pz0 - 6], [px0 - 5, pz0 - 6.5], [px0 + 5.5, pz0 + 6]]) {
        const gy = heightAt(c[0], c[1]); const sg = new THREE.Group(); sg.position.set(c[0], gy, c[1]); town.add(sg)
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.4, 7), woodMat); tr.position.y = 1.2; tr.castShadow = true; sg.add(tr)
        const sakuraMat = toon(0xf0bcce)
        for (const bl of [[0, 2.9, 0, 1.5], [-0.9, 2.5, 0.4, 1.0], [0.8, 2.6, -0.5, 1.05], [0.2, 3.4, 0.3, 0.9]]) {
          const bs = new THREE.Mesh(new THREE.SphereGeometry(bl[3], 8, 7), sakuraMat); bs.position.set(bl[0], bl[1], bl[2]); bs.castShadow = true; sg.add(bs)
        }
        colliders.push({ x: c[0], z: c[1], r: 0.6 }); spawnAvoid.push({ x: c[0], z: c[1], r: 2.0 })
      }
      // 石灯籠×2（池のほとりに。夕夜はほのかに灯る）
      for (const lp of [[px0 - pondR - 1.2, pz0 + 2.5], [px0 + pondR + 1.2, pz0 - 2.5]]) {
        const gy = heightAt(lp[0], lp[1]); const lan = new THREE.Group(); lan.position.set(lp[0], gy, lp[1]); town.add(lan)
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.5, 8), stoneMat); foot.position.y = 0.25
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 1.1, 8), stoneMat); post.position.y = 1.05
        const fire = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.46, 0.58), duskAmt > 0.2 ? new THREE.MeshBasicMaterial({ color: 0xffce86 }) : toon(0xb0a890)); fire.position.y = 1.85
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.4, 4), stoneMat); cap.rotation.y = Math.PI / 4; cap.position.y = 2.25
        for (const m of [foot, post, fire, cap]) { m.castShadow = true; lan.add(m) }
        colliders.push({ x: lp[0], z: lp[1], r: 0.5 })
      }
      // ベンチ×3（広場に。池の方を向く）
      for (const bp of [[px0 - 8, pz0 - 1, 1.4], [px0 + 8.5, pz0 + 1, -1.4], [px0 - 1, pz0 + 8.5, 3.0]]) {
        const gy = heightAt(bp[0], bp[1]); const bg = new THREE.Group(); bg.position.set(bp[0], gy, bp[1]); bg.rotation.y = bp[2]; town.add(bg)
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.5), woodMat); seat.position.y = 0.5; seat.castShadow = true; bg.add(seat)
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.1), woodMat); back.position.set(0, 0.78, -0.22); bg.add(back)
        for (const sx2 of [-0.8, 0.8]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.46), toon(0x6a5a48)); leg.position.set(sx2, 0.25, 0); bg.add(leg) }
      }
      // 公園の縁を低めの木立で囲む（広場の輪郭。中央の池・橋・桜は開けておく＝水面が見える）
      for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + 0.3, rr = PARK.r - 0.4 + R() * 0.8; tree(px0 + Math.cos(a) * rr, pz0 + Math.sin(a) * rr, 0.8 + R() * 0.4) }
      colliders.push({ x: px0, z: pz0, r: pondR * 0.85 }) // 歩行: 池には入らない
      spawnAvoid.push({ x: px0, z: pz0, r: pondR + 1.5 }) // 着地: 池に降りない
    }
  }

  // ── 谷戸の中身（棚田・茅葺の横溝屋敷・屋敷林・せせらぎ・点在する農家）。谷戸のみ。 ──
  if (kind === 'yato') {
    // 棚田: 谷底に水田と青田が並ぶ。畦道は区画の隙間で表す。
    // 水鏡: 平板な水色でなく「空・地平・朝日を映す水面」に。情景の空色のグラデ＋斜めの陽の照り返し＋さざ波を
    // 描き、自発光のように明るいMeshBasicで反射の質感を出す（評価指摘: 今は空を映さない平板な板）。
    const makeWaterMirror = (sunStrength) => {
      const c = document.createElement('canvas'); c.width = c.height = 64
      const cx = c.getContext('2d')
      const top = '#' + new THREE.Color(0x6ea2c4).lerp(skyTop, 0.32).getHexString()    // 上＝空を映す水面（はっきりした水色）
      const bot = '#' + new THREE.Color(0x46708e).lerp(skyHorizon, 0.18).getHexString() // 下(手前)＝深い水
      const g = cx.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, top); g.addColorStop(1, bot)
      cx.fillStyle = g; cx.fillRect(0, 0, 64, 64)
      const sun = '#' + sunCol.clone().lerp(new THREE.Color(0xffffff), 0.2).getHexString() // 暖色の照り返し（白にしない）
      const sg = cx.createLinearGradient(22, 64, 42, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, sun); sg.addColorStop(1, 'rgba(255,255,255,0)')
      cx.globalAlpha = sunStrength; cx.fillStyle = sg; cx.fillRect(0, 0, 64, 64); cx.globalAlpha = 1
      for (let i = 0; i < 40; i++) { cx.fillStyle = `rgba(255,255,255,${0.05 + R() * 0.05})`; cx.fillRect(R() * 64, R() * 64, 1 + R() * 2, 1) } // さざ波
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping
      return new THREE.MeshToonMaterial({ color: 0xffffff, map: t, gradientMap: grad, fog: true }) // トゥーンで陰影を乗せ白飛びを防ぐ
    }
    const waterMat = makeWaterMirror(0.34)  // 水を張った田（空を映す水鏡）
    const waterSun = makeWaterMirror(0.58)  // 朝日を照り返す明るい水面
    // 青田（田植え後の稲の条が整然と並ぶ緑＝俯瞰で「田んぼ」と読ませる。ベタ緑を脱す）。
    const ric = document.createElement('canvas'); ric.width = ric.height = 64
    const rix = ric.getContext('2d')
    rix.fillStyle = '#6f8a44'; rix.fillRect(0, 0, 64, 64)
    for (let y = 3; y < 64; y += 5) { // 稲の条（列）
      rix.fillStyle = 'rgba(86,108,54,0.55)'; rix.fillRect(0, y, 64, 2)       // 条の影
      rix.fillStyle = 'rgba(146,168,90,0.42)'; rix.fillRect(0, y + 2, 64, 1)  // 株の明部
    }
    for (let i = 0; i < 70; i++) { const v = 96 + ((R() * 44) | 0); rix.fillStyle = `rgba(${v},${v + 26},${(v * 0.58) | 0},0.16)`; rix.fillRect(R() * 64, R() * 64, 2, 2) } // 株のムラ
    const riceTex = new THREE.CanvasTexture(ric); riceTex.wrapS = riceTex.wrapT = THREE.RepeatWrapping; riceTex.repeat.set(2, 2)
    const riceMat = new THREE.MeshLambertMaterial({ map: riceTex }) // 青田（稲の条）
    // 畑の土（耕した畝＝土の条が並ぶ。ベタ土を脱し「耕した畑」と読ませる。稲の条と揃える）。
    const ear = document.createElement('canvas'); ear.width = ear.height = 64
    const erx = ear.getContext('2d')
    erx.fillStyle = '#9c8862'; erx.fillRect(0, 0, 64, 64)
    for (let y = 3; y < 64; y += 6) { // 畝（耕した土の条）
      erx.fillStyle = 'rgba(122,104,72,0.55)'; erx.fillRect(0, y, 64, 2)       // 畝の谷（影）
      erx.fillStyle = 'rgba(186,164,124,0.4)'; erx.fillRect(0, y + 3, 64, 1)   // 畝の頂（明）
    }
    for (let i = 0; i < 60; i++) { const v = 150 + ((R() * 40) | 0); erx.fillStyle = `rgba(${v},${(v * 0.86) | 0},${(v * 0.62) | 0},0.16)`; erx.fillRect(R() * 64, R() * 64, 2, 2) } // 土塊のムラ
    const earthTex = new THREE.CanvasTexture(ear); earthTex.wrapS = earthTex.wrapT = THREE.RepeatWrapping; earthTex.repeat.set(2, 2)
    const earthMat = new THREE.MeshLambertMaterial({ map: earthTex }) // 畑の土（耕した畝）
    // 秋＝刈田（稲刈り後の黄金の刈株が条に残る）。青田の代わりに金色の刈田を主体に（季節で中身が変わる）。
    const AUT = season === 'autumn'
    let kariMats = null
    if (AUT) {
      // 刈田を一枚の同じ材で敷くと俯瞰で「灰色の段々」に溶ける。実際の秋の谷戸は刈った時期で
      // 田ごとに金色の濃淡が違う＝パッチワーク。3種の刈田材を段ごとに替え、段々の起伏を読ませる。
      // 金はグレードで彩度が落ちて灰色化しやすいので、やや強めの金で起こす（秋の木立の暖色と調和）。
      const makeKari = (base, rowDk, rowLt, spek) => {
        const kar = document.createElement('canvas'); kar.width = kar.height = 64
        const kax = kar.getContext('2d')
        kax.fillStyle = base; kax.fillRect(0, 0, 64, 64)
        for (let y = 3; y < 64; y += 5) { // 刈株の条
          kax.fillStyle = rowDk; kax.fillRect(0, y, 64, 2)       // 条の影
          kax.fillStyle = rowLt; kax.fillRect(0, y + 2, 64, 1)   // 条の明（刈株の照り）
        }
        for (let i = 0; i < 64; i++) { const v = spek + ((R() * 40) | 0); kax.fillStyle = `rgba(${v},${(v * 0.82) | 0},${(v * 0.46) | 0},0.18)`; kax.fillRect(R() * 64, R() * 64, 2, 2) }
        const t = new THREE.CanvasTexture(kar); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2)
        return new THREE.MeshLambertMaterial({ map: t }) // 刈田（金色の刈株）
      }
      kariMats = [
        makeKari('#dcc06a', 'rgba(150,120,58,0.55)', 'rgba(244,224,158,0.5)', 188),  // 刈りたての明るい金
        makeKari('#c8a850', 'rgba(132,104,48,0.55)', 'rgba(230,206,138,0.45)', 168), // やや古い深い琥珀
        makeKari('#b8995a', 'rgba(120,96,52,0.5)', 'rgba(210,186,130,0.4)', 156),    // 刈って間もない褐色がかった田
      ]
    }
    // 春＝田植えの水鏡（水を張ったばかりの棚田が一面に空を映す）。水鏡を主体に。
    const SPR = season === 'spring'
    // 冬＝雪原の棚田（青田/刈田の代わりに雪化粧の段々田＋凍った水面）。Lambert材は雪冠(snowify)が乗らないので明示的に雪色。
    const WIN = weather === 'snow'
    const snowField = WIN ? mottleMat(0xdce6f0, 34, 0.12, [1, 1]) : null // 雪をかぶった田（淡い青の起伏の影＝段々が読める）
    const iceField = WIN ? mottleMat(0xc4d6e2, 26, 0.14, [1, 1]) : null  // 凍った水面（薄氷の青）
    for (let pz = -44; pz <= 2.5; pz += 5.6) {
      for (let px = -11; px <= 11; px += 5.6) {
        const jx = (R() - 0.5) * 0.5
        const gy = heightAt(px + jx, pz)
        const r = R()
        const w = 4.9 + R() * 0.4
        // 冬=雪原主体＋凍った水面、夏=水鏡主体＋青田、秋=刈田主体＋水鏡少なめ。一部の水は陽を照り返す。
        const paddy = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, w),
          WIN
            ? (r > 0.78 ? iceField : snowField) // 冬: 雪原が主・凍った水面が点々
            : AUT
              ? (r > 0.56 ? (R() < 0.4 ? waterSun : waterMat) : (r > 0.12 ? kariMats[(R() * 3) | 0] : earthMat))
              : SPR
                ? (r > 0.16 ? (R() < 0.42 ? waterSun : waterMat) : (r > 0.08 ? riceMat : earthMat)) // 春: 田植えの水鏡が一面に
                : (r > 0.32 ? (R() < 0.32 ? waterSun : waterMat) : (r > 0.10 ? riceMat : earthMat)))
        paddy.position.set(px + jx, gy + 0.13, pz); paddy.receiveShadow = true; town.add(paddy)
      }
    }
    // 稲架掛け（はざかけ）: 刈った稲を天日に干す木の架＝秋の谷戸の風物詩。横竿に金色の稲束を掛けた
    // 水平の列＝俯瞰の窓から見下ろす視線でも「干した稲」と読める（横向きの色面＝面が立つ）。秋のみ。
    if (AUT) {
      const hzWood = toon(0x6a5a3c), hzRice = toon(0xe2c062) // 稲束は明るい金で（俯瞰でも金の横列と読める）
      const hazakake = (x, z, ang, len) => {
        const g = new THREE.Group(); g.position.set(x, heightAt(x, z), z); g.rotation.y = ang
        for (const sx of [-len / 2, len / 2]) { // 2本の脚（軽く開いて自立）
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.9, 5), hzWood)
          leg.position.set(sx, 0.9, 0); leg.rotation.z = sx < 0 ? 0.12 : -0.12; leg.castShadow = true; g.add(leg)
        }
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len + 0.5, 5), hzWood) // 横竿
        pole.rotation.z = Math.PI / 2; pole.position.y = 1.55; g.add(pole)
        const nB = Math.max(3, Math.round(len / 0.42))
        for (let i = 0; i < nB; i++) { // 金色の稲束を掛ける
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.32), hzRice)
          b.position.set(-len / 2 + 0.25 + i * (len / (nB - 0.5)), 1.2, 0); b.castShadow = true; g.add(b)
        }
        town.add(g)
      }
      for (const [hx, hz, ha, hl] of [[-5, -4, 0.15, 3.4], [4, -17, -0.25, 3.0], [-4, -31, 0.1, 3.2], [6, -39, 0.35, 2.6], [-7, -42, -0.1, 2.8]]) hazakake(hx, hz, ha, hl)
    }
    // 畦道（あぜ）: 段の境界に立つ「土手の擁壁」＝棚田の階段感の決め手。横断(段境界)は高く厚く。
    const bundMat = toon(0x8a7656)
    const azeMat = toon(0x738048) // 畦の上の草の小道（人が歩く緑の筋＝俯瞰で棚田の畦道が読める）
    const nanoMat = SPR ? toon(0xe6d044) : null // 菜の花の黄（春の畦の彩り）
    const nanoGeo = SPR ? new THREE.IcosahedronGeometry(0.3, 0) : null
    // 段の擁壁を「うねる段境界」に沿って短いセグメントで並べる＝棚田が等高線に沿って湾曲する（剛体の横縞を脱す）。
    for (let n = 1; n <= 9; n++) {
      for (let bx = -12.5; bx <= 12.5; bx += 2.5) {
        const bz = 4 + undX(bx) - 5.6 * n               // この x での段境界 z（heightAt と同じ undX で整合）
        if (bz < -46.5 || bz > 5.5) continue
        const gy = heightAt(bx, bz)
        const seg = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.15, 0.85), bundMat) // 短い擁壁（隣と重ねて連続に）
        seg.position.set(bx, gy + 0.5, bz); seg.castShadow = true; seg.receiveShadow = true; town.add(seg)
        const aze = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.14, 0.95), azeMat)  // 畦の天端の草道
        aze.position.set(bx, gy + 1.11, bz); aze.receiveShadow = true; town.add(aze)
        if (SPR) { // 春の菜の花（黄の彩り）
          const nf = new THREE.Mesh(nanoGeo, nanoMat)
          nf.position.set(bx + (R() - 0.5) * 1.6, gy + 1.3, bz + (R() - 0.5) * 0.5)
          nf.scale.set(0.7 + R() * 0.6, 0.9 + R() * 0.5, 0.7 + R() * 0.6); town.add(nf)
        }
      }
    }
    for (let bx = -13.8; bx <= 13.8; bx += 5.6) {
      const gy = heightAt(bx, -21)
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 50), bundMat) // 縦の畦（段内の仕切り＝細い）
      b.position.set(bx, gy + 0.32, -21); b.castShadow = true; b.receiveShadow = true; town.add(b)
    }
    // せせらぎ（谷の左の縁を縫う細い水の流れ。棚田と重ねず、連続した一筋に）。朝の光を映してきらめく
    // 明るい水＝棚田の水鏡と同じ質感に。共有マテリアル1枚（従来は32枚生成していた無駄を解消）。
    const brookMat = mottleMat(0xc8dce4, 28, 0.20, [1, 2]) // 流れの水（さざ波のムラで煌めき）
    for (let i = 0; i < 32; i++) {
      const z = 5 - i * 1.6, x = Math.sin(z * 0.11 + 0.4) * 1.4 - 9.0, gy = heightAt(x, z)
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.13, 1.95), brookMat)
      seg.position.set(x, gy + 0.16, z); town.add(seg)
    }
    // 寄棟(よせむね)屋根のジオメトリ: 水平の大棟＋四方の勾配＋深い軒＝四角錐の「段ボール箱」を脱す（評価指摘の核心）。
    // baseW/baseD=軒の外寸(壁より広く＝深い軒), ridgeLen=大棟の長さ(<baseW), h=棟の高さ。ridge は X 軸に通る。
    const makeHipRoof = (baseW, baseD, ridgeLen, h) => {
      const hw = baseW / 2, hd = baseD / 2, hr = ridgeLen / 2
      const bFL = [-hw, 0, hd], bFR = [hw, 0, hd], bBR = [hw, 0, -hd], bBL = [-hw, 0, -hd]
      const rL = [-hr, h, 0], rR = [hr, h, 0]
      const tri = [bFL, bFR, rR, bFL, rR, rL, bBR, bBL, rL, bBR, rL, rR, bBL, bFL, rL, bFR, bBR, rR] // 前/後の勾配＋左右の寄せ
      const pos = [], uv = []
      for (const v of tri) { pos.push(v[0], v[1], v[2]); uv.push((v[0] / baseW + 0.5) * 2.0, 0.85 - v[1] / h * 0.8) } // 茅の縦筋が勾配を下る
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      geo.computeVertexNormals()
      return geo
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
      // 茅葺の寄棟屋根: 水平の大棟＋四方の勾配＋深い軒。四角錐の「段ボール箱」を本物の寄棟へ作り直す（評価指摘）。
      const roof = new THREE.Mesh(makeHipRoof(10.8, 8.2, 5.6, 3.5), thatchMat)
      roof.position.y = 2.7; roof.castShadow = true; roof.receiveShadow = true; g.add(roof) // 軒を壁の上端(3.2)より下げ＝深い軒の量感
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.62, 1.25), toon(0x423a2c)); ridge.position.y = 6.2; g.add(ridge) // 大棟の押さえ（水平に長く通る）
      const gateBody = new THREE.Mesh(new RoundedBoxGeometry(7, 2.2, 2.2, 1, 0.16), toon(0xddd4c4)) // 長屋門（角をわずかに面取り）
      gateBody.position.set(0, 1.1, 5.8); gateBody.castShadow = true; g.add(gateBody)
      const gateRoof = new THREE.Mesh(makeHipRoof(8.2, 3.4, 5.0, 1.5), thatchMat)
      gateRoof.position.set(0, 2.0, 5.8); gateRoof.castShadow = true; g.add(gateRoof)
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
      const fr = new THREE.Mesh(makeHipRoof(5.0, 4.2, 2.2, 1.7), farmRoof[(R() * 3) | 0]); fr.position.y = 2.2; fr.castShadow = true; fg.add(fr) // 瓦の寄棟（深い軒）
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
  // 評価(美術-H2)で「七角錐の書き割り」と指摘→ 幅広く低い山を多数重ねて連続した不規則な尾根に、
  // 奥の層ほど空色へ強く青ませて大気遠近の奥行きを段階化する。
  const mtnLo = new THREE.Color(0x66765c), mtnBlue = new THREE.Color(0x94a4b2)
  for (let layer = 0; layer < 3; layer++) {
    const dist = 132 + layer * 52
    const baseY = -6 + layer * 5            // 基底を地中に沈め、上部の稜線だけ見せる（重なりが尾根になる）
    const n = 14 - layer * 2
    const col = skyHorizon.clone().lerp(layer === 0 ? mtnLo : mtnBlue, 0.46 + layer * 0.16).getHex() // 奥ほど青く淡く
    for (let i = 0; i < n; i++) {
      const ang = (i / (n - 1) - 0.5) * Math.PI * 1.3
      const x = Math.sin(ang) * dist + (R() - 0.5) * 44
      const z = -Math.cos(ang) * dist - 22
      const rad = 56 + R() * 46, h = (20 + R() * 30) * (1 - layer * 0.12) // 幅広く低い＝なだらかな山・高さを散らす
      const m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 6), toon(col))
      m.position.set(x, baseY, z); m.rotation.y = R() * 6
      scene.add(m); mtns.push(m)
    }
  }

  // ── ふわふわの雲（白い球の塊＝立体的な積雲。底は平ら・上は盛り上がり、雲底は翳って立体に） ──
  const clouds = []
  const cloudMat = new THREE.MeshToonMaterial({ color: 0xfbfaf6, gradientMap: grad, fog: false })       // 陽の当たる白
  const cloudBot = new THREE.MeshToonMaterial({ color: isNight ? 0x6a7286 : 0xd7cfc4, gradientMap: grad, fog: false }) // 影になる雲底（やや翳る＝厚みと立体）
  // 数を増やし高さを少し下げて、縦窓の狭い視界でも空が間延びしないように（light端末は控えめ）。
  const cloudN = LIGHT ? 10 : 16
  for (let i = 0; i < cloudN; i++) {
    const g = new THREE.Group()
    const n = 6 + ((R() * 5) | 0) // 6〜10房＝もこもこの積雲
    for (let j = 0; j < n; j++) {
      const s = 4 + R() * 7
      const up = Math.pow(R(), 0.6) // 上ほど房が多い＝盛り上がる頂・底は平ら
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), up < 0.25 ? cloudBot : cloudMat)
      puff.position.set((R() - 0.5) * 24, up * 7, (R() - 0.5) * 11)
      puff.scale.y = 0.58
      g.add(puff)
    }
    g.position.set((R() - 0.5) * 250, 27 + R() * 24, -52 - R() * 90)
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
  // 飛行中、ふと一羽が並んで飛ぶ（つかの間の道連れ）。たまに現れ、少し伴走して離れていく。
  const comp = new THREE.Group()
  for (const s of [-1, 1]) { const wing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.44), birdMat); wing.position.x = s * 0.64; comp.add(wing); wing.userData.side = s }
  comp.visible = false; scene.add(comp)
  let compActive = false, compT = 0, compCool = 6, compSide = 1
  const compPhase = R() * 6.28

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
    const N = (weather === 'snow' ? 700 : weather === 'petals' ? 420 : 360) * (LIGHT ? 0.5 : 1) | 0 // light端末は降る粒子を半減
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
    // ── 浮遊（空を飛ぶ）＆散策（歩く）モードの状態 ──
    flyEnabled: kind !== 'yato',  // 立体の街（町／角部屋）でだけ飛べる/歩ける。谷戸は対象外
    mode: 'window',               // 'window'（窓辺）| 'fly'（空を飛ぶ）| 'walk'（地上を歩く）
    flyTarget: 0,                 // 窓の外にいたい(1)/窓へ戻りたい(0)。fly/walk のどちらでも 1
    flyP: 0,                      // 窓⇄外の混ざり具合 0=窓 / 1=外（これをイージングして滑らかに出入り）
    flyPos: new THREE.Vector3(),  // 移動の中心点（“自分”）。引いたカメラはこの後ろ上から望む
    flyYaw: 0, flyPitch: 0, flyYawTarget: 0, flyPitchTarget: 0, // flyYaw=進路の向き（左スティックで旋回）／flyPitch=高さ角（右ドラッグ上下）
    lookYawOff: 0, lookYawOffTarget: 0, lookDragging: false, // 見回しの横オフセット（右ドラッグ。進路は変えず、離すと0へ戻る）
    turnSmooth: 0,                // 旋回入力のスムージング値（手ブレを均し、急旋回を抑える＝快適な曲がり）
    vel: new THREE.Vector3(),     // 慣性つきの速度（離すと惰性で減速＝ホバリング）
    moveX: 0, moveY: 0,           // スティック入力(-1..1)。左で動かす（横=旋回・縦=前後）。離すと0
    climb: 0,                     // （旧）上昇/下降入力。スキームAでは未使用
    cruise: true,                 // スキームA: 自動巡航中か（とまる/すすむトグル）。とまる=その場でホバリング
    zoom: 1,                      // カメラの引き具合（ピンチで0.4=寄り〜3.0=引き）。カメラ距離に掛ける
    bankCur: 0,                   // 旋回バンク（ロール）の現在値（飛行の傾き）
    camPos: new THREE.Vector3(),  // 引いたカメラの実位置（遅れ追従でわずかに揺らぐ）
    camReady: false,              // camPos 初期化済みか（飛び立ち/着地でスナップ）
    landedFired: true,            // 着地の砂ぼこり/沈み込みを発火済みか（着地で false→接地で発火）
    landDustT: 0, dipT: 0,        // 砂ぼこり/カメラ沈み込みの残り時間(秒)
    winLook: new THREE.Vector3(), // 窓ビューの注視点（飛び立つ瞬間の視線引き継ぎ用に毎フレーム保持）
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
      // forceContextLoss() は呼ばない: 上で geometry/material/texture を解放済みなので不要で、
      // 情景往復のたびにコンテキストを強制喪失・再生成するとモバイルでコンテキスト枯渇→3D表示不能の温床になる（評価 技術-H5）。
      renderer.dispose()
    },
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)

  // ── 歩行（散策）の当たり判定 ──
  // 建物フットプリント(円)に入らないよう、軸ごとに分けて判定＝壁ぎわをかすめて進める（引っかかって止まらない）。
  const blockedAt = (x, z) => {
    for (const c of colliders) { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < c.r * c.r) return true }
    return false
  }
  const tryWalk = (pos, dx, dz) => {
    const b = FLY.bound
    const nx = Math.max(-b.x, Math.min(b.x, pos.x + dx))
    const nz = Math.max(b.zMin, Math.min(b.zMax, pos.z + dz))
    if (!blockedAt(nx, pos.z)) pos.x = nx // x方向だけ先に試す（壁に沿って横へ滑る）
    if (!blockedAt(pos.x, nz)) pos.z = nz // z方向だけ試す
  }
  // 着地地点が建物/樹冠の中なら、空いた近くの地点へそっと退避する（建物や木に埋もれて立たない）。
  const spawnBad = (x, z) => {
    const b = FLY.bound
    if (x < -b.x || x > b.x || z < b.zMin || z > b.zMax) return true // 箱の外には降りない
    for (const c of spawnAvoid) { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < c.r * c.r) return true }
    return false
  }
  active.resolveSpawn = (x, z) => {
    if (!spawnBad(x, z)) return [x, z]
    for (let r = 1.5; r <= 18; r += 1.5) {
      for (let a = 0; a < 12; a++) {
        const nx = x + Math.cos(a / 12 * 6.2832) * r, nz = z + Math.sin(a / 12 * 6.2832) * r
        if (!spawnBad(nx, nz)) return [nx, nz]
      }
    }
    return [x, z]
  }
  // 着地時に最も視界の抜ける向き（街路や建物の隙間の奥）を選ぶ＝壁や木立を正面にしない。
  active.openYaw = (x, z) => {
    let best = 0, bestD = -1
    for (let a = 0; a < 16; a++) {
      const yaw = a / 16 * 6.2832
      const hx = Math.sin(yaw), hz = -Math.cos(yaw)
      let d = 1.0
      for (; d < 34; d += 1.2) { if (blockedAt(x + hx * d, z + hz * d)) break }
      if (d > bestD) { bestD = d; best = yaw }
    }
    return best
  }

  const startT = performance.now() // THREE.Clock は非推奨→performance.now 差分で経過秒を出す（警告解消・依存削減）
  let lastT = 0
  let lastDraw = -1
  const TMP_DIR = new THREE.Vector3(), TMP_UP2 = new THREE.Vector3() // 引いたカメラのバンク計算用（毎フレーム確保しない）

  // ── 窓枠のHTMLオーバーレイ（最前景のサッシ＋横桟＋窓台＋ガラスの映り込み＋紙目）──
  // frame() から参照するので先に生成する。あける／乗り出すで毎フレーム動かす。
  // 大気のトーン（空のほのかな光のにじみ＋周辺減光）＝シネマ調の奥行きで低ポリを格上げ。
  const atmo = document.createElement('div')
  atmo.className = 'town3d-atmo'
  stage.appendChild(atmo)
  // 情景の光で全体を一枚の空気に統一する淡いウォッシュ（局所色＝緑の木/灰の道/赤い看板を一つの光へまとめる）
  const wash = document.createElement('div')
  wash.className = 'town3d-wash'
  stage.appendChild(wash)
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
  // ── 設定（明るさ・描き込み品質）をtown3dに反映する（従来は設定が3Dに全く効かなかった＝UX評価の最重要指摘）。 ──
  // 明るさ: stageのCSSフィルタの brightness に、窓あけclarityの明るさ×ユーザ明るさを合成。描き込み: pixelRatioを即変更。
  let userBright = opts.brightness || 1
  function applyStageFilter() {
    const c = clarityCur < 0 ? 0 : clarityCur
    const b = (lerp(1.03, 1.06, c) * userBright).toFixed(3)
    stage.style.filter =
      `saturate(${lerp(0.85, 0.96, c).toFixed(3)}) sepia(${lerp(0.045, 0.02, c).toFixed(3)}) brightness(${b}) contrast(0.99)`
  }
  applyStageFilter() // 起動時のユーザ明るさを即反映
  active.setBrightness = (b) => { userBright = b || 1; applyStageFilter() }
  active.setQuality = (q) => { // 描き込み変更で解像度を即反映（影/密度は次の情景読み込みでフル反映）
    const cap = q === 'light' ? 1.25 : q === 'soft' ? 2 : 1.6
    curPR = Math.min(window.devicePixelRatio || 1, cap)
    renderer.setPixelRatio(curPR); renderer.setSize(stage.clientWidth, stage.clientHeight)
  }

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

  // ── 常時の雨（雨の角部屋＝3D化）。降る雨筋＋濡れた路面の反射を常時。weather==='rain'のみ。 ──
  if (weather === 'rain') {
    const N = 540, len = 2.6 // 雨脚＝短い筋（風で少し斜め）
    const pos = new Float32Array(N * 2 * 3)
    const head = new Float32Array(N * 3); const spd = new Float32Array(N)
    for (let i = 0; i < N; i++) { head[i * 3] = (R() - 0.5) * 210; head[i * 3 + 1] = R() * 95; head[i * 3 + 2] = -130 + R() * 190; spd[i] = 32 * (0.7 + R() * 0.6) }
    const rgeo = new THREE.BufferGeometry(); rgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const rmat = new THREE.LineBasicMaterial({ color: 0xc4d4e2, transparent: true, opacity: 0.55, fog: true, depthWrite: false })
    const rseg = new THREE.LineSegments(rgeo, rmat); rseg.frustumCulled = false; scene.add(rseg)
    scene.fog.far *= 0.88 // 雨で奥がけむる
    addFx({
      update: (age, dt) => {
        for (let i = 0; i < N; i++) { head[i * 3 + 1] -= spd[i] * dt; head[i * 3] += 4 * dt; if (head[i * 3 + 1] < -14) { head[i * 3 + 1] = 82 + R() * 16; head[i * 3] = (R() - 0.5) * 210 } }
        for (let i = 0; i < N; i++) { const h = i * 3, p = i * 6; pos[p] = head[h]; pos[p + 1] = head[h + 1]; pos[p + 2] = head[h + 2]; pos[p + 3] = head[h] + 0.6; pos[p + 4] = head[h + 1] - len; pos[p + 5] = head[h + 2] }
        rgeo.attributes.position.needsUpdate = true; return true
      },
      cleanup: () => { scene.remove(rseg); rgeo.dispose(); rmat.dispose() },
    })
    // 濡れた路面のきらめき（街あかりを照り返す。evWetRoadの永続版）
    const M = 110
    const wpos = new Float32Array(M * 3); const waph = new Float32Array(M)
    for (let i = 0; i < M; i++) { wpos[i * 3] = (R() - 0.5) * 9; wpos[i * 3 + 1] = 0.12; wpos[i * 3 + 2] = 18 - R() * 112; waph[i] = R() * 6.28 }
    const wgeo = new THREE.BufferGeometry(); wgeo.setAttribute('position', new THREE.BufferAttribute(wpos, 3)); wgeo.setAttribute('aph', new THREE.BufferAttribute(waph, 1))
    const wmat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uOp: { value: 0.5 }, uCol: { value: new THREE.Color(isNight ? 0xffd6a0 : 0xcfe4f2) } },
      vertexShader: 'attribute float aph; varying float vtw; uniform float uT; void main(){ vtw=0.35+0.65*(0.5+0.5*sin(uT*2.6+aph)); vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=3.2*(60.0/max(1.0,-mv.z)); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying float vtw; uniform vec3 uCol; uniform float uOp; void main(){ float a=smoothstep(0.5,0.0,length(gl_PointCoord-0.5)); gl_FragColor=vec4(uCol, a*vtw*uOp); }',
    })
    const wpts = new THREE.Points(wgeo, wmat); wpts.frustumCulled = false; town.add(wpts)
    addFx({ update: (age) => { wmat.uniforms.uT.value = age; return true }, cleanup: () => { town.remove(wpts); wgeo.dispose(); wmat.dispose() } })
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
    if (reduceMotion) return // 視差軽減では定期イベント（突発・大きな動き）を起こさない。ぼーっと眺める静けさは保つ
    for (const b of fxBands) {
      b.next -= dt
      if (b.next > 0) continue
      b.next = b.min + R() * (b.max - b.min)
      if (b.quiet && R() < b.quiet) continue // 何も起きない“余白”をたまに挟む（アンビエントの締まり）
      const ok = b.pool.filter((k) => { const e = EV[k]; return e && (!e.ok || e.ok()) })
      if (ok.length) { const k = ok[(R() * ok.length) | 0]; EV[k].run(); onEvent(k) } // 画面の現象と音を同時に
    }
  }
  // 検証用フック（dev）: 任意のイベントを即時に起こす
  if (/[?&]dev=1/.test(location.search)) window.__town3dEvent = (n) => { onEvent(n); return ({ rain: () => evRain(16), rainbow: evRainbow, wetRoad: evWetRoad, birds: evBirdFlock, balloon: evBalloon, star: evShootingStars, contrail: evContrail, cloudShade: evCloudShade, duskLights: evDuskLights, fireworks: evFireworks, aurora: evAurora }[n] || (() => {}))() }

  // ── 飛行/歩行の没入オブジェクト ──
  // 自分の影が真下の地面を走る（高度＝飛んでいる手応え）。柔らかい円を地面に伏せる。
  const flyerShadow = (() => {
    const s = 64, c = document.createElement('canvas'); c.width = c.height = s
    const g = c.getContext('2d')
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    grd.addColorStop(0, 'rgba(0,0,0,0.5)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.22)'); grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd; g.fillRect(0, 0, s, s)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: true }))
    m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return m
  })()
  // 着地の砂ぼこり（地面に広がって消える柔らかい輪）。飛び降りて着地した瞬間にふわっと立つ。
  const landDust = (() => {
    const s = 64, c = document.createElement('canvas'); c.width = c.height = s
    const g = c.getContext('2d')
    const grd = g.createRadialGradient(s / 2, s / 2, s * 0.12, s / 2, s / 2, s / 2)
    grd.addColorStop(0, 'rgba(228,221,208,0)'); grd.addColorStop(0.5, 'rgba(224,216,200,0.55)'); grd.addColorStop(1, 'rgba(220,212,196,0)')
    g.fillStyle = grd; g.fillRect(0, 0, s, s)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: true }))
    m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return m
  })()
  // 高空を速く飛ぶと自分が飛行機雲を引く（後ろへ伸びる白い蒸気）。一粒ずつ薄れる加算スプライトの点群。
  const trailN = LIGHT ? 40 : 72
  const trailTex = (() => {
    const s = 48, c = document.createElement('canvas'); c.width = c.height = s
    const g = c.getContext('2d'); const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, 'rgba(245,248,255,0.5)'); gr.addColorStop(1, 'rgba(240,245,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, s, s); return new THREE.CanvasTexture(c)
  })()
  const trailGeo = new THREE.BufferGeometry()
  trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trailN * 3), 3))
  trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(trailN * 3), 3)) // 各粒の濃さ(白×alpha)
  const trailMat = new THREE.PointsMaterial({ map: trailTex, size: 2.8, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true })
  const trail = new THREE.Points(trailGeo, trailMat); trail.frustumCulled = false; trail.visible = false; scene.add(trail)
  const trailAlpha = new Float32Array(trailN) // 各粒の寿命(0..1)
  let trailIdx = 0, trailAccum = 0
  let birdFlushCool = 0 // 鳥の羽音の連発抑制タイマー(秒)

  // 夕暮れ・夜は空気に光の粒が舞う（蛍/塵）。暗い空ほど見え、カメラ周辺を漂い流れる。空/地上でだけ。
  const moteN = LIGHT ? 50 : 90
  const motePos = new Float32Array(moteN * 3)
  for (let i = 0; i < moteN; i++) { motePos[i * 3] = (R() - 0.5) * 72; motePos[i * 3 + 1] = (R() - 0.5) * 46; motePos[i * 3 + 2] = (R() - 0.5) * 72 }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3))
  const moteTex = (() => {
    const s = 32, c = document.createElement('canvas'); c.width = c.height = s
    const g = c.getContext('2d'); const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    gr.addColorStop(0, 'rgba(255,244,214,0.95)'); gr.addColorStop(0.5, 'rgba(255,236,196,0.4)'); gr.addColorStop(1, 'rgba(255,232,190,0)')
    g.fillStyle = gr; g.fillRect(0, 0, s, s); return new THREE.CanvasTexture(c)
  })()
  const moteMat = new THREE.PointsMaterial({ map: moteTex, size: 0.5, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  const motes = new THREE.Points(moteGeo, moteMat); motes.frustumCulled = false; motes.visible = false; scene.add(motes)

  // 高速時の速度感（風の手応え）。画面の縁がそっと締まり、視界が前へ吸い込まれる映画的なヴィネット。
  // 明るい水彩の空に“流れる白線”は埋もれて出ない／強いとゲーム臭くなるため、縁の締まりで速さを伝える。
  const speedVig = document.createElement('div'); speedVig.className = 'town3d-speedvig'; stage.appendChild(speedVig)
  let speedVigCur = -1
  // 雲を抜けるとき視界が白くかすむ（雲の中に入った手応え＝高度の実感）。
  const cloudHaze = document.createElement('div'); cloudHaze.className = 'town3d-cloudhaze'; stage.appendChild(cloudHaze)
  let cloudHazeCur = -1
  // 高く昇るほど空気が冷たく淡くなる（高度の実感）。淡い寒色をうっすら被せる。
  const altTint = document.createElement('div'); altTint.className = 'town3d-alt'; stage.appendChild(altTint)
  let altTintCur = -1
  // とまる／すすむ トグル（飛行のときだけ・下中央）。タップでその場ホバリング⇄自動巡航。ボタンは1つだけ＝迷わない。
  const cruiseBtn = document.createElement('button'); cruiseBtn.className = 'town3d-cruise'; cruiseBtn.textContent = 'とまる'
  stage.appendChild(cruiseBtn)
  let cruiseShown = false
  cruiseBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation() }) // 長押しのテキスト選択/メニューを抑止
  cruiseBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (!active) return
    active.cruise = !active.cruise
    cruiseBtn.textContent = active.cruise ? 'とまる' : 'すすむ'
  })

  function frame() {
    if (!active) return
    active.raf = requestAnimationFrame(frame)
    if (document.hidden) return // 非アクティブ（タブ切替/画面ロック）時は描画も更新も止める＝発熱・電池配慮（CLAUDE.md）
    const t = (performance.now() - startT) / 1000
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
    // 木がそよ風に揺れる。低空で自機が近くを過ぎると、その風圧で外側へなびく（通過の余波）。
    const wakeOn = active && active.mode === 'fly' && active.flyP > 0.5
    const wakeSpd = wakeOn ? Math.min(1, Math.hypot(active.vel.x, active.vel.z) / FLY.speed) : 0
    for (const tr of treesArr) {
      let wake = tr.userData.wake || 0
      if (wakeOn && wakeSpd > 0.1) {
        const dx = tr.position.x - active.flyPos.x, dz = tr.position.z - active.flyPos.z
        const dh = Math.hypot(dx, dz), dy = active.flyPos.y - (tr.position.y + 5)
        if (dh < 9 && dy < 12 && dy > -4) {
          const target = (1 - dh / 9) * wakeSpd * 0.4 * (dx >= 0 ? 1 : -1) // 自機の外側へ倒れる
          if (Math.abs(target) > Math.abs(wake)) wake = target
        }
      }
      wake *= 0.92; tr.userData.wake = wake // 余波はゆっくり戻る
      tr.rotation.z = tr.userData.tilt + Math.sin(t * 0.8 + tr.userData.ph) * tr.userData.amp + wake
    }
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
    // 鳥がはばたきながら空を渡る。自機が近いと驚いて上へ逃げ、羽ばたきが大きくなる（＋羽音）。
    const flyerAloft = active && (active.mode === 'fly' || active.mode === 'walk') && active.flyP > 0.5
    birdFlushCool = Math.max(0, birdFlushCool - dt)
    for (const b of birds) {
      const u = b.userData
      const a = t * u.sp + u.ph
      const prev = u.startle || 0
      let st = prev * 0.98 // 驚きはゆっくり収まる
      if (flyerAloft) {
        const dx = b.position.x - active.flyPos.x, dy = b.position.y - active.flyPos.y, dz = b.position.z - active.flyPos.z
        const near = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (near < 15) st = Math.max(st, 1 - near / 15)
      }
      if (st > 0.4 && prev <= 0.4 && birdFlushCool <= 0) { onBirdFlush(); birdFlushCool = 1.6 } // 新たに驚いた瞬間に羽音（連発を抑制）
      u.startle = st
      b.position.set(u.cx + Math.cos(a) * u.rad, u.yy + st * 7 + Math.sin(a * 0.7) * 2.0, u.cz + Math.sin(a) * u.rad)
      b.rotation.y = -a + Math.PI / 2
      const flap = Math.sin(t * 9 + u.ph) * (0.5 + st * 0.5)
      b.children.forEach((w) => { w.rotation.z = w.userData.side * flap })
    }
    // つかの間の道連れ: 飛行中にたまに一羽が現れ、横に並んで伴走し、終盤は離れていく。
    compCool = Math.max(0, compCool - dt)
    const flyingFast = active && active.mode === 'fly' && active.flyP > 0.6 && Math.hypot(active.vel.x, active.vel.z) > FLY.speed * 0.3
    if (!compActive && flyingFast && compCool <= 0 && Math.random() < dt * 0.05) {
      compActive = true; compT = 9 + Math.random() * 8; compSide = Math.random() < 0.5 ? -1 : 1
      comp.position.set(active.flyPos.x - active.vel.x * 0.3, active.flyPos.y - 1, active.flyPos.z - active.vel.z * 0.3); comp.visible = true
    }
    if (compActive) {
      compT -= dt
      const sp = Math.hypot(active.vel.x, active.vel.z) || 1
      const fx = active.vel.x / sp, fz = active.vel.z / sp, rx = -fz, rz = fx // 進む向きと右（水平）
      const peel = compT < 1.6 ? (1.6 - compT) * 5 : 0 // 終盤は外へ離れる
      const tx = active.flyPos.x + (compSide * 5 + peel * compSide) * rx + fx * 3
      const ty = active.flyPos.y + 0.5 + Math.sin(t * 0.7) * 0.6 + peel * 1.0
      const tz = active.flyPos.z + (compSide * 5 + peel * compSide) * rz + fz * 3
      comp.position.x += (tx - comp.position.x) * 0.06
      comp.position.y += (ty - comp.position.y) * 0.06
      comp.position.z += (tz - comp.position.z) * 0.06
      comp.rotation.y = Math.atan2(fx, fz)
      const cflap = Math.sin(t * 10 + compPhase) * 0.6
      comp.children.forEach((w) => { w.rotation.z = w.userData.side * cflap })
      if (compT <= 0 || !active || active.mode !== 'fly') { compActive = false; comp.visible = false; compCool = 22 + Math.random() * 26 }
    }
    // 窓あけ／乗り出しの「線形進行(0..1)」を所要時間ぶんだけ目標へ一定速度で進め、ease-in-out をかける。
    // exp追従(従来)は出だしだけ急＝ease-outで戻りが不自然だった。線形進行+smoothstepなら開く時も
    // 戻る時も出だし・止まり際の両方がそっと加減速する＝ヌルヌルで酔わない窓の開閉・覗き込みになる。
    active.winOpenP = approach(active.winOpenP, active.winOpenTarget, dt / CAM.winOpenDur)
    active.leanP = approach(active.leanP, active.leanTarget, dt / CAM.leanDur)
    active.flyP = approach(active.flyP, active.flyTarget, dt / FLY.enterDur) // 空へ／窓へを所要時間で滑らかに
    const wo = easeInOut(active.winOpenP)
    const lean = easeInOut(active.leanP)
    const flyAmt = easeInOut(active.flyP) // 0=窓 / 1=空（カメラ位置・視線・画角をこの量で混ぜる）
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
    const winFov = CAM.fov0 + wo * CAM.winFov + lean * CAM.leanFov
    const look = new THREE.Vector3(
      ex + Math.sin(yaw) * 18,
      ey - 10.5 - lean * CAM.leanLook + pitch * CAM.lookPitch + Math.sin(t * 0.5) * 0.05, // 既定は見下ろし（手前の木に落ち込み過ぎない程度に）／上スワイプで空・ビル上層も仰げる
      ez - Math.cos(yaw) * 22,
    )
    active.winLook.copy(look) // 飛び立つ瞬間の視線引き継ぎ用に、窓ビューの注視点を毎フレーム保持

    // 既定は窓ビュー。浮遊/散策中(flyP>0)は、引いた三人称“浮遊カメラ”＋慣性移動＋旋回バンクを混ぜる。
    let camX = ex, camY = ey, camZ = ez, fov = winFov
    let upX = 0, upY = 1, upZ = 0
    let lookX = look.x, lookY = look.y, lookZ = look.z
    let windSpeed01 = 0 // 飛行速度の正規化(0..1)。風音の膨らみへ渡す
    let altDuck01 = 0 // 飛行高度の正規化(0..1)。高空で環境音をしぼる量へ渡す
    if (flyAmt > 0.0005 || active.flyTarget) {
      const isWalk = active.mode === 'walk'
      const prevYaw = active.flyYaw
      let dvX, dvY = 0, dvZ, cpit, spit, camYaw
      if (isWalk) {
        // 歩行＝白猫式ポイント＆ゴー（左スティックで旋回＋前後、カメラ追従、右ドラッグで見回し）。
        const mvMag = Math.min(1, Math.hypot(active.moveX, active.moveY))
        const turnAmt = mvMag > 0.001 ? Math.atan2(active.moveX, active.moveY) : 0
        const turnTarget = mvMag > 0.05 ? Math.max(-1, Math.min(1, turnAmt / 1.3)) * mvMag : 0
        active.turnSmooth += (turnTarget - active.turnSmooth) * FLY.turnEase
        active.flyYaw += active.turnSmooth * FLY.turnRate * dt
        if (!active.lookDragging) active.lookYawOffTarget *= 0.86
        active.flyPitch += (active.flyPitchTarget - active.flyPitch) * FLY.lookEase
        active.lookYawOff += (active.lookYawOffTarget - active.lookYawOff) * FLY.lookEase
        cpit = Math.cos(active.flyPitch); spit = Math.sin(active.flyPitch)
        camYaw = active.flyYaw + active.lookYawOff
        const throttle = mvMag * (0.55 + 0.45 * Math.max(0, Math.cos(turnAmt)))
        dvX = Math.sin(active.flyYaw) * throttle * FLY.walkSpeed
        dvZ = -Math.cos(active.flyYaw) * throttle * FLY.walkSpeed
      } else {
        // 飛行＝スキームA: ドラッグで操った進路(flyYaw/flyPitch)へ機首が向き、自動でゆっくり前進（巡航）。
        // 機首の上下がそのまま上昇/下降。とまる中は前進0＝その場でホバリング。一本指・スティック/昇降ボタン無し。
        active.flyYaw += (active.flyYawTarget - active.flyYaw) * FLY.steerEase
        active.flyPitch += (active.flyPitchTarget - active.flyPitch) * FLY.steerEase
        active.lookYawOff = 0
        cpit = Math.cos(active.flyPitch); spit = Math.sin(active.flyPitch)
        camYaw = active.flyYaw
        const cruiseS = active.cruise ? FLY.cruiseSpeed : 0
        dvX = Math.sin(active.flyYaw) * cpit * cruiseS
        dvY = spit * cruiseS // 機首の上下で上昇/下降
        dvZ = -Math.cos(active.flyYaw) * cpit * cruiseS
      }
      const yawV = (active.flyYaw - prevYaw) / Math.max(dt, 0.001) // 旋回角速度（バンクの素）
      const fwdX = Math.sin(camYaw) * cpit, fwdY = spit, fwdZ = -Math.cos(camYaw) * cpit // カメラの向き

      const k = 1 - Math.exp(-FLY.moveEase * dt) // 慣性：目標速度へ寄せる（とまる/離すと0へ）
      active.vel.x += (dvX - active.vel.x) * k
      active.vel.y += (dvY - active.vel.y) * k
      active.vel.z += (dvZ - active.vel.z) * k

      const b = FLY.bound
      if (isWalk) {
        tryWalk(active.flyPos, active.vel.x * dt, active.vel.z * dt) // 当たり判定つきで水平移動
        const eyeY = heightAt(active.flyPos.x, active.flyPos.z) + FLY.eye
        const ky = 1 - Math.pow(0.02, dt / FLY.landDur)
        active.flyPos.y += (eyeY - active.flyPos.y) * ky // 着地はやわらかく・以降は地形に沿う
        if (!active.landedFired && active.flyPos.y - eyeY < 0.6) { // 接地した瞬間＝砂ぼこり＋沈み込み
          active.landedFired = true; active.landDustT = 0.7; active.dipT = 0.42
          landDust.position.set(active.flyPos.x, heightAt(active.flyPos.x, active.flyPos.z) + 0.06, active.flyPos.z); landDust.visible = true
        }
        // 足音: 歩いた距離を貯め、一歩ぶん進むごとに鳴らす（止まっている間は鳴らない）
        const hstep = Math.hypot(active.vel.x, active.vel.z) * dt
        active.walkDist = (active.walkDist || 0) + hstep
        if (active.walkDist > 2.1) { active.walkDist = 0; onFoot() }
      } else {
        active.flyPos.x += active.vel.x * dt; active.flyPos.y += active.vel.y * dt; active.flyPos.z += active.vel.z * dt
        active.flyPos.x = Math.max(-b.x, Math.min(b.x, active.flyPos.x))
        active.flyPos.z = Math.max(b.zMin, Math.min(b.zMax, active.flyPos.z))
        const floor = heightAt(active.flyPos.x, active.flyPos.z) + b.yFloor
        active.flyPos.y = Math.max(floor, Math.min(b.yMax, active.flyPos.y))
      }

      // 旋回バンク（飛行のみ）：旋回（左スティックの曲がり＝yawV）に応じて世界が傾く＝飛翔の手応え。
      // ただし“動いている時だけ”傾ける（ホバリングして見回すだけでは傾かない）。
      const spMag = Math.hypot(active.vel.x, active.vel.y, active.vel.z)
      const moveFactor = Math.min(1, spMag / (FLY.speed * 0.35))
      const bankTgt = isWalk ? 0 : Math.max(-FLY.bankMax, Math.min(FLY.bankMax, -yawV * FLY.bankGain * 0.28)) * moveFactor
      active.bankCur += (bankTgt - active.bankCur) * FLY.bankEase

      // 引いた三人称カメラ：focus の後ろ上から望む。ピンチのズーム(active.zoom)で引き具合を可変。後ろが建物/地面なら寄せてのめり込みを防ぐ。
      const fp = active.flyPos
      const back0 = (isWalk ? FLY.walkBack : FLY.camBack) * active.zoom
      const upOff = (isWalk ? FLY.walkUp : FLY.camUp) * (0.5 + 0.5 * active.zoom) // 引くほど少し高い位置から見渡す
      const ahead = isWalk ? FLY.walkAhead : FLY.camAhead
      let back = back0, dcx = fp.x, dcz = fp.z
      for (let tries = 0; tries < 5; tries++) {
        dcx = fp.x - fwdX * back; dcz = fp.z - fwdZ * back
        if (!blockedAt(dcx, dcz)) break
        back *= 0.62
      }
      let dcy = fp.y - fwdY * back + upOff
      const camFloor = heightAt(dcx, dcz) + (isWalk ? 1.35 : 1.6) // 歩行は一人称寄り＝目線をやや低く許す
      if (dcy < camFloor) dcy = camFloor
      if (!active.camReady) { active.camPos.set(dcx, dcy, dcz); active.camReady = true } // 飛び立ち/着地直後はスナップ
      else { active.camPos.x += (dcx - active.camPos.x) * FLY.camLag; active.camPos.y += (dcy - active.camPos.y) * FLY.camLag; active.camPos.z += (dcz - active.camPos.z) * FLY.camLag }

      const aLookX = fp.x + fwdX * ahead, aLookY = fp.y + fwdY * ahead + Math.sin(t * 0.5) * 0.04, aLookZ = fp.z + fwdZ * ahead
      TMP_DIR.set(fwdX, fwdY, fwdZ); TMP_UP2.set(0, 1, 0).applyAxisAngle(TMP_DIR, active.bankCur) // バンクした上ベクトル

      camX = lerp(ex, active.camPos.x, flyAmt); camY = lerp(ey, active.camPos.y, flyAmt); camZ = lerp(ez, active.camPos.z, flyAmt)
      lookX = lerp(look.x, aLookX, flyAmt); lookY = lerp(look.y, aLookY, flyAmt); lookZ = lerp(look.z, aLookZ, flyAmt)
      upX = lerp(0, TMP_UP2.x, flyAmt); upY = lerp(1, TMP_UP2.y, flyAmt); upZ = lerp(0, TMP_UP2.z, flyAmt)
      const speedMag = Math.hypot(active.vel.x, active.vel.y, active.vel.z)
      const aloftFov = (isWalk ? FLY.walkFov : FLY.fov) + (isWalk ? 0 : Math.min(1, speedMag / FLY.speed) * FLY.fovSpeedGain)
      fov = lerp(winFov, aloftFov, flyAmt)
      windSpeed01 = (isWalk ? 0 : Math.min(1, speedMag / FLY.speed)) * flyAmt // 飛行の速さ＝風の膨らみ

      // 浮遊感: ホバリングはゆっくり上下に漂い、速いとかすかに揺れる。歩行は頭が弾む。
      const sp01 = Math.min(1, speedMag / (isWalk ? FLY.walkSpeed : FLY.speed))
      if (isWalk) {
        camY += Math.sin(t * 8.0) * 0.03 * sp01 * flyAmt // 一人称寄りでは頭の弾みを控えめに（酔い配慮）
        camX += Math.sin(t * 4.0) * 0.015 * sp01 * flyAmt
      } else {
        camY += (Math.sin(t * 0.8) * 0.16 * (1 - sp01) + Math.sin(t * 7.3) * 0.12 * sp01) * flyAmt
        camX += Math.sin(t * 5.1) * 0.12 * sp01 * flyAmt
      }
      // 着地の沈み込み（とんと沈んで戻る＝接地の手応え）
      if (active.dipT > 0) { active.dipT -= dt; const pp = 1 - Math.max(0, active.dipT) / 0.42; camY -= Math.sin(pp * Math.PI) * 0.6 }
      // 自分の影が真下の地面を走る（高度で大きさ・濃さが変わる＝飛んでいる手応え）
      const gY = heightAt(active.flyPos.x, active.flyPos.z)
      const alt = Math.max(0, active.flyPos.y - gY)
      flyerShadow.visible = flyAmt > 0.5
      flyerShadow.position.set(active.flyPos.x, gY + 0.06, active.flyPos.z)
      const ssc = isWalk ? 2.1 : (2.3 + alt * 0.1)
      flyerShadow.scale.set(ssc, ssc, ssc)
      flyerShadow.material.opacity = Math.max(0, (isWalk ? 0.34 : 0.44 - alt * 0.004)) * flyAmt
      // 高速時の速度感＝画面の縁がそっと締まるヴィネット（飛行のみ・変化時だけ書き換え）
      const vig = (isWalk ? 0 : Math.min(1, speedMag / FLY.speed)) * flyAmt
      if (Math.abs(vig - speedVigCur) > 0.02) { speedVigCur = vig; speedVig.style.opacity = (vig * 0.5).toFixed(2) }
      // 雲を抜けると白くかすむ＝いちばん近い雲の中心までの距離で白みを出す（飛行のみ）
      let nearC = 1e9
      if (!isWalk) for (const c of clouds) { const dx = c.position.x - active.flyPos.x, dy = c.position.y - active.flyPos.y, dz = c.position.z - active.flyPos.z; const d2 = dx * dx + dy * dy + dz * dz; if (d2 < nearC) nearC = d2 }
      const haze = isWalk ? 0 : Math.max(0, 1 - Math.sqrt(nearC) / 15) * flyAmt
      if (Math.abs(haze - cloudHazeCur) > 0.02) { cloudHazeCur = haze; cloudHaze.style.opacity = (haze * 0.82).toFixed(2) }
      // 高度で空気が冷たく淡くなる（高く昇るほど淡い寒色を被せる）＋環境音をしぼる
      const altT = isWalk ? 0 : Math.max(0, Math.min(1, (active.flyPos.y - 34) / 46)) * flyAmt
      if (Math.abs(altT - altTintCur) > 0.02) { altTintCur = altT; altTint.style.opacity = (altT * 0.16).toFixed(2) }
      altDuck01 = altT
      // 夕暮れ・夜の光の粒（暗い空ほど見え、カメラ周辺を漂い流れる）
      const moteOp = duskAmt * flyAmt * 0.4
      motes.visible = moteOp > 0.015
      if (motes.visible) {
        const mp = moteGeo.attributes.position.array
        const HX = 36, HY = 24, HZ = 36
        for (let i = 0; i < moteN; i++) {
          mp[i * 3] += Math.sin(t * 0.3 + i) * 0.004
          mp[i * 3 + 1] += Math.cos(t * 0.22 + i * 1.3) * 0.003 + 0.004 // ゆるく昇る
          mp[i * 3 + 2] += Math.sin(t * 0.26 + i * 0.7) * 0.004
          if (mp[i * 3] - camX > HX) mp[i * 3] -= 2 * HX; else if (mp[i * 3] - camX < -HX) mp[i * 3] += 2 * HX
          if (mp[i * 3 + 1] - camY > HY) mp[i * 3 + 1] -= 2 * HY; else if (mp[i * 3 + 1] - camY < -HY) mp[i * 3 + 1] += 2 * HY
          if (mp[i * 3 + 2] - camZ > HZ) mp[i * 3 + 2] -= 2 * HZ; else if (mp[i * 3 + 2] - camZ < -HZ) mp[i * 3 + 2] += 2 * HZ
        }
        moteGeo.attributes.position.needsUpdate = true
        moteMat.opacity = moteOp
      }
      // 高空を速く飛ぶと飛行機雲を引く（後ろへ。一定距離ごとに一粒を撒く）
      if (!isWalk && active.flyPos.y > 38 && speedMag > FLY.speed * 0.45) {
        trailAccum += speedMag * dt
        const inv = 1 / Math.max(speedMag, 0.001)
        const tarr = trailGeo.attributes.position.array
        while (trailAccum > 2.5) {
          trailAccum -= 2.5
          const k = trailIdx * 3
          tarr[k] = active.flyPos.x - active.vel.x * inv * 2.2 + (Math.random() - 0.5) * 1.2
          tarr[k + 1] = active.flyPos.y + (Math.random() - 0.5) * 0.8
          tarr[k + 2] = active.flyPos.z - active.vel.z * inv * 2.2 + (Math.random() - 0.5) * 1.2
          trailAlpha[trailIdx] = 1
          trailIdx = (trailIdx + 1) % trailN
        }
      }
    }
    // 着地の砂ぼこりが広がって薄れる
    if (active.landDustT > 0) {
      active.landDustT -= dt
      const p = 1 - Math.max(0, active.landDustT) / 0.7
      const sc = 1.4 + p * 5.5
      landDust.scale.set(sc, sc, sc)
      landDust.material.opacity = Math.max(0, 1 - p) * 0.5
      if (active.landDustT <= 0) landDust.visible = false
    }
    // 飛行機雲が後ろでゆっくり薄れていく（撒いた粒の寿命を減らし、白×濃さで描く）
    let trailAlive = false
    const carr = trailGeo.attributes.color.array
    for (let i = 0; i < trailN; i++) {
      if (trailAlpha[i] > 0) { trailAlpha[i] = Math.max(0, trailAlpha[i] - dt / 4.5); trailAlive = trailAlive || trailAlpha[i] > 0 }
      const a = trailAlpha[i] * 0.13
      carr[i * 3] = a; carr[i * 3 + 1] = a; carr[i * 3 + 2] = a
    }
    if (trail.visible || trailAlive) { trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true }
    trail.visible = trailAlive
    camera.up.set(upX, upY, upZ)
    camera.position.set(camX, camY, camZ)
    if (Math.abs(fov - active.fovCur) > 0.04) { active.fovCur = fov; camera.fov = fov; camera.updateProjectionMatrix() }
    camera.lookAt(lookX, lookY, lookZ)
    // とまる/すすむ ボタンは飛行のときだけ出す（歩行・窓辺では隠す）。出すときに現在の状態でラベルを合わせる。
    const showCruise = active.mode === 'fly' && active.flyP > 0.4
    if (showCruise !== cruiseShown) { cruiseShown = showCruise; cruiseBtn.classList.toggle('cruise--on', showCruise); if (showCruise) cruiseBtn.textContent = active.cruise ? 'とまる' : 'すすむ' }
    onSpeed(windSpeed01) // 風音を飛行速度で膨らませる（main→audio.setFlyWind）
    onAltitude(altDuck01) // 高空で街の環境音をしぼる（main→audio.setAltitudeDuck）

    // 窓ガラスと横桟は、あけると横へすべって消える（引き違い窓）。乗り出すと枠ごと外へ退く。
    glass.style.transform = `translateX(${(wo * 96).toFixed(1)}%) scale(${(1 + lean * 0.5).toFixed(3)})`
    glass.style.opacity = ((1 - wo * 0.92) * (1 - lean)).toFixed(3)
    cross.style.transform = `translateX(${(wo * 96).toFixed(1)}%)`
    cross.style.opacity = ((1 - wo) * (1 - lean)).toFixed(3)
    // サッシ・窓台は乗り出すと拡大しながら退いて外気だけに（枠を通り抜ける手応え）。
    // 乗り出しきったら完全に消す（×0.96/×0.9だと中央の縦桟や枠が4〜10%残って黒い線になる＝指摘の不具合）。
    frame2.style.transform = `scale(${(1 + lean * 0.55).toFixed(3)})`
    frame2.style.opacity = Math.max(0, 1 - lean * 1.2).toFixed(3)
    sill.style.transform = `translateY(${(lean * 130).toFixed(1)}%)`
    sill.style.opacity = Math.max(0, 1 - lean * 1.18).toFixed(3)
    paper.style.opacity = (0.18 * (1 - lean * 0.6)).toFixed(3) // 紙目をやや強め水彩の手触りに（乗り出すと薄れる）
    // ガラス越しのくすみを、あけ／乗り出しに応じて晴らす（外気が澄む）。変化時だけ書き換え。
    const clarity = Math.min(1, wo * 0.6 + lean * 0.7)
    if (Math.abs(clarity - clarityCur) > 0.004) {
      clarityCur = clarity
      applyStageFilter() // clarity（窓あけ）とユーザ明るさを合成して反映
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
    window.__town3dFly = (b) => setTown3dFly(!!b) // 検証用: 空へ飛び立つ/窓へもどる
    window.__town3dLand = (b) => setTown3dLand(!!b) // 検証用: 着地して歩く/また飛び立つ
    window.__town3dMove = (x, y) => { if (active) { active.moveX = x || 0; active.moveY = y || 0 } } // 検証用: スティック入力(-1..1)。0,0で離す
    window.__town3dClimb = (v) => { if (active) active.climb = v || 0 } // 検証用（旧）
    window.__town3dSteer = (dx, dy) => applyTown3dSteer(dx || 0, dy || 0) // 検証用: 飛行のドラッグ操舵(画面比)。横=旋回・縦=上昇下降
    window.__town3dCruise = (b) => setTown3dCruise(!!b) // 検証用: とまる(false)/すすむ(true)
    window.__town3dZoom = (v) => { if (active) active.zoom = Math.max(0.4, Math.min(3.0, v || 1)) } // 検証用: ズーム(0.4寄り〜3.0引き)
    window.__town3dClouds = () => clouds.map((c) => [+c.position.x.toFixed(1), +c.position.y.toFixed(1), +c.position.z.toFixed(1)]) // 検証用: 雲の位置一覧
    window.__town3dDbg = () => active && ({ // 検証用: 自機の状態（モード・速度・バンク等）
      mode: active.mode, fly: +active.flyP.toFixed(2), x: +active.flyPos.x.toFixed(1), y: +active.flyPos.y.toFixed(1), z: +active.flyPos.z.toFixed(1),
      yaw: +active.flyYaw.toFixed(2), pitch: +active.flyPitch.toFixed(2),
      vel: +Math.hypot(active.vel.x, active.vel.y, active.vel.z).toFixed(2), mvX: +active.moveX.toFixed(2), mvY: +active.moveY.toFixed(2), bank: +active.bankCur.toFixed(2),
    })
    // 検証用: 浮遊の自機を任意の位置・向きへ即座に置いて撮影する（飛行視点のサムネ確認）
    window.__town3dFlyPose = (x, y, z, yaw, pitch) => {
      if (!active || !active.flyEnabled) return
      active.flyPos.set(x, y, z)
      active.flyYaw = active.flyYawTarget = yaw || 0
      active.flyPitch = active.flyPitchTarget = pitch || 0
      active.vel.set(0, 0, 0); active.bankCur = 0; active.camReady = false // 引いたカメラを新しい位置へスナップ
      if (active.mode === 'window') active.mode = 'fly'
      active.flyP = 1; active.flyTarget = 1
    }
  }

  // 移動スティック（ぷにコン）の見た目＝触れた場所に出る円とつまみ。空/地上でだけ現れる。
  const stickWrap = document.createElement('div'); stickWrap.className = 'town3d-stick'
  const stickBase = document.createElement('div'); stickBase.className = 'town3d-stick__base'
  const stickKnob = document.createElement('div'); stickKnob.className = 'town3d-stick__knob'
  stickBase.appendChild(stickKnob); stickWrap.appendChild(stickBase); stage.appendChild(stickWrap)

  // ── 操作: 窓辺はドラッグで見回し。空/地上は左半分=移動スティック・右半分=見回し（両手で同時可）。──
  const dom = renderer.domElement
  dom.style.touchAction = 'none' // スクロール/ピンチに操作を奪われない
  let lookId = null, lookLX = 0, lookLY = 0          // 見回し中のポインタ（歩行）
  let stickId = null, stickOX = 0, stickOY = 0       // 移動スティック中のポインタ＋発生原点（歩行）
  let steerId = null, steerLX = 0, steerLY = 0       // 飛行のドラッグ操舵中のポインタ（スキームA）
  const aloftNow = () => active && (active.mode === 'fly' || active.mode === 'walk')
  const setStick = (dx, dy) => {
    let nx = dx / FLY.stickRadius, ny = -dy / FLY.stickRadius // 上方向(画面上)を前進(+)に
    const m = Math.hypot(nx, ny); if (m > 1) { nx /= m; ny /= m }
    const dead = FLY.stickDead
    active.moveX = Math.abs(nx) < dead ? 0 : nx
    active.moveY = Math.abs(ny) < dead ? 0 : ny
    const kx = Math.max(-1, Math.min(1, dx / FLY.stickRadius)) * FLY.stickRadius
    const ky = Math.max(-1, Math.min(1, dy / FLY.stickRadius)) * FLY.stickRadius
    stickKnob.style.transform = `translate(${kx.toFixed(0)}px, ${ky.toFixed(0)}px)`
  }
  const showStick = (x, y) => {
    stickBase.style.left = x + 'px'; stickBase.style.top = y + 'px'
    stickWrap.classList.add('stick--on'); stickKnob.style.transform = 'translate(0,0)'
  }
  const hideStick = () => { stickWrap.classList.remove('stick--on'); if (active) { active.moveX = 0; active.moveY = 0 } }
  const pointers = new Map() // 全ポインタ id->{x,y}（ピンチ＝2本指ズームの判定用）
  let pinchD0 = 0, pinchZoom0 = 1
  const onDown = (e) => {
    if (!active) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2) { // 2本指＝ピンチでズーム開始。単指の操舵/移動は解除する。
      const p = [...pointers.values()]
      pinchD0 = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1
      pinchZoom0 = active.zoom
      steerId = null; stickId = null; hideStick()
      if (lookId !== null) { lookId = null; active.lookDragging = false }
      return
    }
    if (pointers.size > 2) return
    const rect = stage.getBoundingClientRect()
    const lx = e.clientX - rect.left
    if (active.mode === 'fly') {
      if (steerId === null) { steerId = e.pointerId; steerLX = e.clientX; steerLY = e.clientY } // 飛行＝どこをドラッグしても操舵
    } else if (active.mode === 'walk' && stickId === null && lx < rect.width * 0.5) {
      stickId = e.pointerId; stickOX = e.clientX; stickOY = e.clientY // 歩行の左半分＝スティック発生
      showStick(lx, e.clientY - rect.top); setStick(0, 0)
    } else if (lookId === null) {
      lookId = e.pointerId; lookLX = e.clientX; lookLY = e.clientY // 歩行の右半分/窓辺＝見回し
      active.lookDragging = true
    }
  }
  const onMove = (e) => {
    if (!active) return
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size >= 2) { // ピンチ＝ズーム（指を開く=寄り／閉じる=引き）。止まっても飛んでも自在に引ける。
      const p = [...pointers.values()]
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1
      active.zoom = Math.max(0.4, Math.min(3.0, pinchZoom0 * (pinchD0 / d)))
      return
    }
    const w = stage.clientWidth || 1, h = stage.clientHeight || 1
    if (e.pointerId === steerId) {
      applyTown3dSteer((e.clientX - steerLX) / w, (e.clientY - steerLY) / h) // 飛行のドラッグ操舵
      steerLX = e.clientX; steerLY = e.clientY
    } else if (e.pointerId === stickId) setStick(e.clientX - stickOX, e.clientY - stickOY)
    else if (e.pointerId === lookId) {
      applyTown3dLook((e.clientX - lookLX) / w * -1.0, (e.clientY - lookLY) / h * 1.0)
      lookLX = e.clientX; lookLY = e.clientY
    }
  }
  const onUp = (e) => {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinchD0 = 0 // ピンチ終了
    if (e.pointerId === steerId) steerId = null
    if (e.pointerId === stickId) { stickId = null; hideStick() }
    if (e.pointerId === lookId) { lookId = null; if (active) active.lookDragging = false }
  }
  dom.addEventListener('pointerdown', onDown)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  // dispose に後始末を足す
  const baseDispose = active.dispose
  active.dispose = () => {
    dom.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    window.removeEventListener('resize', resize)
    baseDispose()
  }
}
