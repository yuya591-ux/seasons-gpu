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
  leanFwd: 6.5,     // 乗り出しでカメラが前へ出る量（枠の手前で“引き気味”に顔を出す＝のめり込み過ぎず街を見渡す）
  leanDown: 0.9,    // 乗り出しでカメラが下がる量（落とし過ぎると窓の下・ベランダ手すりを貫通＝なるべく高い位置で手すりの上から乗り出す）
  leanFov: 7.0,     // 乗り出しで画角が広がる量(度)
  leanLook: 3.2,    // 乗り出しで視線が下を覗き込む量（手前の木立へ落ち込み過ぎない程度に抑制＝評価UX-H2）
  leanPitchUp: 1.10, // 乗り出し時に上を見上げられる範囲（空・ビル上層まで仰げる）。大きいほど上が見える
  leanPitchDn: 0.55, // 乗り出し時に下を見下ろせる範囲の拡張（ユーザー要望でさらに下＝足下の街まで覗ける）
  lookPitch: 18,    // 見上げ/見下ろしの効き（pitch→視線の縦移動量）。大きいほど少しのスワイプで大きく振れる
  fov0: 62,         // 基準画角(度)
  roomParallaxX: 1.2, // 室内視差(横): 見回すと頭がわずかに左右へ（覗き込む手応え）。3Dの室内壁を突き抜けないよう控えめに
  roomParallaxY: 0.8, // 室内視差(縦): 見上げ/見下ろしで頭が上下にわずかにずれる量
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
  cinemaSpeed: 5.0, // オートシネマ周回の速さ(u/s)。超低速で名所を巡る
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
  camBack: 11.5, camUp: 3.6, camAhead: 9,     // 飛行: 後方/上/注視先（既定をやや引き気味＝街を広く望む。±ズームで前後可変）
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
  // 飛べる箱（街を包む範囲）。これを越えない＝手描きの街の縁・未生成の余白を見せない。ランドマーク追加に合わせ広げた。
  // xMax=東の海まで飛び出せる（左右非対称。西は-x、東は海上の島・大橋を越えるxMaxまで）。
  bound: { x: 790, xMax: 790, zMin: -810, zMax: 120, yMax: 132, yFloor: 4.5 }, // Phase0で時代の島を~640へ遠ざけた汀まで飛べる（東=江戸764/西=大正-752/北=戦国-740）。zMaxはhome南の拡張ぶん
  // 谷戸（棚田の谷）用の箱。左右の里山に分け入りすぎない狭めの幅・谷筋に沿う前後＝谷を流すように飛ぶ。
  yatoBound: { x: 22, zMin: -52, zMax: 24, yMax: 74, yFloor: 4.0 },
}

// 乗り出し量(0..1)に応じた見上げ/見下ろしの可動範囲。乗り出すほど上も下も大きく振れる。
// applyTown3dLook(スワイプ時)とframeループ(戻り時の追従)の両方で使い、範囲を一元管理する。
const pitchLimits = (lean) => ({ up: 1.15 + lean * (CAM.leanPitchUp - 0.65), dn: 0.95 + lean * (CAM.leanPitchDn - 0.5) }) // 部屋の中でも天井(照明)・床まで見回せる。乗り出すと従来どおり空/足下へ

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
  const yawMax = 1.65 + l * 0.2  // 部屋の中を左右に見渡せる（横を向くと側壁・家具が見える）。乗り出すとさらに広く
  const lim = pitchLimits(l)     // 上（天井・照明）も下（床・街）も見られる
  // 目標値を動かし、frame loop でイージング追従（指を離しても余韻＝ヌルヌル）。感度UP。
  active.yawTarget = Math.max(-yawMax, Math.min(yawMax, active.yawTarget + dx * 2.4))
  active.pitchTarget = Math.max(-lim.dn, Math.min(lim.up, active.pitchTarget + dy * 1.2)) // 縦の感度を下げ、手前の木立へ視線が落ち込み過ぎないように（評価UX-H2）
}

// 飛行（スキームA）のドラッグ操舵: 進む向き(flyYaw)と機首の上下(flyPitch)を動かす。dx/dy は画面比の移動量
// （右ドラッグ=dx+ / 下ドラッグ=dy+）。横で旋回、上で上昇・下で下降。離しても巡航は続く。
export function applyTown3dSteer(dx, dy) {
  if (!active) return
  active.flyYawTarget += dx * FLY.steerYaw // 右ドラッグ＝右へ旋回（窓辺の見回しと同じ素直な横）
  // 縦は窓辺の見回しと統一（マリオ式）: 下ドラッグ＝機首上げ＝見上げて上昇／上ドラッグ＝見下ろして下降。
  active.flyPitchTarget = Math.max(-FLY.pitchMax, Math.min(FLY.pitchMax, active.flyPitchTarget + dy * FLY.steerPitch))
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
      active.flyPitch = Math.asin(Math.max(-1, Math.min(1, dy))); active.flyPitchTarget = 0 // 飛び立ちは見下ろしから滑らかに水平へ。以後はドラッグで向けた角度を保持（固定）
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
  let qCap = PR_CAP // 現在の画質上限（setQualityで変わる）。飛行中の解像度落としの基準に使う
  let prFly = false // 上空で解像度をひと段下げているか（離陸/着地でのみ切替＝毎フレームのsetSizeを避ける）
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
  const bound = kind === 'yato' ? FLY.yatoBound : FLY.bound // 飛べる箱は情景ごと（谷戸は谷筋に沿う狭め）
  const onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : () => {} // 定期イベント発火を外へ伝える（音の結線）
  const onSpeed = typeof opts.onSpeed === 'function' ? opts.onSpeed : () => {} // 飛行速度(0..1)を外へ伝える（風音の膨らみ）
  const onFoot = typeof opts.onFoot === 'function' ? opts.onFoot : () => {} // 歩行で一歩ごとに伝える（足音）
  const onBirdFlush = typeof opts.onBirdFlush === 'function' ? opts.onBirdFlush : () => {} // 鳥が驚いて飛び立つ（羽音）
  const onAltitude = typeof opts.onAltitude === 'function' ? opts.onAltitude : () => {} // 飛行高度(0..1)を外へ伝える（高空で環境音をしぼる）
  const onScene = typeof opts.onScene === 'function' ? opts.onScene : () => {} // 場面（部屋/窓/飛行/歩行・速度・高度・地形・時代の近さ）を外へ伝える（BGMの下地）
  const onSeaBird = typeof opts.onSeaBird === 'function' ? opts.onSeaBird : () => {} // 海の上で時々かもめが鳴く（海らしさ＋渡りの退屈しのぎ）
  const onPurr = typeof opts.onPurr === 'function' ? opts.onPurr : () => {} // 窓辺の猫を撫でるとゴロゴロ鳴る（0..1）
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
  // 谷戸は谷筋が奥へ深く退く構図＝主役の棚田まで霞んで灰に沈むため、霞を一段奥へ送って手前〜中景の
  // 水鏡・青田の色を残す（遠い里山だけ空気に溶ける）。密集した街は従来どおり手前から霞ませて水彩の奥行きに。
  const FOG = kind === 'yato'
    ? { near: weather === 'snow' ? 54 : 48, far: weather === 'snow' ? 176 : 168 }
    : { near: weather === 'snow' ? 40 : 30, far: weather === 'snow' ? 146 : 132 } // 大気遠近を一段深め、中景から空気に溶け始める水彩の奥行きへ（手前は鮮明に保つ）
  scene.fog = new THREE.Fog(fogCol, FOG.near, FOG.far)

  // 空ドーム（上=空色, 下=地平の暖色のグラデ）。飛行中は uniform を暖色へ寄せて懐かしい黄昏の空にする。
  const skyUniTop = { value: skyTop.clone() }
  const skyUniBot = { value: skyHorizon.clone() }
  const skyTop0 = skyTop.clone(), skyHor0 = skyHorizon.clone() // 窓辺に戻った時に復元する基準
  let skyDome = null
  {
    // ドームをカメラ全軸に追従させる（毎フレ camera位置へ移動）＝拡大世界(拠点は原点から約500)の
    // どこへ飛んでも空が常に周囲を覆う。半径はカメラのfar(600)内に収め頂部がクリップされないようにする
    // （以前は半径400・原点中心で、戦国/大正へ飛ぶとカメラがドーム外/far外に出て空が無く「黒い虚空」になっていた）。
    const skyGeo = new THREE.SphereGeometry(560, 24, 16)
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { top: skyUniTop, bot: skyUniBot },
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bot; void main(){ float h=clamp(vP.y/560.0*1.7+0.2,0.0,1.0); gl_FragColor=vec4(mix(bot,top,h),1.0);} ',
    })
    skyDome = new THREE.Mesh(skyGeo, skyMat); skyDome.frustumCulled = false; skyDome.renderOrder = -1; scene.add(skyDome)
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
  // 別世界感の演出の基準値＋時代ごとの空気の色（江戸=金茶／戦国=青墨）。飛行時に近さで混ぜる。
  const baseFogCol = scene.fog.color.clone(), baseExposure = renderer.toneMappingExposure
  const EDO_FOGC = new THREE.Color(isNight ? 0x5a4c34 : 0xc6a064), SEN_FOGC = new THREE.Color(isNight ? 0x2a323e : 0x586374), TAISHO_FOGC = new THREE.Color(isNight ? 0x4a3640 : 0xd6a684), TMP_FOGC = new THREE.Color() // 江戸=金茶/戦国=青墨/大正=暖かなセピア薔薇（時代ごとに別世界の空気）
  // 渡りの空気: 飛行中は霧を「冷たい白」から「懐かしい琥珀色の夕景」へ寄せる＝白いモヤの圧迫感を脱しエモい/ノスタルジックに（実機FB）
  const FLIGHT_WARM = new THREE.Color(isNight ? 0x3a3446 : 0xe0c49a)
  // 飛行中の空ドームの暖色（昼=黄昏の琥珀、夜=ぶどう色の宵）。霧の FLIGHT_WARM と揃えて世界全体を懐かしい色へ。
  const SKY_WARM_TOP = new THREE.Color(isNight ? 0x2c2740 : 0x9fb0c0)
  const SKY_WARM_BOT = new THREE.Color(isNight ? 0x3a2f3e : 0xf0cda0)
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
  function makeWinTex(lit, seed, opt = {}) {
    const litRatio = opt.litRatio ?? 0.45 // 灯る窓の割合（夜は増やして街を瞬かせる）
    const litCol = opt.litCol ?? '#ffd089' // 灯りの色
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
        const on = rnd() < litRatio
        g.fillStyle = on ? litCol : '#0a0a0a'
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
  // 夜は灯る窓を増やし（街が瞬く）、色をわずかに濃い暖色へ。夕は控えめ。
  const winEmis = [3, 11, 29, 53].map((s) => makeWinTex(true, s, { litRatio: isNight ? 0.7 : 0.46, litCol: isNight ? '#ffdca0' : '#ffd089' }))
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
  let residents = [] // 作り込んだ住人（顔つき・アニメ調）。近くで見える要所に少数配置＝量産は階層分けで
  let animeSprites = [] // 2Dアニメ絵のキャラ（キャンバスに手描き風・板ポリでカメラを向く）＝試作
  let ferris = null
  let carousel = null // 遊園地のメリーゴーラウンド（ゆっくり回る）
  let teacups = null // 遊園地のコーヒーカップ（回る）
  let steamPuffs = [] // 夏祭りの屋台の湯気（立ちのぼる）
  let koinobori = [] // 春の鯉のぼり（風になびく）
  let swanBoats = [] // 遊園地のスワンボート（池を漂う）
  let boats = [] // 海に浮かぶ小舟（ゆるく揺れる）
  let edoFx = null, senFx = null, taiFx = null, veilEl = null // 別世界の演出（時代の舞う粒子＋霞の帯の白いベール）
  let cityWalkers = [] // 城下を行き交う人（大通り/山道をゆっくり往復＝動く生気）
  const senMist = [] // 戦国の谷にたなびく霧の帯（ゆっくり漂う）
  const trams = [] // 大正の港町を走る路面電車（大通りを往復）
  let crossFlock = null, crossT = 99, crossNext = 5 // 渡りの海で時々カメラの近くを横切る鳥の群れ（退屈しのぎ）
  let islandFlocks = [] // 道中の小島で羽を休める鳥（飛行で近づくと一斉に舞い立つ）
  let critters = [] // 舞う蝶/蜻蛉（frameでふわふわ）＝街/季節ごとの生きもの
  let seaTex = null // 海面テクスチャ（さざ波をスクロールさせ動く水面に）
  let seaUniforms = null // 海面シェーダーの時間（うねり・きらめき）
  let lightBeam = null // 灯台の光芒（夜に回る）
  let train = null // 線路を走る電車
  let train2 = null // もう一本の電車（色違い・半周ずらして走る）
  let crossing = null // 踏切（電車が近づくと遮断機が下り警報灯が点滅）
  let gulls = [] // 海鳥（湾の上を旋回する）
  let crane = null // ガントリークレーンの動く部分（トロリー＋フック）
  let tug = null // 湾を行き来するタグボート
  let ferry = null // 湾を渡る連絡船
  let balloons = [] // 空を漂う熱気球
  let fishJumps = [] // 海面で時々跳ねる魚＋波紋
  let seasonFall = null // 季節の降りもの（春=花びら／秋=落ち葉。公園のあたりに舞う）
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
  // 線路（駅のホーム外側を通り、街を横切る一直線）。電車が走る。z は駅の線路に合わせる。
  const RAIL = { z: STATION.z - 7.4, x0: -6, x1: 60 }
  // 公園（街の中ほどの広場）。浅い池に空を映し、太鼓橋・桜・石灯籠・ベンチで憩う。飛んで降りる目的地。
  const PARK = { x: 16, z: -27, r: 12, pondR: 5.4, pondDepth: 2.4 }
  // 展望塔（谷を見はるかす街の塔）。高く昇って並ぶ目印・飛んで上がる目的地。谷の中ほどに立てる。
  const TOWER = { x: -7, z: -48, r: 6 }
  // 寺（五重塔のある仏閣）。谷の右奥の中腹に。観覧車と対をなす高い目印・飛んでいく目的地。
  const TEMPLE = { x: 40, z: -74, r: 14 }
  // 学校（校舎と校庭）。街の右手の一角。時計塔・トラック・桜並木＝町の馴染みの場所。
  const SCHOOL = { x: 54, z: -18, r: 13 }
  // 遊園地（既存の観覧車を中心に）。メリーゴーラウンド・遊具・ゲート＝明るい賑わいの目的地。
  const FUN = { x: -26, z: -66, r: 13 }
  // 副都心（拡張した西の一角＝ガラスの高層ビル街）。旗艦homeの現代的な核＝街のスカイライン。飛んでいく目的地。
  const DOWNTOWN = { x: -118, z: -56, r: 27 }
  // 競技場（拡張した西奥の大きなスタジアム）。楕円のスタンド＋照明塔＝旗艦homeの大型施設。飛んでいく目的地。
  // padY=造成地の平らな盤の高さ（坂を均してスタンドが埋もれないように）。
  const STADIUM = { x: -150, z: -116, r: 22, padY: 4 }
  // 海（街の東の縁が湾へ下る）。x>coast で地形を海底へ下げ、shore より沖は水面。飛んで海まで行ける。
  // 海面は谷底より低く取る＝谷を水没させず、東の縁だけが汀へ落ちる（丘が海へ落ちる入江状の海岸線）。
  const SEA = { coast: 64, shore: 82, level: -10, floor: -13.5, westCoast: -205, westShore: -232 } // 東岸(x>64)＋西岸(x<-205)を海へ落とす。Phase1で西岸を外へ広げ旗艦homeを西へ拡大（大正は遠いので渡りは十分長い）
  // 臨海の港（埋立地の平らな工業の岸）。倉庫・煙突・クレーン・ガスタンク＝鶴見の臨海らしさ。
  const HARBOR = { x: 74, z: -64, r: 11, padY: SEA.level + 2 }
  // 湾に浮かぶ小島（大橋の対岸）。地形を海面上へ盛り上げる。橋でつながる目的地。
  const ISLAND = { x: 98, z: -40, r: 8 }
  // Phase0(2026-06-21): home を旗艦＝最大にするため、時代の島を home からさらに遠ざけ(~640)余地をつくる。海の渡りが長くなる＝旅情UP。共視界は据置で保てる（縁の霧で隠れる）。
  const EDO = { x: 640, z: -46, r: 124 } // 東の海の向こうの江戸の城下町。homeから遠ざけ拡大の余地
  const SENGOKU = { x: 140, z: -640, r: 54 } // 北の海の果ての戦国の山城（霧の谷あいの城下町）。homeから遠ざけ
  const TAISHO = { x: -640, z: -30, r: 112 } // 西の海の向こうの大正の港町。homeから遠ざけ
  const CINEMA_LM = [{ x: 0, z: 0 }, { x: EDO.x, z: EDO.z }, { x: SENGOKU.x, z: SENGOKU.z }, { x: TAISHO.x, z: TAISHO.z }] // オートシネマで周回する名所（現代の街/江戸/戦国/大正の中心）
  // 江戸の島を蛇行する小川の川筋。中心線からの横距離を返す（小さいほど川。堀の内/島の外は川なし）。heightAtの掘り込みと建物除外で共用。
  const edoStream = (x, z) => { const dx = x - EDO.x, dz = z - EDO.z, edd = Math.hypot(dx, dz); if (edd < 23 || edd > EDO.r - 6) return 999; let da = Math.atan2(dz, dx) - (1.15 + Math.sin(edd * 0.085) * 0.34); da = Math.atan2(Math.sin(da), Math.cos(da)); return Math.abs(da) * edd }
  // 大正の島の運河（港から内陸へまっすぐ引かれた水路）。中心線(z=tz+18)からの距離。
  const taishoCanal = (x, z) => { const dx = x - TAISHO.x; if (dx < -TAISHO.r + 6 || dx > 30) return 999; return Math.abs(z - (TAISHO.z + 17)) }
  // 戦国＝「霧の谷あいの城下町」の地形（単一の急な円錐を脱し、川の谷＋両側のなだらかな尾根＋背後の山並みへ作り替え）。
  // 南(+z=現代/海の側)に河口が開き、川が谷を南北に蛇行。谷底に城下町、東の尾根の中腹の平場(bluff)に城。
  // 起伏は意図配置のガウス丘の和＝放射対称でなく自然。海(SEA.level)へ向け裾が落ちる。メッシュ/配置/heightAt が共有。
  const senR = 80
  const senValley = (dz) => Math.sin((dz + 10) * 0.02) * 9 + Math.sin(dz * 0.05) * 4 // 川筋の蛇行（中心xのオフセット）
  const senBluff = { dx: 28, dz: -8 } // 城の建つ東尾根の中腹の平場（中央でなく片側）
  // 尾根・峰のガウス丘 [dx, dz, 高さ, σx, σz]。等間隔を避け、東西の尾根＋背後(北)の高い山並み。
  const SEN_HILLS = [[38, -40, 15, 18, 28], [senBluff.dx, senBluff.dz, 13, 30, 36], [-44, -28, 15, 26, 32], [-28, 16, 9, 28, 28], [6, -66, 21, 40, 22], [50, -64, 16, 24, 20], [-46, -58, 15, 28, 22]]
  const senH = (x, z) => {
    const dx = x - SENGOKU.x, dz = z - SENGOKU.z
    const ex = dx / 74, ez = (dz - 4) / 88, env = ex * ex + ez * ez // 南北に長い島の輪郭
    if (env > 1.3) return -999 // 島の外＝海（呼び元で無視）
    const coast = Math.pow(Math.max(0, 1 - env), 0.72) // 縁で海へ落ちる（平場ぎみ→汀で急落）
    let land = 3 // 谷底の低い土地（海面より少し上）
    for (const [hx, hz, hh, sgx, sgz] of SEN_HILLS) land += hh * Math.exp(-((dx - hx) ** 2 / (2 * sgx * sgx) + (dz - hz) ** 2 / (2 * sgz * sgz))) // 尾根と峰
    const cl = senValley(dz), vd = Math.abs(dx - cl) // 川筋からの横距離
    const valley = Math.max(0, 1 - vd / 26); land -= valley * valley * 9 // 谷底をなだらかに下げる（城下町が収まる）
    const channel = Math.max(0, 1 - vd / 5); land -= channel * channel * 3 // 川そのものはもう少し深く
    land += Math.sin(dz * 0.12 + dx * 0.05) * 1.2 * Math.min(1, vd / 20) // 斜面のゆるい起伏（尾根筋）
    return land * coast - 0.5
  }
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
    let h = vy + bump - dip - pondDip
    // 海への傾斜（東の縁 x>coast で海底へ向けて下げる＝丘が汀へ落ちる）。
    const sb = Math.min(1, Math.max(0, (x - SEA.coast) / (SEA.shore - SEA.coast)))
    if (sb > 0) h += (SEA.floor - h) * (sb * sb)
    // 西の海への傾斜（西の縁 x<westCoast で海底へ。西の海の向こうの大正の港町への渡り）
    const wb = Math.min(1, Math.max(0, (SEA.westCoast - x) / (SEA.westCoast - SEA.westShore)))
    if (wb > 0) h += (SEA.floor - h) * (wb * wb)
    // 臨海の港の埋立地＝平らな岸（海面より少し上の盤）。縁はなだらかに均す。
    const hd = Math.hypot(x - HARBOR.x, z - HARBOR.z)
    if (hd < HARBOR.r) h += (HARBOR.padY - h) * Math.min(1, (HARBOR.r - hd) / 4)
    // 競技場の造成地＝坂の斜面を平らに均した盤（これが無いとスタンドが斜面に埋もれる）。縁を5mで擦り付け。
    const std = Math.hypot(x - STADIUM.x, z - STADIUM.z)
    if (std < STADIUM.r + 5) h += (STADIUM.padY - h) * Math.min(1, (STADIUM.r + 5 - std) / 5)
    // 湾の小島＝海面から盛り上がるドーム（橋の対岸）。海より高い所だけ採用（島が海から覗く）。
    const isd = Math.hypot(x - ISLAND.x, z - ISLAND.z)
    if (isd < ISLAND.r) h = Math.max(h, 2.2 - Math.pow(isd / ISLAND.r, 2) * 14)
    // 海の向こうの島（城下町）＝海から立ち上がる台地。中央(edd<20)は天守を載せる平場、外周は汀へ落ちる。
    const edd = Math.hypot(x - EDO.x, z - EDO.z)
    if (edd < EDO.r) { const t = Math.max(0, (edd - 90) / (EDO.r - 90)); let base = 5.5 - t * t * 16
      const undul = Math.min(1, Math.max(0, (edd - 18) / 30)) // 城の周り(edd<18)は平ら、外周ほど丘の起伏
      base += (Math.sin((x - EDO.x) * 0.058) * 2.7 + Math.cos((z - EDO.z) * 0.05) * 2.3 + Math.sin((x + z) * 0.038) * 1.6) * undul // 丘の起伏（強め＝平らな台地を脱し丘の街並みに）
      const hdx = x - (EDO.x + 60), hdz = z - (EDO.z - 50); base += 12 * Math.exp(-(hdx * hdx + hdz * hdz) / 700) // 寺の高台（はっきりした丘）
      const h2x = x - (EDO.x - 58), h2z = z - (EDO.z - 28); base += 8.5 * Math.exp(-(h2x * h2x + h2z * h2z) / 760) // 西の丘
      const h3x = x - (EDO.x + 12), h3z = z - (EDO.z + 66); base += 7 * Math.exp(-(h3x * h3x + h3z * h3z) / 680) // 南の丘（町が駆け上がる）
      const sd = edoStream(x, z); base -= Math.min(1, Math.max(0, (5.2 - sd) / 2.6)) * 2.4 // 蛇行する小川を平底に掘り込む
      h = Math.max(h, base) } // 起伏する平場＋複数の丘＋小川（のっぺりした台地を脱す）
    // 北の海に立つ戦国の山城＝海から高く立ち上がる非対称の峰（senH が単一の真実の面）
    const sh = senH(x, z)
    if (sh > -990) h = Math.max(h, sh) // うねる稜線＝飛行/歩行の接地もメッシュと完全一致
    // 西の海に浮かぶ大正の港町＝海から立ち上がる低い平らな島（港は汀に。縁だけ海へ落ちる）
    const tsd = Math.hypot(x - TAISHO.x, z - TAISHO.z)
    if (tsd < TAISHO.r) { const t = Math.max(0, (tsd - 86) / (TAISHO.r - 86)); let base = 4.0 - t * t * 14
      const dtx = x - TAISHO.x, dtz = z - TAISHO.z
      base += (Math.sin(dtx * 0.05) * 1.5 + Math.cos(dtz * 0.045) * 1.3 + Math.sin((dtx + dtz) * 0.03) * 1.0) * Math.min(1, tsd / 16) // 起伏（平らな盤を脱す・強め）
      base += 15 * Math.exp(-((dtx + 44) ** 2 / 560 + (dtz - 42) ** 2 / 620)) // 港を見下ろす洋館の丘（高台＝はっきりした丘に）
      base += 12 * Math.exp(-((dtx - 52) ** 2 / 640 + (dtz + 44) ** 2 / 700)) // 異人館街の丘（東の高台＝拡大した街の新地区）
      base += 7 * Math.exp(-((dtx - 18) ** 2 / 900 + (dtz + 24) ** 2 / 1000)) // 商業地のゆるい高まり（坂の街並み）
      const quay = Math.max(0, (-46 - dtx) / 20); base -= quay * quay * 3.5 // 西の波止場は低く平らに（海へ開く埠頭）
      const cd = taishoCanal(x, z); base -= Math.min(1, Math.max(0, (4.6 - cd) / 2.4)) * 2.6 // 運河を平底に掘り込む
      h = Math.max(h, base) }
    return h
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
  // ── 時代の建物の正面テクスチャ（格子窓/連子窓/洋風窓）＝近づいても「窓のある建物」に。最初の街の質感へ統一する。 ──
  const makeFacade = (kind, baseHex) => {
    const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), base = new THREE.Color(baseHex)
    g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, S, S)
    for (let i = 0; i < 110; i++) { const v = base.clone().offsetHSL(0, 0, (R() - 0.5) * 0.06); g.globalAlpha = 0.1; g.fillStyle = '#' + v.getHexString(); g.fillRect(R() * S, R() * S, 2 + R() * 9, 2 + R() * 9) }
    g.globalAlpha = 1
    if (kind === 'machiya') { // 江戸の町家: 上段=障子の格子窓／下段=格子戸・腰板
      const wx = 22, wy = 18, ww = 84, wh = 42
      g.fillStyle = '#e9e1cc'; g.fillRect(wx, wy, ww, wh)
      g.strokeStyle = 'rgba(74,56,38,0.8)'; g.lineWidth = 1.5
      for (let i = 0; i <= 6; i++) { g.beginPath(); g.moveTo(wx + ww * i / 6, wy); g.lineTo(wx + ww * i / 6, wy + wh); g.stroke() }
      for (let i = 0; i <= 3; i++) { g.beginPath(); g.moveTo(wx, wy + wh * i / 3); g.lineTo(wx + ww, wy + wh * i / 3); g.stroke() }
      g.strokeStyle = '#4a3826'; g.lineWidth = 3; g.strokeRect(wx, wy, ww, wh)
      g.fillStyle = '#5a4632'; g.fillRect(20, 78, 88, 40); g.strokeStyle = 'rgba(28,20,12,0.55)'; g.lineWidth = 1.4
      for (let i = 0; i <= 11; i++) { g.beginPath(); g.moveTo(20 + 88 * i / 11, 78); g.lineTo(20 + 88 * i / 11, 118); g.stroke() }
    } else if (kind === 'sama') { // 戦国の侍屋敷: 連子窓（縦格子）＋板壁の横目地
      g.fillStyle = '#2c241e'; g.fillRect(30, 28, 68, 40)
      g.strokeStyle = '#6a5640'; g.lineWidth = 2.6
      for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(30 + 68 * i / 8, 28); g.lineTo(30 + 68 * i / 8, 68); g.stroke() }
      g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1
      for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(0, S * i / 6); g.lineTo(S, S * i / 6); g.stroke() }
    } else { // 大正の洋風窓＋1階の店構え（看板建築）: 上2層は上げ下げ窓、1階は店の硝子＋庇＝平らな一枚板を脱す
      for (const [wx, wy] of [[18, 12], [72, 12], [18, 50], [72, 50]]) {
        const gr = g.createLinearGradient(0, wy, 0, wy + 32); gr.addColorStop(0, '#7a8a92'); gr.addColorStop(1, '#4a5660'); g.fillStyle = gr; g.fillRect(wx, wy, 38, 32)
        g.strokeStyle = '#ece4d4'; g.lineWidth = 3.0; g.strokeRect(wx, wy, 38, 32)
        g.fillStyle = '#ece4d4'; g.fillRect(wx, wy + 14, 38, 2.2); g.fillRect(wx + 17.8, wy, 2.2, 32)
      }
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, 46, S, 2); g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 90, S, 3) // 階の帯（層境の繰形）
      g.fillStyle = '#' + base.clone().offsetHSL(0, 0, -0.09).getHexString(); g.fillRect(0, 94, S, 34) // 1階の腰壁（少し暗く）
      g.fillStyle = '#9a4a3a'; g.fillRect(6, 93, S - 12, 5) // 庇（awning）の帯
      for (const [sx2, sw] of [[14, 46], [70, 30]]) { g.fillStyle = '#cfe0e4'; g.fillRect(sx2, 101, sw, 21); g.strokeStyle = '#5a4a3a'; g.lineWidth = 2.4; g.strokeRect(sx2, 101, sw, 21); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(sx2 + 2, 103, sw - 4, 4) } // 店の大きな硝子＋上端の映り込み
    }
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.LinearFilter; t.anisotropy = LIGHT ? 1 : 4; t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
  }
  const facadeMat = (kind, baseHex) => snowify(new THREE.MeshToonMaterial({ color: 0xffffff, map: makeFacade(kind, baseHex), gradientMap: grad }))
  // 壁の接地AO（頂点色で底=翳り→上=空の光）。時代の建物の箱に焼いて、平らな箱面の一様さを破り接地感を出す。
  const bakeAO = (geo, hh) => { const pos = geo.attributes.position, col = new Float32Array(pos.count * 3); for (let i = 0; i < pos.count; i++) { const tt = Math.min(1, Math.max(0, (pos.getY(i) + hh / 2) / Math.max(0.001, hh))), ao = Math.min(1, tt / 0.26), v = 0.72 + 0.28 * ao + 0.06 * tt; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v } geo.setAttribute('color', new THREE.BufferAttribute(col, 3)) }
  // 瓦の屋根テクスチャ（横列の瓦＋軒の重なりの影＋縦の丸瓦の筋）＝単色の屋根を脱し俯瞰の質感を上げる。
  const makeTileTex = (baseHex) => {
    const W = 64, c = document.createElement('canvas'); c.width = c.height = W; const x = c.getContext('2d'), base = new THREE.Color(baseHex)
    x.fillStyle = '#' + base.getHexString(); x.fillRect(0, 0, W, W)
    for (let r = 0; r < 6; r++) { const y0 = W * r / 6, rh = W / 6
      x.fillStyle = '#' + base.clone().offsetHSL(0, 0, (R() - 0.5) * 0.05).getHexString(); x.fillRect(0, y0, W, rh)
      x.fillStyle = 'rgba(0,0,0,0.24)'; x.fillRect(0, y0 + rh - 2, W, 2)        // 軒の重なりの影
      x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(0, y0 + 0.5, W, 1) }    // 上端のハイライト
    for (let cc = 0; cc <= 7; cc++) { const xx = W * cc / 7; x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(xx - 0.5, 0, 1, W); x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(xx + 1, 0, 1, W) } // 縦の丸瓦の筋
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.anisotropy = LIGHT ? 1 : 4
    return t
  }
  const tileMat = (hex, repU, repV, dbl) => { const m = snowify(new THREE.MeshToonMaterial({ color: 0xffffff, map: makeTileTex(hex), gradientMap: grad })); m.map.repeat.set(repU, repV); if (dbl) m.side = THREE.DoubleSide; return m }
  // ── 看板（canvasで店名を描く＝オフラインで鮮明・時代ごとの字体。看板/のれん/ホーロー看板を立てる） ──
  const signCache = {}
  const signMat = (text, bg, fg, vertical, fontPx) => {
    const key = text + '|' + bg + '|' + fg + '|' + (vertical ? 'v' : 'h')
    if (signCache[key]) return signCache[key]
    const chars = [...text], c = document.createElement('canvas'), x = c.getContext('2d')
    if (vertical) { c.width = 44; c.height = 40 * Math.max(1, chars.length) + 8; x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `bold ${fontPx || 30}px "Yu Mincho","Hiragino Mincho ProN",serif`; chars.forEach((ch, i) => x.fillText(ch, c.width / 2, 40 * i + 24)) }
    else { c.width = 132; c.height = 52; x.fillStyle = bg; x.fillRect(0, 0, 132, 52); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `bold ${fontPx || 28}px "Yu Gothic","Hiragino Sans",sans-serif`; x.fillText(text, 66, 28) }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4
    const m = new THREE.MeshBasicMaterial({ map: t, fog: true }); signCache[key] = m; return m
  }
  // 縦看板（江戸/戦国の木の掛看板）: 板＋縦書きの屋号。x,zの位置・ry向き・高さ・板色。
  const mkSignV = (px, py, pz, ry, text, board = 0xe6d8b8, ink = 0x3a2a1a) => {
    const g = new THREE.Group(); g.position.set(px, py, pz); g.rotation.y = ry
    const h = 0.5 * [...text].length + 0.5, panel = new THREE.Mesh(new THREE.PlaneGeometry(0.7, h), signMat(text, '#' + new THREE.Color(board).getHexString(), '#' + new THREE.Color(ink).getHexString(), true)); panel.position.y = h / 2; g.add(panel)
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, h + 0.1, 0.08), toon(board)); back.position.set(0, h / 2, -0.05); g.add(back)
    town.add(g); return g
  }
  // 横看板（大正/現代のホーロー/木の横看板）: 板＋横書きの店名。
  const mkSignH = (px, py, pz, ry, text, board = 0xdfe4e2, ink = 0x2a3a44) => {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.86), signMat(text, '#' + new THREE.Color(board).getHexString(), '#' + new THREE.Color(ink).getHexString(), false)); panel.position.set(px, py, pz); panel.rotation.y = ry
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.96, 0.08), toon(board)); back.position.set(px, py, pz); back.rotation.y = ry; back.position.x -= Math.sin(ry) * 0.05; back.position.z -= Math.cos(ry) * 0.05
    town.add(back); town.add(panel); return panel
  }
  // ── 生きもの（街/時代/季節で最適化・水彩のやさしい色）──
  const mkButterfly = (cx, cy, cz, col) => { const g = new THREE.Group(); g.position.set(cx, cy, cz); for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.22, 7), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, fog: true })); w.position.x = s * 0.1; w.userData.side = s; g.add(w) } town.add(g); critters.push({ g, cx, cy, cz, ph: R() * 6.28, type: 'fly', rad: 1.4 + R() * 2.2 }) }
  const mkDragonfly = (cx, cy, cz) => { const g = new THREE.Group(); g.position.set(cx, cy, cz); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 5), toon(0x4a6a5a)); body.rotation.z = Math.PI / 2; g.add(body); for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.16), new THREE.MeshBasicMaterial({ color: 0xcfe0e6, transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: true })); w.position.set(0, 0.05, s * 0.18); g.add(w) } town.add(g); critters.push({ g, cx, cy, cz, ph: R() * 6.28, type: 'dart', rad: 2 + R() * 3 }) }
  // 四つ足の動物（犬/猫/馬）。body＋4脚＋頭。水彩トーンで佇む。
  const mkQuad = (x, y, z, ry, col, sc) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27 * sc, 0.7 * sc, 3, 6), toon(col)); body.rotation.z = Math.PI / 2; body.position.y = 0.7 * sc; body.castShadow = true; g.add(body)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25 * sc, 7, 6), toon(col)); head.position.set(0.58 * sc, 0.96 * sc, 0); g.add(head)
    for (const [lx, lz] of [[0.4, 0.2], [0.4, -0.2], [-0.4, 0.2], [-0.4, -0.2]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * sc, 0.07 * sc, 0.7 * sc, 5), toon(col)); leg.position.set(lx * sc, 0.35 * sc, lz * sc); g.add(leg) }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * sc, 0.02 * sc, 0.5 * sc, 5), toon(col)); tail.position.set(-0.55 * sc, 0.8 * sc, 0); tail.rotation.z = 0.7; g.add(tail)
    town.add(g); return g }

  // ── 起伏する地面（谷へ下る坂の街の地面） ──
  {
    const g = new THREE.PlaneGeometry(470, 540, 124, 142) // 旗艦homeの広い地面（分割は性能優先で抑える＝三角形を減らす。谷/川は十分滑らか）
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
      wm.emissiveMap = e; wm.emissive = new THREE.Color(isNight ? 0xffbe82 : 0xffcaa0); wm.emissiveIntensity = 0.3 + duskAmt * (isNight ? 0.95 : 0.62) // 夜は窓灯りを強めて瞬かせる（夕は控えめで貼り絵感を防ぐ）
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
  for (let zi = -21; zi <= 7; zi++) {
    for (let xi = -22; xi <= 9; xi++) {
      if (Math.abs(xi) < 1.6 && zi > -3 && zi <= 4) continue // 手前中央は道（街を見通す抜け）
      if (zi > 4 && heightAt(xi * 9, zi * 9) > 30) continue // 手前の丘の天端より上(急斜面)は空ける＝住宅街は丘の中腹まで
      if (R() < 0.12) continue // 空地・駐車場・庭で時々抜く（碁盤の規則性を崩す）
      if (zi < -13 && R() < 0.42) continue // 奥の列は疎に（遠景の点描・性能の余裕を残す）
      if ((zi < -16 || xi < -16) && R() < 0.5) continue // 拡張した最外周(奥/西の端)はさらに疎に＝旗艦の広がりを出しつつ性能を守る
      const x = xi * 9 + (R() - 0.5) * 5.4 // 格子からの揺らぎを大きく（隣と不揃いに寄る＝密集の自然さ）
      const z = zi * 9 + (R() - 0.5) * 5.4
      if (Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.r) continue // 神社の境内は空ける
      if (Math.abs(x - RIVER.x) < RIVER.bankW + 2) continue // 川筋は空ける
      if (Math.hypot(x - STATION.x, z - STATION.z) < STATION.r) continue // 駅前は空ける
      if (Math.hypot(x - PARK.x, z - PARK.z) < PARK.r) continue // 公園の広場は空ける
      if (Math.hypot(x - TOWER.x, z - TOWER.z) < TOWER.r) continue // 展望塔の足元は空ける
      if (Math.hypot(x - TEMPLE.x, z - TEMPLE.z) < TEMPLE.r) continue // 寺の境内は空ける
      if (Math.hypot(x - SCHOOL.x, z - SCHOOL.z) < SCHOOL.r) continue // 学校の敷地は空ける
      if (Math.hypot(x - FUN.x, z - FUN.z) < FUN.r) continue // 遊園地は空ける
      if (Math.hypot(x - DOWNTOWN.x, z - DOWNTOWN.z) < DOWNTOWN.r) continue // 副都心（高層ビル街）は専用に建てる
      if (Math.hypot(x - STADIUM.x, z - STADIUM.z) < STADIUM.r) continue // 競技場は専用に建てる
      if (x > SEA.coast && heightAt(x, z) < SEA.level + 1.2) continue // 海・汀のセルは建てない（水没を防ぐ）
      if (Math.hypot(x - HARBOR.x, z - HARBOR.z) < HARBOR.r) continue // 臨海の港（工業地帯）は専用に建てる
      if (Math.abs(z - RAIL.z) < 2.7 && x > RAIL.x0 - 1 && x < RAIL.x1 + 1) continue // 線路の通り道は空ける
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

  // ── 副都心（拡張した西の高層ビル街）＝旗艦homeのスカイライン。house()のガラス窓の高層を中心ほど高く密集させる。 ──
  {
    const dcx = DOWNTOWN.x, dcz = DOWNTOWN.z
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 6.2832 + R() * 0.5, rr = (i % 4) * 5.4 + R() * 3.4 // 中心から渦巻状に密集
      const px = dcx + Math.cos(a) * rr, pz = dcz + Math.sin(a) * rr, py = heightAt(px, pz)
      if (py < SEA.level + 1) continue
      const central = Math.max(0, 1 - rr / 22) // 中心ほど高い
      const h = 13 + central * 23 + R() * 7, w = 4.6 + R() * 3.2, d = 4.6 + R() * 3.2 // 最大~43mの摩天楼
      house(px, pz, w, d, h, R() < 0.5 ? 'apt' : 'mid')
    }
    // 駅前広場/大通りの石畳（副都心の足元を均す）と街路樹
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(DOWNTOWN.r - 4, 28), mottleMat(season === 'winter' ? 0xc6cac6 : 0x8e8a84, 110, 0.1, [5, 5])); plaza.rotation.x = -Math.PI / 2; plaza.position.set(dcx, heightAt(dcx, dcz) + 0.05, dcz); plaza.receiveShadow = true; town.add(plaza)
    const dgC = season === 'spring' ? 0x7faa56 : season === 'autumn' ? 0xc88a3c : season === 'winter' ? 0xcdd6d2 : 0x5e7e46
    for (let k = 0; k < 12; k++) { const a = R() * 6.28, rr = 14 + R() * 12, px = dcx + Math.cos(a) * rr, pz = dcz + Math.sin(a) * rr, py = heightAt(px, pz); if (py < SEA.level + 1) continue; const s = 0.8 + R() * 0.4; const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.22 * s, 1.6 * s, 6), toon(0x6a4f38)); tr.position.set(px, py + 0.8 * s, pz); town.add(tr); const fo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 * s, 0), toon(dgC)); fo.position.set(px, py + 2.0 * s, pz); fo.castShadow = true; town.add(fo) } // 街路樹
  }
  // ── 競技場（楕円のスタジアム）＝旗艦homeの大型施設。擂鉢のスタンド＋緑のフィールド＋トラック＋白い庇＋照明塔×4 ──
  {
    const scx = STADIUM.x, scz = STADIUM.z, scy = STADIUM.padY, ex2 = 18, ez2 = 14
    // 明るい緑のフィールド（大きく＝上空から「競技場の芝」とすぐ読める）＋赤のトラック＋白線
    const field = new THREE.Mesh(new THREE.CircleGeometry(1, 44), toon(season === 'winter' ? 0xd6dcd2 : 0x4f8f3e)); field.scale.set(ex2 * 0.6, ez2 * 0.6, 1); field.rotation.x = -Math.PI / 2; field.position.set(scx, scy + 0.32, scz); field.receiveShadow = true; town.add(field)
    const track = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.74, 44), toon(season === 'winter' ? 0xc8b0a4 : 0xb0563a)); track.scale.set(ex2, ez2, 1); track.rotation.x = -Math.PI / 2; track.position.set(scx, scy + 0.3, scz); town.add(track)
    // スタンド＝低く開いた擂鉢（短くして上空からフィールドが見える）。客席色を明るく＋段のリングをはっきり。
    const seatC = season === 'winter' ? 0xcfd4d8 : 0xaeb6c2
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.76, 2.6, 48, 1, true), toon(seatC)); bowl.scale.set(ex2, 1, ez2); bowl.position.set(scx, scy + 1.3, scz); bowl.castShadow = true; bowl.receiveShadow = true; town.add(bowl); town.add(addOutline(bowl)) // 内に傾く客席の面
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.04, 1.04, 2.9, 48, 1, true), toon(season === 'winter' ? 0xc2c6c8 : 0x9aa0a6)); wall.scale.set(ex2, 1, ez2); wall.position.set(scx, scy + 1.45, scz); wall.castShadow = true; town.add(wall); town.add(addOutline(wall)) // 外周の壁（垂直の外観）
    for (let ti = 0; ti < 4; ti++) { const r = 0.8 + ti * 0.05; const tier = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 4, 48), toon(season === 'winter' ? 0x9aa0a4 : 0x7c828c)); tier.scale.set(ex2 * r, ez2 * r, 1); tier.rotation.x = -Math.PI / 2; tier.position.set(scx, scy + 0.8 + ti * 0.5, scz); town.add(tier) } // 客席の段（はっきり）
    const canopy = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 4, 48), toon(0xeae6dc)); canopy.scale.set(ex2 * 0.98, ez2 * 0.98, 1); canopy.rotation.x = -Math.PI / 2; canopy.position.set(scx, scy + 2.9, scz); town.add(canopy); town.add(addOutline(canopy)) // 白い屋根の庇（張り出し）
    for (const [ox, oz] of [[ex2 * 0.82, ez2 * 0.82], [-ex2 * 0.82, ez2 * 0.82], [ex2 * 0.82, -ez2 * 0.82], [-ex2 * 0.82, -ez2 * 0.82]]) { const lx = scx + ox, lz = scz + oz, ly = heightAt(lx, lz)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 9, 6), toon(0x8a8e90)); pole.position.set(lx, ly + 4.5, lz); pole.castShadow = true; town.add(pole)
      const rack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 0.4), toon(0x6a6e72)); rack.position.set(lx + (scx - lx) * 0.08, ly + 9.2, lz + (scz - lz) * 0.08); town.add(rack)
      if (isNight || duskAmt > 0.3) { const gl = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 0.12), new THREE.MeshBasicMaterial({ color: 0xfff4d0, fog: true })); gl.position.set(lx + (scx - lx) * 0.12, ly + 9.2, lz + (scz - lz) * 0.12); town.add(gl) } } // 照明塔×4（夜は灯る）
  }
  // ── 湾のヨット（旗艦homeの海辺の憩い）。沖に係留のヨット＋防波堤＋海辺の遊歩道。狭い湾でも破綻しないよう桟橋は置かず水面に浮かべる。 ──
  {
    const mhx = 80, mhz = -14, deckMat = toon(0x8a6a48) // 湾の沖（水面の上）
    const bw = new THREE.Mesh(new THREE.BoxGeometry(16, 1.6, 2.6), mottleMat(season === 'winter' ? 0xc6cac4 : 0x9a948a, 120, 0.12, [4, 1])); bw.position.set(mhx + 8, SEA.level + 0.7, mhz - 11); bw.castShadow = true; town.add(bw); town.add(addOutline(bw)) // 防波堤
    const hullMat = toon(season === 'winter' ? 0xe2dccf : 0xdcd6c8), mastMat = toon(0x8a8278), sailMat = toon(0xeae4d6)
    for (let i = 0; i < 6; i++) { const yz = mhz - 7 + i * 2.8 + (R() - 0.5), yx = mhx + 3 + (R() - 0.5) * 3.2
      const yacht = new THREE.Group(); yacht.position.set(yx, SEA.level + 0.2, yz); yacht.rotation.y = Math.PI / 2 + (R() - 0.5) * 0.3; yacht.userData = { ph: R() * 6.28 }
      const hull = new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.7, 1.1, 1, 0.3), hullMat); hull.position.y = 0.4; hull.castShadow = true; yacht.add(hull)
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 5), mastMat); mast.position.set(0, 2.0, 0); yacht.add(mast)
      const sail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.5, 1.5), sailMat); sail.position.set(0, 1.85, 0.55); yacht.add(sail)
      town.add(yacht); boats.push(yacht) } // 係留のヨット（白い船体＋マスト＋帆）＝波にゆれる
    // 海辺の遊歩道（岸の上）＝ベンチ＋街路樹＋人
    const promY = (px, pz) => heightAt(px, pz)
    for (let i = 0; i < 5; i++) { const pz = mhz - 10 + i * 5.5, px = 69, py = promY(px, pz); if (py < SEA.level + 0.5) continue
      const bench = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.6), deckMat); bench.position.set(px, py + 0.3, pz); bench.rotation.y = Math.PI / 2; town.add(bench)
      if (i % 2 === 0) { const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.8, 6), toon(0x6a4f38)); tr.position.set(px - 2, py + 0.9, pz); town.add(tr); const fo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), toon(season === 'autumn' ? 0xc88a3c : season === 'winter' ? 0xd2dad6 : 0x5e8a52)); fo.position.set(px - 2, py + 2.3, pz); fo.castShadow = true; town.add(fo) } }
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
    const lanBodies = [], lanCaps = [] // 提灯の胴/笠を1メッシュずつへ統合（ドローコール削減）
    for (const lx of [-2.9, 2.9]) for (let z = -15; z > -40; z -= 3.0) {
      const ly = heightAt(lx, z) + 3.8
      const bg = new THREE.CylinderGeometry(0.32, 0.32, 0.5, 10); bg.scale(1, 1.15, 1); bg.translate(lx, ly, z); lanBodies.push(bg)
      const cg = new THREE.CylinderGeometry(0.15, 0.21, 0.1, 8); cg.translate(lx, ly + 0.33, z); lanCaps.push(cg)
    }
    if (BufferGeometryUtils.mergeGeometries) {
      const bm = BufferGeometryUtils.mergeGeometries(lanBodies, false); if (bm) town.add(new THREE.Mesh(bm, lantMat)); lanBodies.forEach((g) => g.dispose())
      const cm = BufferGeometryUtils.mergeGeometries(lanCaps, false); if (cm) town.add(new THREE.Mesh(cm, capMat)); lanCaps.forEach((g) => g.dispose())
    }
    // 店先（通りの両側に小さな店＝庇のテント・暖簾・看板・夕夜は灯る店窓）。通りを「商店街」に。
    const shopCols = [0xd8c8a8, 0xcfa886, 0xc8bfa8, 0xd0b090, 0xc6c0b0], awnCols = [0xc0453a, 0x3a7a5e, 0x3a6a8a, 0xc89030]
    const shopLit = duskAmt > 0.2, norenWords = ['しょくどう', 'やおや', 'さかなや', 'とこや', 'パンや', 'せん']
    for (const side of [-1, 1]) {
      for (let z = -14.5; z > -39; z -= 4.2) {
        const fx = side * 3.8, fd = -side, gy = heightAt(fx, z) // fd=道側(+x for left)
        const g = new THREE.Group(); g.position.set(fx, gy, z); town.add(g)
        const h = 3.0 + R() * 1.3
        const store = new THREE.Mesh(new THREE.BoxGeometry(1.7, h, 3.4), toon(shopCols[(R() * shopCols.length) | 0])); store.position.set(-fd * 0.45, h / 2, 0); store.castShadow = true; store.receiveShadow = true; g.add(store)
        const awn = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 3.2), toon(awnCols[(R() * awnCols.length) | 0])); awn.position.set(fd * 0.95, 2.15, 0); awn.rotation.z = fd * 0.2; awn.castShadow = true; g.add(awn)
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 2.6), shopLit ? new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: true }) : toon(0x40484e)); win.position.set(fd * 0.48, 1.0, 0); g.add(win)
        const nc = document.createElement('canvas'); nc.width = 64; nc.height = 24; const ncx = nc.getContext('2d'); ncx.fillStyle = '#' + new THREE.Color(awnCols[(R() * awnCols.length) | 0]).getHexString(); ncx.fillRect(0, 0, 64, 24); ncx.fillStyle = '#f0ece0'; ncx.font = 'bold 15px sans-serif'; ncx.textAlign = 'center'; ncx.textBaseline = 'middle'; ncx.fillText(norenWords[(R() * norenWords.length) | 0], 32, 12)
        const noren = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 2.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(nc) })); noren.position.set(fd * 0.52, 1.85, 0); g.add(noren)
        colliders.push({ x: fx, z, r: 1.5 })
      }
    }
    // 街路灯（中央の街道沿いに左右互い違いに並ぶ。夕夜に暖色で灯る＝夜景の足元の灯り）。
    {
      const litHead = duskAmt > 0.2
      const headMat = litHead ? new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: true }) : toon(0xb8b4a0)
      const haloMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.22, depthWrite: false, fog: true })
      const poleMat = toon(0x44464a)
      for (const side of [-1, 1]) {
        for (let z = 16 + (side > 0 ? 4.5 : 0); z > -52; z -= (LIGHT ? 18 : 9)) {
          const gx = side * 4.7, gz = z, gy = heightAt(gx, gz)
          const g = new THREE.Group(); g.position.set(gx, gy, gz); town.add(g)
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 4.2, 6), poleMat); pole.position.y = 2.1; pole.castShadow = true; g.add(pole)
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.1), poleMat); arm.position.set(-side * 0.35, 4.1, 0); g.add(arm)
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), headMat); head.position.set(-side * 0.65, 4.0, 0); g.add(head)
          if (litHead && !LIGHT) { const halo = new THREE.Mesh(new THREE.SphereGeometry(0.46, 8, 8), haloMat); halo.position.copy(head.position); g.add(halo) }
        }
      }
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

  // ── 線路と走る電車（駅のホーム外側を通り、街を横切る一直線）。 ──
  {
    const railTopY = (x) => heightAt(x, RAIL.z) + 0.18
    const ballGeos = [], sleepGeos = [], railGeos = []
    for (let x = RAIL.x0; x <= RAIL.x1; x += 0.95) { const gy = heightAt(x, RAIL.z); const sl = new THREE.BoxGeometry(2.7, 0.12, 0.42); sl.applyMatrix4(new THREE.Matrix4().makeTranslation(x, gy + 0.12, RAIL.z)); sleepGeos.push(sl); const bl = new THREE.BoxGeometry(0.95, 0.18, 3.4); bl.applyMatrix4(new THREE.Matrix4().makeTranslation(x, gy + 0.04, RAIL.z)); ballGeos.push(bl) } // 砂利の路盤＋枕木
    for (const rr of [-0.78, 0.78]) for (let x = RAIL.x0; x < RAIL.x1; x += 2.6) { const ra = new THREE.BoxGeometry(2.7, 0.1, 0.12); ra.applyMatrix4(new THREE.Matrix4().makeTranslation(x + 1.3, heightAt(x + 1.3, RAIL.z) + 0.2, RAIL.z + rr)); railGeos.push(ra) }
    if (BufferGeometryUtils.mergeGeometries) {
      const bm = BufferGeometryUtils.mergeGeometries(ballGeos, false); if (bm) { const ball = new THREE.Mesh(bm, toon(0x7c766c)); ball.receiveShadow = true; town.add(ball) }
      const sm = BufferGeometryUtils.mergeGeometries(sleepGeos, false); if (sm) town.add(new THREE.Mesh(sm, toon(0x5e554a)))
      const rm = BufferGeometryUtils.mergeGeometries(railGeos, false); if (rm) { const rmesh = new THREE.Mesh(rm, toon(0x55555c)); town.add(rmesh) }
    }
    ballGeos.concat(sleepGeos, railGeos).forEach((g) => g.dispose())
    // 電車（3両編成。車体・窓帯・床下・台車。夜は窓が灯る）。色違いを2本、半周ずらして走らせる。
    const NCAR = 3, carLen = 5.4, gap = 0.7
    const glassMat = duskAmt > 0.2 ? new THREE.MeshBasicMaterial({ color: 0xffe6b0, fog: true }) : toon(0x36404a)
    const makeTrain = (bodyCol, beltCol) => {
      const tr = new THREE.Group(); town.add(tr)
      for (let i = 0; i < NCAR; i++) {
        const car = new THREE.Group(); car.position.x = i * (carLen + gap); car.userData = { ox: i * (carLen + gap) }; tr.add(car)
        const body = new THREE.Mesh(new RoundedBoxGeometry(carLen, 2.3, 1.95, 2, 0.32), toon(bodyCol)); body.position.y = 1.55; body.castShadow = true; car.add(body)
        const belt = new THREE.Mesh(new THREE.BoxGeometry(carLen + 0.02, 0.2, 1.97), toon(beltCol)); belt.position.y = 2.05; car.add(belt)
        const win = new THREE.Mesh(new THREE.BoxGeometry(carLen * 0.82, 0.72, 1.99), glassMat); win.position.y = 1.95; car.add(win)
        const skirt = new THREE.Mesh(new THREE.BoxGeometry(carLen, 0.6, 1.8), toon(0x4a4640)); skirt.position.y = 0.55; car.add(skirt)
        for (const bx of [-carLen * 0.3, carLen * 0.3]) { const bogie = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.7), toon(0x2a2a2e)); bogie.position.set(bx, 0.32, 0); car.add(bogie) }
      }
      return tr
    }
    const trainLen = NCAR * (carLen + gap)
    train = makeTrain(0xd98a3c, 0xeae2d2); train.userData = { x: RAIL.x0, speed: 9, len: trainLen, stops: true } // 朱橙＝各駅停車（駅で停まる）
    train2 = makeTrain(0x4a7ab0, 0xe0e6ea); train2.userData = { x: RAIL.x0 + (RAIL.x1 - RAIL.x0 + 8) * 0.5, speed: 11, len: trainLen, stops: false } // 青＝通過（速い）
    // 郊外の小さな停留所（無人駅。低いホーム＋上屋＋駅名標＋ベンチ）。線路の東寄り。
    {
      const sxx = 52, szz = RAIL.z + 1.5, syy = heightAt(sxx, szz)
      const g = new THREE.Group(); g.position.set(sxx, syy, szz); town.add(g)
      const plat = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 2.4), toon(0xb8b2a6)); plat.position.y = 0.25; plat.receiveShadow = true; g.add(plat)
      for (const px of [-3.6, 3.6]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.3, 6), toon(0x8a8680)); post.position.set(px, 1.4, 0.6); g.add(post) }
      const proof = new THREE.Mesh(new THREE.BoxGeometry(9, 0.14, 2.0), toon(0x9a9690)); proof.position.set(0, 2.5, 0.5); proof.castShadow = true; g.add(proof)
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.4), toon(0x8a6a48)); bench.position.set(0, 0.7, 0.7); g.add(bench)
      const nc = document.createElement('canvas'); nc.width = 128; nc.height = 40; const ncx = nc.getContext('2d'); ncx.fillStyle = '#f4efe4'; ncx.fillRect(0, 0, 128, 40); ncx.fillStyle = '#3a6a4a'; ncx.fillRect(0, 31, 128, 9); ncx.fillStyle = '#2a3a4a'; ncx.font = 'bold 22px sans-serif'; ncx.textAlign = 'center'; ncx.textBaseline = 'middle'; ncx.fillText('にしの', 64, 17)
      const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.08), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(nc) })); sign.position.set(-2.6, 1.5, -0.3); g.add(sign)
      for (const sp of [-3.6, -1.6]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), toon(0x8a8680)); post.position.set(sp, 0.85, -0.3); g.add(post) }
    }

    // ── 踏切（道が線路と交わる所。電車が近づくと遮断機が下り、警報灯が点滅する）。──
    const crossX = 6
    crossing = { gates: [], lamps: [], cx: crossX }
    // 紅白の遮断桿テクスチャ
    const sc = document.createElement('canvas'); sc.width = 64; sc.height = 8; const scx = sc.getContext('2d')
    for (let i = 0; i < 8; i++) { scx.fillStyle = i % 2 ? '#c0392b' : '#f0ece0'; scx.fillRect(i * 8, 0, 8, 8) }
    const barTex = new THREE.CanvasTexture(sc); barTex.wrapS = THREE.RepeatWrapping; barTex.repeat.set(4, 1)
    const barMat = new THREE.MeshToonMaterial({ map: barTex, gradientMap: grad })
    // 道の舗装（踏切を渡る短い道。z方向に通す）
    const roadGeos = []
    for (let z = RAIL.z - 6; z <= RAIL.z + 6; z += 1.2) { const seg = new THREE.BoxGeometry(4.6, 0.1, 1.3); seg.applyMatrix4(new THREE.Matrix4().makeTranslation(crossX, heightAt(crossX, z) + 0.07, z)); roadGeos.push(seg) }
    if (BufferGeometryUtils.mergeGeometries) { const rmesh = BufferGeometryUtils.mergeGeometries(roadGeos, false); if (rmesh) { const road = new THREE.Mesh(rmesh, toon(0x6e6a64)); road.receiveShadow = true; town.add(road) } }
    roadGeos.forEach((g) => g.dispose())
    // 警報機×2（対角の隅）＋遮断桿
    for (const gp of [[crossX - 2.6, RAIL.z - 3, 1], [crossX + 2.6, RAIL.z + 3, -1]]) {
      const px = gp[0], pz = gp[1], barDir = gp[2]
      const g = new THREE.Group(); g.position.set(px, heightAt(px, pz), pz); town.add(g)
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.3, 6), toon(0x2a2a2e)); post.position.y = 1.65; post.castShadow = true; g.add(post)
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.34, 0.18), toon(0x2a2a2e)); head.position.y = 3.05; head.rotation.y = barDir > 0 ? -0.5 : 0.5 + Math.PI; g.add(head) // 警報灯の箱（道へ向ける）
      const lampLocal = []
      for (const lx of [-0.22, 0.22]) { const lm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), new THREE.MeshBasicMaterial({ color: 0x4a1410, fog: true })); lm.position.set(lx, 0, 0.12); head.add(lm); lampLocal.push(lm) }
      const xsign = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 4, 4), toon(0xf0d030)); xsign.position.set(0, 3.05, -0.12); xsign.rotation.z = Math.PI / 4; g.add(xsign) // 警標（黄の×印を菱形で近似）
      const pivot = new THREE.Group(); pivot.position.set(0, 2.5, 0.16); pivot.rotation.z = barDir * 1.45; g.add(pivot) // 起立時=上向き
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 0.16), barMat); bar.position.x = barDir * 1.8; pivot.add(bar)
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.2), toon(0xf0ece0)); tip.position.x = barDir * 3.5; pivot.add(tip)
      pivot.userData = { barDir }
      crossing.gates.push(pivot); crossing.lamps.push(lampLocal)
    }
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
  // ── 商店街（小さな店が並ぶ一角＋色とりどりの庇＋店名の看板） ──
  const shopNames = ['八百屋', '魚屋', '酒店', '喫茶', '薬局', '花屋', '本屋'], shopBg = [0x4a8a5a, 0x3a6a9a, 0xb24a3a, 0x6a4a3a, 0x3a8a7a, 0xc04a7a, 0x6a5a3a]
  for (let i = 0; i < 7; i++) {
    const x = -34 + i * 5.2, z = -10, gy = heightAt(x, z)
    const b = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.6, 4.4), toon(wallCols[i % wallCols.length]))
    b.position.set(x, gy + 1.8, z); b.castShadow = true; b.receiveShadow = true; town.add(b)
    const aw = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.35, 1.5), toon([0xc23a2c, 0x3a6a9a, 0x3e8a4a, 0xd8a030][i % 4]))
    aw.position.set(x, gy + 2.5, z + 2.4); town.add(aw)
    mkSignH(x, gy + 3.4, z + 2.3, 0, shopNames[i], shopBg[i % shopBg.length], 0xf4efe2) // 店名の看板
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
  const hMat = mottleMat(hedgeCol, 72, 0.26, [3, 1]) // 葉の塊の濃淡ムラ＝刈り込んだ生垣の葉表（近景でベタ緑の板を脱す。描画数は不変・材1枚）
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
          : [[0x46673a, 0x547a40, 0x648a48, 0x748f4c, 0x52784a, 0x5e8444], [0x689050, 0x7ea05c, 0x92b066, 0xa2b66e, 0x86a868, 0x90ac5c]] // 夏の樹冠に色幅（深緑〜若葉〜黄緑〜青緑）＝同色の綿玉畑を脱す
  const leafBaseMats = leafBase.map((c) => { const m = toon(c); m.vertexColors = true; return m }) // 樹冠に頂点色の上下グラデ（陰陽）を効かせる
  const leafHiMats = leafHi.map(toon)
  const treesArr = []
  const trunkGeos = [] // 全ての幹を1メッシュへ統合（静止＝ドローコール大幅削減）
  function tree(x, z, scale) {
    const gy = heightAt(x, z)
    const g = new THREE.Group()
    const r = 1.6 + R() * 1.4
    const ci = (R() * leafBaseMats.length) | 0
    const det = scale > 1.4 ? 2 : 1 // 近景の大木だけ細分を上げて輪郭を丸く（奥は1=軽量）
    // 樹形のばらつき＝同形のロリポップ畑を脱す。縦長(杉檜風)/横広(落葉樹の傘)/標準を振る。
    const form = R()
    const tall = form > 0.68, broad = form < 0.28
    const trunkH = tall ? 3.0 : broad ? 1.7 : 2.3
    const ax = broad ? 1.32 : tall ? 0.72 : 1.06           // 樹冠の横倍率
    const ay = tall ? 1.5 : broad ? 0.74 : 0.9 + R() * 0.16 // 樹冠の縦倍率
    const tilt = (R() - 0.5) * 0.12 // わずかな基準傾き
    // 幹: 木ごとの world 変換を焼き込んで trunkGeos へ（後でまとめて1メッシュ・静止）。
    const tg = new THREE.CylinderGeometry(0.2, 0.36, trunkH, det > 1 ? 9 : 6)
    tg.applyMatrix4(new THREE.Matrix4().makeTranslation(0, trunkH / 2, 0))
    tg.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, gy, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, tilt)), new THREE.Vector3(scale, scale, scale)))
    trunkGeos.push(tg)
    // 葉: 主房＋房をローカルで作り1つへ統合（木ごとに1メッシュ。陰色で統一＝トゥーンの陰影で立体感）。
    const leafGeos = []
    const main = new THREE.IcosahedronGeometry(r, det)
    main.applyMatrix4(new THREE.Matrix4().makeScale(ax, ay, ax)); main.applyMatrix4(new THREE.Matrix4().makeTranslation(0, trunkH + r * ay * 0.5, 0))
    leafGeos.push(main)
    const nC = scale > 1.4 ? 3 + ((R() * 2) | 0) : 1 + (R() < 0.5 ? 1 : 0) // 房数は元に戻す（性能優先）。輪郭の不揃いは色幅と樹形(tall/broad)で出す
    for (let k = 0; k < nC; k++) {
      const cr = r * (0.44 + R() * 0.42), s = 0.85 + R() * 0.3
      const cg = new THREE.IcosahedronGeometry(cr, det)
      cg.applyMatrix4(new THREE.Matrix4().makeScale(s, s, s))
      cg.applyMatrix4(new THREE.Matrix4().makeTranslation((R() - 0.5) * r * ax * 1.5, trunkH + r * ay * (0.42 + (k + 1) / (nC + 1) * 0.95), (R() - 0.4) * r * ax * 1.1))
      leafGeos.push(cg)
    }
    const merged = BufferGeometryUtils.mergeGeometries ? BufferGeometryUtils.mergeGeometries(leafGeos, false) : leafGeos[0]
    leafGeos.forEach((lg) => { if (lg !== merged) lg.dispose() })
    // 樹冠の上下に陰影（下=陰り0.8 / 上=陽の当たり1.22）を頂点色で焼く＝統合で失った陰陽の立体感を無コストで回復。
    { const mp = merged.attributes.position, cols = new Float32Array(mp.count * 3); let minY = Infinity, maxY = -Infinity
      for (let i = 0; i < mp.count; i++) { const y = mp.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y }
      const span = Math.max(0.001, maxY - minY)
      for (let i = 0; i < mp.count; i++) { const v = 0.8 + (mp.getY(i) - minY) / span * 0.42; cols[i * 3] = v; cols[i * 3 + 1] = v; cols[i * 3 + 2] = v }
      merged.setAttribute('color', new THREE.BufferAttribute(cols, 3)) }
    const leafMesh = new THREE.Mesh(merged, leafBaseMats[ci]); leafMesh.castShadow = true; g.add(leafMesh)
    g.position.set(x, gy, z); g.scale.setScalar(scale); g.rotation.z = tilt; town.add(g)
    g.userData = { ph: R() * 6.28, amp: 0.02 + R() * 0.02, tilt }
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
    for (let i = 0; i < (LIGHT ? 150 : 232); i++) { // 非力端末は散在木を間引く。拡張した旗艦home全域に緑を行き渡らせる
      const x = -200 + R() * 335, z = -189 + R() * 223 // 拡張した西/北まで覆う
      if (Math.abs(x) < 4.5 && z > -2) continue          // 手前中央の道は空ける
      if (Math.hypot(x - DOWNTOWN.x, z - DOWNTOWN.z) < DOWNTOWN.r - 5) continue // 副都心は街路樹で別途
      if (Math.hypot(x - STADIUM.x, z - STADIUM.z) < STADIUM.r) continue // 競技場は空ける
      if (Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.r) continue // 神社の境内は専用の木立で囲む
      if (Math.abs(x - RIVER.x) < RIVER.bankW + 1) continue // 川筋は空ける（水際の木は別途）
      if (Math.hypot(x - STATION.x, z - STATION.z) < STATION.r - 2) continue // 駅前は空ける
      if (Math.hypot(x - PARK.x, z - PARK.z) < PARK.r - 1) continue // 公園は専用の木立で囲む
      if (Math.hypot(x - TOWER.x, z - TOWER.z) < TOWER.r) continue // 展望塔の足元は空ける
      if (Math.hypot(x - TEMPLE.x, z - TEMPLE.z) < TEMPLE.r - 2) continue // 寺は専用の木立で囲む
      if (Math.hypot(x - SCHOOL.x, z - SCHOOL.z) < SCHOOL.r - 1) continue // 学校は校庭を空ける
      if (Math.hypot(x - FUN.x, z - FUN.z) < FUN.r - 1) continue // 遊園地は空ける
      if (x > SEA.coast && heightAt(x, z) < SEA.level + 1.5) continue // 海・汀には木を生やさない
      if (Math.hypot(x - HARBOR.x, z - HARBOR.z) < HARBOR.r) continue // 工業地帯には木を生やさない
      if (Math.abs(z - RAIL.z) < 2.7 && x > RAIL.x0 - 1 && x < RAIL.x1 + 1) continue // 線路の通り道は空ける
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
      // 水面（空を映す水鏡。MeshToonの空グラデで白飛びを防ぐ）。冬は氷の張った淡い面に。
      const iced = season === 'winter'
      const pc = document.createElement('canvas'); pc.width = pc.height = 64; const pcx = pc.getContext('2d')
      const pg = pcx.createLinearGradient(0, 0, 0, 64)
      pg.addColorStop(0, iced ? '#dce8ee' : '#' + new THREE.Color(0x7aa6c4).lerp(skyTop, 0.4).getHexString())
      pg.addColorStop(1, iced ? '#c4d6de' : '#' + new THREE.Color(0x4f748e).lerp(skyHorizon, 0.22).getHexString())
      pcx.fillStyle = pg; pcx.fillRect(0, 0, 64, 64)
      if (iced) { for (let i = 0; i < 7; i++) { pcx.strokeStyle = `rgba(255,255,255,${0.3 + R() * 0.3})`; pcx.lineWidth = 0.6; pcx.beginPath(); pcx.moveTo(R() * 64, R() * 64); pcx.lineTo(R() * 64, R() * 64); pcx.lineTo(R() * 64, R() * 64); pcx.stroke() } } // 氷のひび
      else for (let i = 0; i < 30; i++) { pcx.fillStyle = `rgba(255,255,255,${0.04 + R() * 0.05})`; pcx.fillRect(R() * 64, R() * 64, 1 + R() * 2, 1) } // さざ波
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
      // 桜（季節で姿が変わる）。春=淡紅の満開・夏=新緑・秋=紅葉・冬=雪をかぶった裸枝。
      const blossomHex = season === 'spring' ? 0xf0bcce : season === 'autumn' ? 0xd6743a : season === 'winter' ? 0xe4eaf0 : 0x6f9a52
      for (const c of [[px0 - 6.5, pz0 + 5.5], [px0 + 6, pz0 - 6], [px0 - 5, pz0 - 6.5], [px0 + 5.5, pz0 + 6]]) {
        const gy = heightAt(c[0], c[1]); const sg = new THREE.Group(); sg.position.set(c[0], gy, c[1]); town.add(sg)
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.4, 7), woodMat); tr.position.y = 1.2; tr.castShadow = true; sg.add(tr)
        const sakuraMat = toon(blossomHex)
        const blobs = season === 'winter' ? [[0, 2.7, 0, 0.7], [-0.8, 2.4, 0.4, 0.5], [0.7, 2.5, -0.4, 0.52], [0.2, 3.2, 0.3, 0.46]] : [[0, 2.9, 0, 1.5], [-0.9, 2.5, 0.4, 1.0], [0.8, 2.6, -0.5, 1.05], [0.2, 3.4, 0.3, 0.9]]
        for (const bl of blobs) {
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
      // ── 夏祭り（公園の北の開けた所を会場に。やぐら＋放射状の提灯＋屋台＋盆踊りの輪）。──
      {
        const yx = px0, yz = pz0 - 9, ygy = heightAt(yx, yz) // 池の北
        const woodMat = toon(0x9a7048), redMat = toon(0xc0392b)
        // やぐら（二段の木の櫓＋紅白幕＋太鼓＋宝形屋根）
        const yag = new THREE.Group(); yag.position.set(yx, ygy, yz); town.add(yag)
        for (const lx of [-1.8, 1.8]) for (const lz of [-1.8, 1.8]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.6, 0.25), woodMat); leg.position.set(lx, 2.3, lz); leg.castShadow = true; yag.add(leg) }
        const deck = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 4.4), woodMat); deck.position.y = 3.3; deck.castShadow = true; yag.add(deck)
        // 紅白幕（上段の周り）
        const mc = document.createElement('canvas'); mc.width = 48; mc.height = 8; const mcx = mc.getContext('2d'); for (let i = 0; i < 6; i++) { mcx.fillStyle = i % 2 ? '#c0392b' : '#f0ece0'; mcx.fillRect(i * 8, 0, 8, 8) }
        const mtex = new THREE.CanvasTexture(mc); mtex.wrapS = THREE.RepeatWrapping; mtex.repeat.set(8, 1)
        const maku = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 0.8, 4, 1, true), new THREE.MeshToonMaterial({ map: mtex, gradientMap: grad, side: THREE.DoubleSide })); maku.rotation.y = Math.PI / 4; maku.position.y = 4.6; yag.add(maku)
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.0, 12), redMat); drum.rotation.z = Math.PI / 2; drum.position.y = 4.1; yag.add(drum) // 太鼓
        const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 1.6, 4), toon(0x55585e)); roof.rotation.y = Math.PI / 4; roof.position.y = 5.8; roof.castShadow = true; yag.add(roof)
        // 放射状の提灯（やぐら頂上→周囲のポールへ。黄/赤/青）
        const lantCols = [toon(0xe8a838), redMat, toon(0x3a8ac0)], NP = LIGHT ? 5 : 8, poleR = 9.5
        const poleGeos = [], lanGeos = [[], [], []] // ポール・提灯を色ごとに統合（ドローコール削減）
        for (let i = 0; i < NP; i++) {
          const a = i / NP * 6.283, ppx = yx + Math.cos(a) * poleR, ppz = yz + Math.sin(a) * poleR, pgy = heightAt(ppx, ppz)
          const pg2 = new THREE.CylinderGeometry(0.08, 0.1, 5, 6); pg2.translate(ppx, pgy + 2.5, ppz); poleGeos.push(pg2)
          for (let k = 1; k <= 4; k++) { const tt = k / 5; const lx2 = yx + (ppx - yx) * tt, lz2 = yz + (ppz - yz) * tt, ly2 = (ygy + 5.8) + ((pgy + 5) - (ygy + 5.8)) * tt - 0.2; const lg = new THREE.CylinderGeometry(0.18, 0.18, 0.34, 8); lg.scale(1, 1.2, 1); lg.translate(lx2, ly2, lz2); lanGeos[k % 3].push(lg) }
        }
        if (BufferGeometryUtils.mergeGeometries) {
          const pm = BufferGeometryUtils.mergeGeometries(poleGeos, false); if (pm) town.add(new THREE.Mesh(pm, woodMat)); poleGeos.forEach((g) => g.dispose())
          for (let c = 0; c < 3; c++) { if (lanGeos[c].length) { const lm = BufferGeometryUtils.mergeGeometries(lanGeos[c], false); if (lm) town.add(new THREE.Mesh(lm, lantCols[c])); lanGeos[c].forEach((g) => g.dispose()) } }
        }
        // 屋台×4（縁沿い。暖簾の品書き）
        const stallWords = ['たこやき', 'わたあめ', 'かきごおり', 'やきとり']
        const stallPos = [[yx - 9, yz + 4], [yx + 9, yz + 2], [yx - 4, yz + 11], [yx + 6, yz + 10]]
        for (let s = 0; s < 4; s++) {
          const sx = stallPos[s][0], sz = stallPos[s][1], sgy = heightAt(sx, sz), g = new THREE.Group(); g.position.set(sx, sgy, sz); town.add(g)
          const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 1.4), toon(0xcdb185)); counter.position.y = 0.55; counter.castShadow = true; g.add(counter)
          const awn = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.12, 1.7), toon([0xc0453a, 0x3a7a5e, 0x3a6a8a, 0xc89030][s])); awn.position.y = 2.1; awn.castShadow = true; g.add(awn)
          for (const bx of [-1.2, 1.2]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.1, 6), toon(0x8a6a48)); post.position.set(bx, 1.05, 0); g.add(post) }
          const sc = document.createElement('canvas'); sc.width = 64; sc.height = 24; const scx = sc.getContext('2d'); scx.fillStyle = '#f0ece0'; scx.fillRect(0, 0, 64, 24); scx.fillStyle = '#c0392b'; scx.font = 'bold 15px sans-serif'; scx.textAlign = 'center'; scx.textBaseline = 'middle'; scx.fillText(stallWords[s], 32, 12)
          const sign = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 0.06), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc) })); sign.position.set(0, 1.55, 0.75); g.add(sign)
          const stallLan = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.34, 8), duskAmt > 0.2 ? new THREE.MeshBasicMaterial({ color: 0xff9a4a, fog: true }) : redMat); stallLan.scale.y = 1.2; stallLan.position.set(-1.2, 1.8, 0.7); g.add(stallLan)
          if ((s === 0 || s === 3) && !LIGHT) { // 焼き物の屋台(たこやき/やきとり)は湯気が立ちのぼる
            for (let p = 0; p < 3; p++) { const puff = new THREE.Mesh(new THREE.SphereGeometry(0.32, 7, 6), new THREE.MeshBasicMaterial({ color: 0xf2f0ea, transparent: true, opacity: 0, depthWrite: false, fog: true })); puff.position.set(0.4, 1.4, 0.1); g.add(puff); steamPuffs.push({ mesh: puff, base: 1.4, ph: p * 0.8 + R() * 0.6 }) }
          }
          colliders.push({ x: sx, z: sz, r: 1.6 })
        }
        // 盆踊りの輪（やぐらを囲む人。中心を向き、片手を上げる）
        const skinMat = toon(0xf0c49c), yukataCols = [0x3a6a8a, 0xc0453a, 0x6a8a5a, 0xd0b090, 0x8a6aa0]
        for (let i = 0; i < (LIGHT ? 8 : 12); i++) {
          const a = i / 12 * 6.283, dx2 = yx + Math.cos(a) * 5.8, dz2 = yz + Math.sin(a) * 5.8, dgy = heightAt(dx2, dz2)
          const d = new THREE.Group(); d.position.set(dx2, dgy, dz2); d.rotation.y = Math.atan2(yx - dx2, yz - dz2); d.scale.setScalar(0.9 + R() * 0.2); town.add(d)
          const yuk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 1.2, 7), toon(yukataCols[i % yukataCols.length])); yuk.position.y = 0.6; yuk.castShadow = true; d.add(yuk) // 浴衣
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), skinMat); head.position.y = 1.4; d.add(head)
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), toon(yukataCols[i % yukataCols.length])); arm.position.set(0.22, 1.15, 0.1); arm.rotation.z = -0.9; d.add(arm) // 上げた手
        }
        colliders.push({ x: yx, z: yz, r: 2.6 }); spawnAvoid.push({ x: yx, z: yz, r: 7 })
      }
    }

    // ── 展望塔（谷を見はるかす街の塔）。高く昇って並ぶ目印・飛んで上がる目的地。──
    {
      const tx = TOWER.x, tz = TOWER.z, baseY = heightAt(tx, tz)
      const concrete = toon(0xcfcabf), deckMat = toon(0xbcb6aa), railMat = toon(0x877f72), roofMat = toon(0x586a6c), bandMat = toon(0xa9a395)
      const grp = new THREE.Group(); grp.position.set(tx, baseY, tz); town.add(grp)
      const shaftH = 24
      // 基壇（足元のコンクリ台）
      const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.4, 2.0, 14), concrete); base.position.y = 1.0; base.castShadow = true; base.receiveShadow = true; grp.add(base)
      // シャフト（先細りの塔身）
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.7, shaftH, 14), concrete); shaft.position.y = 2 + shaftH / 2; shaft.castShadow = true; shaft.receiveShadow = true; grp.add(shaft); grp.add(addOutline(shaft))
      // 横帯（塔身に細いリング＝スケール感と手描きの陰影の起伏）
      for (const fy of [0.34, 0.64]) { const ringR = 2.7 - (2.7 - 1.7) * fy; const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR + 0.06, 0.12, 6, 18), bandMat); ring.rotation.x = Math.PI / 2; ring.position.y = 2 + shaftH * fy; grp.add(ring) }
      const deckY = 2 + shaftH - 1.2
      // 展望台（張り出す円盤）
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 3.6, 0.6, 18), deckMat); deck.position.y = deckY; deck.castShadow = true; deck.receiveShadow = true; grp.add(deck)
      // 手すり（リングの上桟＋細い縦桟）
      const rail = new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.07, 6, 26), railMat); rail.rotation.x = Math.PI / 2; rail.position.y = deckY + 1.0; grp.add(rail)
      for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283; const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.0, 0.07), railMat); post.position.set(Math.cos(a) * 3.9, deckY + 0.5, Math.sin(a) * 3.9); grp.add(post) }
      // 展望室（ガラスの小部屋）と窓帯
      const cab = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.9, 3.0, 18), concrete); cab.position.y = deckY + 0.3 + 1.6; cab.castShadow = true; grp.add(cab)
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(2.73, 2.82, 1.7, 18), duskAmt > 0.2 ? new THREE.MeshBasicMaterial({ color: 0xffce86 }) : toon(0x444c52)); glass.position.y = deckY + 0.3 + 1.9; grp.add(glass) // 夕夜は灯る展望室
      // 屋根（円錐）＋天辺のアンテナ・赤い灯り
      const roofY = deckY + 0.3 + 3.1
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 2.4, 18), roofMat); roof.position.y = roofY + 1.2; roof.castShadow = true; grp.add(roof); grp.add(addOutline(roof))
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 3.2, 6), railMat); spire.position.y = roofY + 2.4 + 1.6; grp.add(spire)
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff5a4a })); beacon.position.y = roofY + 2.4 + 3.2; grp.add(beacon) // 航空障害灯（夜も街に灯る赤）
      colliders.push({ x: tx, z: tz, r: 4.4 }) // 歩行: 塔身には入らない
      spawnAvoid.push({ x: tx, z: tz, r: 5.5 }) // 着地: 塔の真下には降りない
    }

    // ── 寺（五重塔のある仏閣）。谷の右奥の中腹に。観覧車と対をなす高い目印・飛んでいく目的地。──
    {
      const tx = TEMPLE.x, tz = TEMPLE.z, baseY = heightAt(tx, tz)
      const wood = toon(0x8a5a3c), beam = toon(0xb5503f), roofMat = toon(0x4a4e52), stoneMat = toon(0x9a958c), gold = toon(0xc9a84a)
      const grp = new THREE.Group(); grp.position.set(tx, baseY, tz); town.add(grp) // 参道(+z)を街の中心へ向ける（回転なし）
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(12, 12.6, 0.9, 10), stoneMat); plat.position.y = 0.15; plat.receiveShadow = true; grp.add(plat) // 寺地の石の基壇
      // 五重塔（積み上がる五つの屋根＋相輪）。塔のかたわらに立てる。
      {
        const pag = new THREE.Group(); pag.position.set(-5.5, 0.5, -2); pag.scale.setScalar(1.12); grp.add(pag)
        let y = 0
        for (let i = 0; i < 5; i++) {
          const s = 1 - i * 0.12, bw = 3.4 * s, bh = 2.1
          const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw), wood); body.position.y = y + bh / 2; body.castShadow = true; pag.add(body)
          const band = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.05, 0.2, bw + 0.05), beam); band.position.y = y + bh - 0.12; pag.add(band) // 各層の朱の見切り
          const roofR = bw * 0.96 + 0.75
          const roof = new THREE.Mesh(new THREE.ConeGeometry(roofR, 1.2, 4), roofMat); roof.rotation.y = Math.PI / 4; roof.position.y = y + bh + 0.5; roof.castShadow = true; pag.add(roof); pag.add(addOutline(roof)) // 四注の深い軒
          y += bh + 1.0
        }
        const sorin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6), gold); sorin.position.y = y + 1.6; pag.add(sorin) // 相輪の心柱
        for (let r = 0; r < 6; r++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3 - r * 0.025, 0.05, 5, 12), gold); ring.rotation.x = Math.PI / 2; ring.position.y = y + 0.5 + r * 0.36; pag.add(ring) } // 九輪
        const houju = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), gold); houju.position.y = y + 3.5; pag.add(houju) // 宝珠
        colliders.push({ x: tx - 5.5, z: tz - 2, r: 2.8 })
      }
      // 本堂（大きな入母屋の御堂）
      {
        const hall = new THREE.Group(); hall.position.set(4.5, 0.5, -1); grp.add(hall)
        const body = new THREE.Mesh(new THREE.BoxGeometry(8.5, 3.4, 6), wood); body.position.y = 1.7; body.castShadow = true; hall.add(body)
        for (const px of [-4, -1.3, 1.3, 4]) { const pil = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), beam); pil.position.set(px, 1.6, 3.1); hall.add(pil) } // 縁の朱柱
        const roof = new THREE.Mesh(new THREE.ConeGeometry(7.2, 3.0, 4), roofMat); roof.rotation.y = Math.PI / 4; roof.scale.set(1.0, 1, 0.8); roof.position.y = 4.4; roof.castShadow = true; hall.add(roof); hall.add(addOutline(roof))
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.5, 0.7), roofMat); ridge.position.y = 5.55; hall.add(ridge)
        colliders.push({ x: tx + 4.5, z: tz - 1, r: 4.0 })
      }
      // 山門（参道の入口の二本柱の門）
      {
        const mon = new THREE.Group(); mon.position.set(0, 0.5, 8); grp.add(mon)
        for (const px of [-2.2, 2.2]) { const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 4.2, 8), beam); pil.position.set(px, 2.1, 0); pil.castShadow = true; mon.add(pil) }
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.5, 0.6), beam); lintel.position.y = 3.8; mon.add(lintel)
        const roof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.4, 4), roofMat); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.55); roof.position.y = 4.5; roof.castShadow = true; mon.add(roof)
      }
      // 鐘楼（梵鐘を吊る小さな袴腰）
      {
        const bell = new THREE.Group(); bell.position.set(-1, 0.5, 4.5); grp.add(bell)
        for (const px of [-1, 1]) for (const pz of [-1, 1]) { const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.0, 6), wood); pil.position.set(px, 1.5, pz); bell.add(pil) }
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.2, 4), roofMat); roof.rotation.y = Math.PI / 4; roof.position.y = 3.5; roof.castShadow = true; bell.add(roof)
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.2, 10), toon(0x6a6256)); b.position.y = 1.9; bell.add(b)
        colliders.push({ x: tx - 1, z: tz + 4.5, r: 1.4 })
      }
      // 石灯籠×2（参道の左右。夕夜は灯る）
      for (const lp of [[-2.6, 6], [2.6, 6]]) {
        const gy = heightAt(tx + lp[0], tz + lp[1]); const lan = new THREE.Group(); lan.position.set(tx + lp[0], gy, tz + lp[1]); town.add(lan)
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.3, 8), stoneMat); post.position.y = 0.95
        const fire = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), duskAmt > 0.2 ? new THREE.MeshBasicMaterial({ color: 0xffce86 }) : toon(0xb0a890)); fire.position.y = 1.8
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.4, 4), stoneMat); cap.rotation.y = Math.PI / 4; cap.position.y = 2.2
        for (const m of [post, fire, cap]) { m.castShadow = true; lan.add(m) }
      }
      // 寺を背後と側面から抱く木立（街向き＝参道の前(+z)は開けて、塔と御堂を見せる）
      for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; if (Math.sin(a) > 0.2) continue; const rr = 11.5 + R() * 3; tree(tx + Math.cos(a) * rr, tz + Math.sin(a) * rr, 1.0 + R() * 0.6) }
      spawnAvoid.push({ x: tx, z: tz, r: 8 }) // 寺の境内に降りない
    }

    // ── 学校（校舎と校庭）。街の右手の馴染みの場所。時計・トラック・桜並木・プール・遊具。──
    {
      const cx = SCHOOL.x, cz = SCHOOL.z, baseY = heightAt(cx, cz)
      const wallMat = toon(0xe4dac4), roofMat = toon(0x8a7e70), winMat = toon(0x39474f), trimMat = toon(0xbcae94)
      const grp = new THREE.Group(); grp.position.set(cx, baseY, cz); town.add(grp) // 校庭(+z)を街の中心へ向ける
      const makeWing = (w, d, px, pz) => {
        const wing = new THREE.Group(); wing.position.set(px, 0, pz); grp.add(wing)
        const found = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 1.6, d + 0.3), trimMat); found.position.y = -0.5; wing.add(found) // 基礎（傾斜のすき間を隠す）
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, 8.4, d), wallMat); body.position.y = 4.2; body.castShadow = true; body.receiveShadow = true; wing.add(body)
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4), roofMat); roof.position.y = 8.6; wing.add(roof)
        for (let fl = 0; fl < 3; fl++) { // 窓の帯（3階）。前面(+z)に暗いガラスの帯＋窓台。
          const band = new THREE.Mesh(new THREE.BoxGeometry(w - 1.0, 1.5, 0.12), winMat); band.position.set(0, 2.2 + fl * 2.5, d / 2 + 0.02); wing.add(band)
          const sill = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 0.16, 0.22), trimMat); sill.position.set(0, 1.4 + fl * 2.5, d / 2 + 0.04); wing.add(sill)
        }
        return wing
      }
      makeWing(17, 5.5, 0, -7)     // 主棟（東西に長い・校庭の奥）
      makeWing(5.5, 10, -8.5, -1)  // 翼（南北に伸びてL字）
      const cfz = -7 + 2.78 // 主棟の前面
      const clockBg = new THREE.Mesh(new THREE.CircleGeometry(0.95, 22), toon(0xf4efe2)); clockBg.position.set(0, 7.2, cfz); grp.add(clockBg)
      const clkRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.08, 6, 22), trimMat); clkRing.position.set(0, 7.2, cfz + 0.01); grp.add(clkRing)
      const hh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.04), toon(0x33312c)); hh.position.set(0, 7.35, cfz + 0.02); grp.add(hh)
      const mh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.04), toon(0x33312c)); mh.position.set(0.18, 7.25, cfz + 0.02); mh.rotation.z = -0.9; grp.add(mh)
      // 校庭のトラック（白線の楕円。地面に沿わせ段差なく敷く）
      for (let i = 0; i < 48; i++) {
        const a = i / 48 * 6.283, lx = Math.cos(a) * 7, lz = 4 + Math.sin(a) * 5
        const gy = heightAt(cx + lx, cz + lz) - baseY
        const seg = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.34), toon(0xeae3d4)); seg.position.set(lx, gy + 0.06, lz); seg.rotation.y = -a + Math.PI / 2; grp.add(seg)
      }
      // プール（水色の長方形＋低いコンクリ縁）。校庭の右手。
      {
        const plx = 10.5, plz = 2, pgy = heightAt(cx + plx, cz + plz) - baseY
        const water = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 7), new THREE.MeshToonMaterial({ color: 0x8fc4dd, gradientMap: grad, fog: true })); water.rotateX(-Math.PI / 2)
        water.position.set(plx, pgy + 0.14, plz); grp.add(water)
        for (const e of [[0, 3.6, 4.8, 0.4], [0, -3.6, 4.8, 0.4], [2.3, 0, 0.4, 7.6], [-2.3, 0, 0.4, 7.6]]) {
          const rim = new THREE.Mesh(new THREE.BoxGeometry(e[2], 0.5, e[3]), toon(0xd8d2c4)); rim.position.set(plx + e[0], pgy + 0.22, plz + e[1]); grp.add(rim)
        }
      }
      // 桜並木（校門から校舎へ）。季節で姿が変わる（春=桜・夏=緑・秋=紅葉・冬=雪枝）。
      const schBlossom = season === 'spring' ? 0xf0bcce : season === 'autumn' ? 0xd6743a : season === 'winter' ? 0xe4eaf0 : 0x6f9a52
      for (const c of [[-6, 9], [6, 9], [-6, 4.5], [6, 4.5]]) {
        const gy = heightAt(cx + c[0], cz + c[1]); const sg = new THREE.Group(); sg.position.set(cx + c[0], gy, cz + c[1]); town.add(sg)
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.2, 7), toon(0x8a6a48)); tr.position.y = 1.1; tr.castShadow = true; sg.add(tr)
        const sakuraMat = toon(schBlossom)
        const sblobs = season === 'winter' ? [[0, 2.6, 0, 0.62], [-0.7, 2.4, 0.4, 0.46], [0.6, 2.5, -0.4, 0.48]] : [[0, 2.7, 0, 1.3], [-0.8, 2.4, 0.4, 0.9], [0.7, 2.5, -0.4, 0.95]]
        for (const bl of sblobs) { const bs = new THREE.Mesh(new THREE.SphereGeometry(bl[3], 8, 7), sakuraMat); bs.position.set(bl[0], bl[1], bl[2]); bs.castShadow = true; sg.add(bs) }
        colliders.push({ x: cx + c[0], z: cz + c[1], r: 0.5 })
      }
      // 国旗ポール
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 6), toon(0xd0d4d8)); pole.position.set(-4.5, (heightAt(cx - 4.5, cz + 2) - baseY) + 3.5, 2); grp.add(pole)
      // ジャングルジム（立方格子）
      {
        const jx = -10, jz = 8, jgy = heightAt(cx + jx, cz + jz) - baseY, barMat = toon(0xcf6a5a)
        for (let a = 0; a <= 3; a++) for (let b = 0; b <= 3; b++) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 0.06), barMat); v.position.set(jx + (a - 1.5) * 0.7, jgy + 1.0, jz + (b - 1.5) * 0.7); grp.add(v) }
        for (let lvl = 1; lvl <= 2; lvl++) for (let b = 0; b <= 3; b++) { const hbar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 0.06), barMat); hbar.position.set(jx, jgy + lvl * 1.0, jz + (b - 1.5) * 0.7); grp.add(hbar) }
      }
      colliders.push({ x: cx, z: cz - 7, r: 8 }) // 校舎の塊
      spawnAvoid.push({ x: cx, z: cz - 7, r: 9 })
    }

    // ── 遊園地（観覧車のまわり）。ゲート・回転木馬・旗・柵・ベンチ＝明るい賑わいの目的地。──
    {
      const fx = FUN.x, fz = FUN.z
      // 入口ゲート（アーチ＋「ゆうえんち」看板＋三角旗）。観覧車の手前(+z=街側)に。
      {
        const gz = fz + 11, gy = heightAt(fx, gz)
        const grp = new THREE.Group(); grp.position.set(fx, gy, gz); town.add(grp)
        const postMat = toon(0xe06f8a)
        for (const px of [-4.4, 4.4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 5.6, 10), postMat); p.position.set(px, 2.8, 0); p.castShadow = true; grp.add(p) }
        const arch = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.42, 8, 20, Math.PI), toon(0xf2c14e)); arch.position.set(0, 5.4, 0); grp.add(arch)
        const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: true }) // アーチの豆電球（昼も明るく・夕夜は灯りに）
        for (let i = 1; i < 11; i++) { const a = i / 11 * Math.PI; const bb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), bulbMat); bb.position.set(Math.cos(a) * 4.4, 5.4 + Math.sin(a) * 4.4, 0.12); grp.add(bb) }
        const bc = document.createElement('canvas'); bc.width = 256; bc.height = 64; const bx2 = bc.getContext('2d')
        bx2.fillStyle = '#e8567f'; bx2.fillRect(0, 0, 256, 64); bx2.strokeStyle = '#fff3d0'; bx2.lineWidth = 4; bx2.strokeRect(3, 3, 250, 58)
        bx2.fillStyle = '#fff8e8'; bx2.font = 'bold 33px sans-serif'; bx2.textAlign = 'center'; bx2.textBaseline = 'middle'; bx2.fillText('ゆうえんち', 128, 36)
        const banner = new THREE.Mesh(new THREE.BoxGeometry(8, 1.3, 0.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc) })); banner.position.set(0, 5.7, 0.12); grp.add(banner)
        const flagCols = [0xe8567f, 0xf2c14e, 0x5aa6d0, 0x6fae8f]
        for (let i = -4; i <= 4; i++) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 3), toon(flagCols[(i + 4) % 4])); fl.rotation.z = Math.PI / 2; fl.position.set(i * 0.95, 5.0 + Math.abs(i) * 0.04, 0); grp.add(fl) }
      }
      // メリーゴーラウンド（回転木馬）。台＋馬は回り、屋根と心柱は止まる。
      {
        const mx = fx + 9, mz = fz + 2, gy = heightAt(mx, mz)
        const outer = new THREE.Group(); outer.position.set(mx, gy, mz); town.add(outer)
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 5, 10), toon(0xd9b44a)); pole.position.y = 2.6; outer.add(pole)
        const rc = document.createElement('canvas'); rc.width = 64; rc.height = 16; const rcx = rc.getContext('2d')
        for (let i = 0; i < 8; i++) { rcx.fillStyle = i % 2 ? '#e8567f' : '#fff3e0'; rcx.fillRect(i * 8, 0, 8, 16) }
        const rtex = new THREE.CanvasTexture(rc); rtex.wrapS = THREE.RepeatWrapping; rtex.repeat.set(6, 1)
        const roof = new THREE.Mesh(new THREE.ConeGeometry(4.7, 1.9, 20), new THREE.MeshToonMaterial({ map: rtex, gradientMap: grad, fog: true })); roof.position.y = 4.9; roof.castShadow = true; outer.add(roof)
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), toon(0xf2c14e)); ball.position.y = 5.95; outer.add(ball)
        if (duskAmt > 0.25) { const cbulb = new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: true }); for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 6), cbulb); b.position.set(Math.cos(a) * 4.5, 4.0, Math.sin(a) * 4.5); outer.add(b) } } // 屋根の縁の電飾
        const spin = new THREE.Group(); outer.add(spin); carousel = spin
        const plat = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.3, 0.5, 20), toon(0xf0e6d2)); plat.position.y = 0.25; plat.receiveShadow = true; spin.add(plat)
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * 6.283, rr = 3.2
          const h = new THREE.Group(); h.position.set(Math.cos(a) * rr, 0.5, Math.sin(a) * rr); spin.add(h)
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), toon(0xd9b44a)); bar.position.y = 1.5; h.add(bar)
          const hMat = i % 2 ? toon(0xf6f1e8) : toon(0xd98f5a)
          const bodyH = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.7, 3, 6), hMat); bodyH.rotation.z = Math.PI / 2; bodyH.position.y = 1.0; h.add(bodyH)
          const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.45, 3, 6), hMat); neck.position.set(0.45, 1.35, 0); neck.rotation.z = 0.7; h.add(neck)
        }
        colliders.push({ x: mx, z: mz, r: 4.4 })
      }
      // 低い柵（遊園地の縁。街側のゲート寄りは空ける）
      const fenceMat = toon(0xd6dde0)
      for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283; if (Math.sin(a) > 0.45) continue; const px = fx + Math.cos(a) * (FUN.r - 1), pz = fz + Math.sin(a) * (FUN.r - 1); const gy = heightAt(px, pz); const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.12), fenceMat); post.position.set(px, gy + 0.5, pz); town.add(post) }
      // ベンチ×2
      for (const bp of [[fx - 6, fz + 4, 1.2], [fx + 3, fz + 8, -0.6]]) {
        const gy = heightAt(bp[0], bp[1]); const bg = new THREE.Group(); bg.position.set(bp[0], gy, bp[1]); bg.rotation.y = bp[2]; town.add(bg)
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.46), toon(0x8a6a48)); seat.position.y = 0.46; bg.add(seat)
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.36, 0.1), toon(0x8a6a48)); back.position.set(0, 0.72, -0.2); bg.add(back)
      }
      // コーヒーカップ（回る台＋色とりどりのカップ）。台が回り、各カップも逆に回る。
      {
        const tx = fx - 9, tz = fz + 3, gy = heightAt(tx, tz)
        const outer = new THREE.Group(); outer.position.set(tx, gy, tz); town.add(outer)
        const base = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.4, 18), toon(0x4a7a5e)); base.position.y = 0.2; base.receiveShadow = true; outer.add(base)
        const spin = new THREE.Group(); spin.position.y = 0.4; outer.add(spin); teacups = spin
        const cupCols = [0xd84a4a, 0xe0a838, 0x3a8ac0, 0x6fae8f]
        for (let i = 0; i < 4; i++) {
          const a = i / 4 * 6.283, cup = new THREE.Group(); cup.position.set(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2); spin.add(cup)
          const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.7, 0.9, 14), toon(cupCols[i])); bowl.position.y = 0.6; bowl.castShadow = true; cup.add(bowl)
          const handle = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 6, 10, Math.PI), toon(cupCols[i])); handle.position.set(0.95, 0.6, 0); cup.add(handle)
        }
      }
      // スワンボートの小池（浅い水面＋石の縁＋白鳥のボート）。FUNの南側。
      {
        const sx = fx - 2, sz = fz - 8, sgy = heightAt(sx, sz), pondR = 4.2, waterY = sgy - 0.3
        const wc = document.createElement('canvas'); wc.width = wc.height = 32; const wcx = wc.getContext('2d')
        const wg = wcx.createLinearGradient(0, 0, 0, 32); wg.addColorStop(0, '#' + new THREE.Color(0x7aa6c4).lerp(skyTop, 0.4).getHexString()); wg.addColorStop(1, '#4f748e'); wcx.fillStyle = wg; wcx.fillRect(0, 0, 32, 32)
        const water = new THREE.Mesh(new THREE.CircleGeometry(pondR, 24), new THREE.MeshToonMaterial({ color: 0xffffff, map: new THREE.CanvasTexture(wc), gradientMap: grad, fog: true })); water.rotateX(-Math.PI / 2); water.position.set(sx, waterY, sz); town.add(water)
        const rimGeos = []
        for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283, rr = pondR + 0.2 + (R() - 0.5) * 0.3, rx2 = sx + Math.cos(a) * rr, rz2 = sz + Math.sin(a) * rr, top = heightAt(rx2, rz2), s2 = 0.5 + R() * 0.3, seg = new THREE.BoxGeometry(s2, Math.max(0.4, top - (waterY - 0.6)), s2); seg.applyMatrix4(new THREE.Matrix4().makeTranslation(rx2, waterY - 0.3, rz2)); rimGeos.push(seg) }
        if (BufferGeometryUtils.mergeGeometries) { const rm = BufferGeometryUtils.mergeGeometries(rimGeos, false); if (rm) { const rim = new THREE.Mesh(rm, toon(0x9a958c)); rim.receiveShadow = true; town.add(rim) } }
        rimGeos.forEach((g) => g.dispose())
        for (const bp of [[sx - 1.4, sz + 0.6], [sx + 1.2, sz - 1.0], [sx + 0.2, sz + 1.5]]) {
          const sb = new THREE.Group(); sb.position.set(bp[0], waterY + 0.1, bp[1]); sb.userData = { cx: sx, cz: sz, ph: R() * 6.28, rad: Math.hypot(bp[0] - sx, bp[1] - sz) }; town.add(sb)
          const hull = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xf2f0ea)); hull.scale.set(1, 0.6, 1.3); hull.position.y = 0.1; sb.add(hull)
          const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.0, 6), toon(0xf2f0ea)); neck.position.set(0, 0.6, 0.6); neck.rotation.x = -0.5; sb.add(neck)
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), toon(0xf2f0ea)); head.position.set(0, 1.05, 0.85); sb.add(head)
          const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 5), toon(0xe0902e)); beak.position.set(0, 1.03, 1.0); beak.rotation.x = Math.PI / 2; sb.add(beak)
          swanBoats.push(sb)
        }
        colliders.push({ x: sx, z: sz, r: pondR * 0.8 }); spawnAvoid.push({ x: sx, z: sz, r: pondR + 1 })
      }
      spawnAvoid.push({ x: fx, z: fz, r: 12 })
    }

    // ── 海・港（街の東の縁が湾へ下る）。空を映す広い水面＋防波堤＋灯台＋小舟＝飛んで海まで行ける。──
    {
      // 海面（空を映す大きな水鏡。MeshToonの空グラデ＋さざ波。沖まで広く敷く）。
      const wc = document.createElement('canvas'); wc.width = wc.height = 128; const wcx = wc.getContext('2d')
      const wg = wcx.createLinearGradient(0, 0, 0, 128)
      // 海は空をうっすら映しつつ、青を芯に強く残す（夕の暖色フォグに溶けて砂色にならないよう、濃いめの青で）。
      wg.addColorStop(0, '#' + new THREE.Color(0x2a6d9a).lerp(skyTop, 0.07).getHexString())
      wg.addColorStop(1, '#' + new THREE.Color(0x163f5e).lerp(skyHorizon, 0.04).getHexString())
      wcx.fillStyle = wg; wcx.fillRect(0, 0, 128, 128)
      for (let i = 0; i < 150; i++) { wcx.fillStyle = `rgba(255,255,255,${0.05 + R() * 0.07})`; wcx.fillRect(R() * 128, R() * 128, 2 + R() * 4, 1) } // さざ波
      const wtex = new THREE.CanvasTexture(wc); wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.repeat.set(104, 69); seaTex = wtex
      const seaGeo = new THREE.PlaneGeometry(1760, 1180); seaGeo.rotateX(-Math.PI / 2)
      // MeshBasic＝向きの照明に左右されず、海面の色を一定に保つ（広い面が夕日で暖色に焼けるのを防ぐ）。
      // そこへシェーダーで「動くうねり・谷の濃藍・うろこ雲のような波頭・水平線のきらめき」を重ね、ぱっと見て海と分かる水面に。
      seaUniforms = { uTime: { value: 0 } }
      const seaMat = new THREE.MeshBasicMaterial({ map: wtex, fog: true })
      seaMat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = seaUniforms.uTime
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWPos;')
          .replace('#include <map_fragment>', `#include <map_fragment>
            float ph = uTime;
            // 大きなうねり＋斜めのさざ波（複数周波の和＝規則的すぎない水面）
            float sw = sin(vWPos.x * 0.045 + ph * 0.7) * 0.5 + sin(vWPos.z * 0.035 - ph * 0.5) * 0.5;
            sw += 0.5 * sin((vWPos.x + vWPos.z) * 0.085 + ph * 1.1) + 0.4 * sin(vWPos.z * 0.16 - ph * 1.7);
            float crest = smoothstep(0.55, 1.5, sw);   // 波頭
            float trough = smoothstep(0.55, 1.7, -sw);  // 波の谷
            vec3 deep = vec3(0.07, 0.24, 0.40);
            vec3 shal = vec3(0.27, 0.54, 0.66);
            vec3 foam = vec3(0.82, 0.90, 0.95);
            diffuseColor.rgb = mix(diffuseColor.rgb, deep, trough * 0.55);
            diffuseColor.rgb = mix(diffuseColor.rgb, shal, crest * 0.30);
            diffuseColor.rgb += foam * crest * 0.16;
            // 水平線まわりのきらめき（カメラから遠い帯でちらちら＝夕日の道のような輝き）
            float dC = distance(vWPos.xz, cameraPosition.xz);
            float band = smoothstep(170.0, 360.0, dC) * (1.0 - smoothstep(470.0, 650.0, dC));
            float gl = 0.5 + 0.5 * sin(vWPos.x * 0.55 + vWPos.z * 0.28 + ph * 4.2);
            diffuseColor.rgb += vec3(1.0, 0.96, 0.85) * band * pow(gl, 4.0) * 0.4;
          `)
      }
      const seaMesh = new THREE.Mesh(seaGeo, seaMat)
      seaMesh.position.set(0, SEA.level, -300); seaMesh.receiveShadow = true; town.add(seaMesh) // x≈-880..880・z≈-890..290 を広く覆う（Phase0で遠ざけた西=大正/東=江戸/北=戦国への長い渡りの海）
      // ── 海の向こうの城下町（江戸）。海を渡るとやがて霞(fog)の向こうに天守が現れる＝M1の“reveal”。──
      {
        const ex = EDO.x, ez = EDO.z, gy = heightAt(ex, ez)
        // 島の地面（heightAtに沿う土・草の地面。これが無いと建物/人が宙に浮く）。縁は海面下へ落ちて海に隠れる。
        { const isz = (EDO.r + 6) * 2, gI = new THREE.PlaneGeometry(isz, isz, 74, 74); gI.rotateX(-Math.PI / 2); const gp = gI.attributes.position
          for (let i = 0; i < gp.count; i++) gp.setY(i, heightAt(ex + gp.getX(i), ez + gp.getZ(i)) - 0.06)
          gI.computeVertexNormals(); const gmesh = new THREE.Mesh(gI, mottleMat(season === 'winter' ? 0xd6dcd4 : season === 'autumn' ? 0x9a8a56 : 0x8e8158, 230, 0.22, [6, 6])); gmesh.position.set(ex, 0, ez); gmesh.receiveShadow = true; town.add(gmesh) }
        // 城下の田畑・草地（地面に緑/黄の区画を点在＝のっぺりした砂色を脱す）
        { const fieldCols = season === 'autumn' ? [0xb89a4a, 0x9a8848, 0x8a7a40] : season === 'winter' ? [0xd8dcd6, 0xc8ccc4, 0xb8b0a0] : season === 'spring' ? [0x8aa84e, 0x7a9a44, 0x9ab058] : [0x6e8a48, 0x7e9450, 0x5e7a40]
          for (let k = 0; k < 46; k++) { const a = R() * 6.28, rr = 30 + R() * 74, fx = ex + Math.cos(a) * rr, fz = ez + Math.sin(a) * rr, fy = heightAt(fx, fz); if (fy < SEA.level + 2 || edoStream(fx, fz) < 4) continue
            const fld = new THREE.Mesh(new THREE.CircleGeometry(2.8 + R() * 4.0, 7), toon(fieldCols[k % fieldCols.length])); fld.rotation.x = -Math.PI / 2; fld.rotation.z = R() * 6.28; fld.position.set(fx, fy + 0.04, fz); fld.receiveShadow = true; town.add(fld) } } // 城下〜外周の田畑（外周の地肌を埋める）
        // 海岸の磯（島の汀に岩が点々＝海岸線のクオリティ）
        for (let k = 0; k < 26; k++) { const a = (k / 26) * 6.2832 + R() * 0.2, rr = 106 + R() * 5, rx = ex + Math.cos(a) * rr, rz = ez + Math.sin(a) * rr, ry = heightAt(rx, rz); const rk = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 + R() * 1.3, 0), toon(season === 'winter' ? 0x9c9c98 : 0x837c70)); rk.position.set(rx, Math.max(SEA.level, ry) + 0.3 + R() * 0.5, rz); rk.rotation.set(R() * 3, R() * 3, R() * 3); rk.scale.y = 0.65; rk.castShadow = true; town.add(rk) }
        // ── 城下を蛇行する小川（平底の河床＋河川敷の草＋木の橋）＝平らな台地に水辺の自然 ──
        { const wmat = new THREE.MeshBasicMaterial({ map: wtex, color: isNight ? 0x4e5c66 : 0x9fbcca, fog: true })
          const grassC = season === 'winter' ? 0xb8c0b6 : season === 'autumn' ? 0x9a8a52 : 0x6e8a48
          let prev = null
          for (let s = 0; s <= 26; s++) { const edd = 24 + s * ((EDO.r - 14 - 24) / 26), ang = 1.15 + Math.sin(edd * 0.085) * 0.34, px = ex + Math.cos(ang) * edd, pz = ez + Math.sin(ang) * edd, py = heightAt(px, pz)
            const w = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 4.6), wmat); w.rotation.x = -Math.PI / 2; if (prev) w.rotation.z = Math.atan2(pz - prev.z, px - prev.x); w.position.set(px, py + 0.28, pz); town.add(w) // 水面（平らな河床に沿う）
            if (s % 2 === 0) for (const side of [-1, 1]) { const gx = px + Math.cos(ang + Math.PI / 2) * 3.4 * side, gz = pz + Math.sin(ang + Math.PI / 2) * 3.4 * side, gyy = heightAt(gx, gz); const gr = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + R() * 0.4, 0), toon(grassC)); gr.position.set(gx, gyy + 0.18, gz); gr.scale.y = 0.5; town.add(gr) } // 河川敷の草むら
            prev = { x: px, z: pz } }
          { const bang = 1.15 + Math.sin(50 * 0.085) * 0.34, bx = ex + Math.cos(bang) * 50, bz = ez + Math.sin(bang) * 50, bbank = heightAt(bx + Math.cos(bang + Math.PI / 2) * 4.5, bz + Math.sin(bang + Math.PI / 2) * 4.5)
            const br = new THREE.Mesh(new THREE.BoxGeometry(9, 0.34, 2.3), toon(0x7a6248)); br.position.set(bx, bbank + 0.5, bz); br.rotation.y = bang; br.castShadow = true; town.add(br); town.add(addOutline(br))
            for (const rl of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 0.12), toon(0x6a5440)); rail.position.set(bx + Math.cos(bang + Math.PI / 2) * 1.05 * rl, bbank + 0.95, bz + Math.sin(bang + Math.PI / 2) * 1.05 * rl); rail.rotation.y = bang; town.add(rail) } } // 木の橋＋欄干
        }
        const moat = new THREE.Mesh(new THREE.RingGeometry(13, 18.5, 48), new THREE.MeshBasicMaterial({ map: wtex, color: isNight ? 0x44545f : 0xeaf2f6, fog: true })); moat.rotation.x = -Math.PI / 2; moat.position.set(ex, gy + 0.1, ez); town.add(moat) // 堀（さざ波の水面＝海と同じ水テクスチャ）
        for (const rr of [13, 18.5]) { const bank = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.35, 6, 40), toon(season === 'winter' ? 0x8e8b82 : 0x847d70)); bank.rotation.x = -Math.PI / 2; bank.position.set(ex, gy + 0.2, ez); town.add(bank) } // 石垣の護岸（内外の縁）
        const baseH = 7.5
        const ishi = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 12.5, baseH, 4), toon(season === 'winter' ? 0x908d84 : 0x8b8478)); ishi.rotation.y = Math.PI / 4; ishi.position.set(ex, gy + baseH / 2, ez); ishi.castShadow = true; ishi.receiveShadow = true; town.add(ishi); town.add(addOutline(ishi)) // 石垣（裾広がりの四角錐台）
        for (const f of [0.26, 0.52, 0.78]) { const r = 12.5 + (9.5 - 12.5) * f; const cs = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.05, r + 0.12, 0.16, 4), toon(0x6f6b62)); cs.rotation.y = Math.PI / 4; cs.position.set(ex, gy + baseH * f, ez); town.add(cs) } // 石の段（横の石組み）
        const wallC = toon(season === 'winter' ? 0xf1ede3 : 0xebe5d7), roofC = toon(season === 'winter' ? (isNight ? 0x6e7782 : 0x9aa3ab) : (isNight ? 0x29303a : 0x3a434e)) // 冬は屋根に雪化粧
        const litMat = new THREE.MeshBasicMaterial({ color: 0xf0bd72, fog: true }) // 夜に灯る障子/窓の暖色
        const winC = isNight ? litMat : toon(0x2e3138) // 連子窓（夜は灯る）
        let yb = gy + baseH, topBase = yb, topW = 3.4
        const tiers = [[7.4, 4.6], [6.3, 4.0], [5.3, 3.6], [4.3, 3.2], [3.4, 3.0]] // [壁幅, 壁高] 下から上へ
        for (let i = 0; i < tiers.length; i++) {
          const w = tiers[i][0], h = tiers[i][1], rw = (w + 1.8) * 0.72, rh = 2.2
          if (i === tiers.length - 1) { topBase = yb; topW = w }
          const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), wallC); wall.position.set(ex, yb + h / 2, ez); wall.castShadow = true; town.add(wall); town.add(addOutline(wall)) // 白漆喰の壁
          for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const nx = Math.sin(a), nz = Math.cos(a); for (const s of [-1, 1]) { const win = new THREE.Mesh(new THREE.BoxGeometry(0.85, h * 0.4, 0.06), winC); win.position.set(ex + nx * (w / 2 + 0.04) + Math.cos(a) * s * w * 0.24, yb + h * 0.52, ez + nz * (w / 2 + 0.04) - Math.sin(a) * s * w * 0.24); win.rotation.y = a; town.add(win) } } // 連子窓（各面2つ）
          const roof = new THREE.Mesh(new THREE.ConeGeometry(rw, rh, 4), roofC); roof.rotation.y = Math.PI / 4; roof.position.set(ex, yb + h + rh / 2 - 0.15, ez); roof.castShadow = true; town.add(roof); town.add(addOutline(roof)) // 黒瓦の屋根（軒が張る）
          if (i < 3) for (const sgn of [1, -1]) { const gb = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.26, w * 0.26, 0.42, 3), wallC); gb.rotation.set(Math.PI / 2, 0, Math.PI / 2); gb.position.set(ex, yb + h + 0.5, ez + sgn * rw * 0.58); gb.castShadow = true; town.add(gb); town.add(addOutline(gb)) } // 千鳥破風（前後の妻）
          yb += h + rh - 1.0
        }
        { const br = topW / 2 + 0.45, ry0 = topBase + 1.3; for (const [ax, az, ry] of [[0, br, 0], [0, -br, 0], [br, 0, Math.PI / 2], [-br, 0, Math.PI / 2]]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(br * 2 + 0.2, 0.34, 0.1), toon(0x6a4a30)); rail.position.set(ex + ax, ry0, ez + az); rail.rotation.y = ry; town.add(rail) } } // 最上階の高欄（望楼の廻縁）
        for (const sgn of [-1, 1]) { const shachi = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.1, 6), toon(0xc8a23c)); shachi.position.set(ex + sgn * 1.3, yb + 0.2, ez); shachi.rotation.z = sgn * -0.32; town.add(shachi) } // 鯱（金）
        // ── 城下の町家（堀の外。環状に整列）。西(ang≈π)に大手門への参道を空ける ──
        const tRoof = toon(season === 'winter' ? (isNight ? 0x8a9098 : 0xb8bcc0) : (isNight ? 0x47403a : 0x6f5f4d)), tWall = facadeMat('machiya', season === 'winter' ? 0xd9d3c5 : 0xcbc0a9) // 町家＝障子の格子窓＋格子戸の正面（最初の街の質感へ）
        const angGap = (a) => { let d = Math.abs(a - Math.PI); if (d > Math.PI) d = 6.2832 - d; return d } // 西の参道(ang≈π)からの角度差
        // 広大な城下町: 町家(平屋/2階)・土蔵・大店を高さ/大きさ/色を変えて密に。放射の大通りで街区を割る。メッシュ統合で軽量。
        // 屋根は街区(扇形セクタ)ごとに色をまとめ＝俯瞰の市松を脱し「瓦の町並みの塊」に。町家は街路に平行な切妻、土蔵/大店は寄棟。
        const wallA = [], wallB = [], wall3 = [], litG = [], plE = [], tmpM = new THREE.Matrix4(), rotM = new THREE.Matrix4()
        const avenues = [0.4, 1.18, 1.96, 2.74, 3.6, 4.38, 5.16, 5.94] // 放射の大通り（8本＝入り組んだ街路網に）
        const ringRoads = [40, 66, 92, 116] // 同心円の環状道路（街区を区切る・拡大した外周にもう一本）
        const bukeSpots = [[5.0, 94], [5.36, 103], [5.72, 95], [5.62, 112], [4.8, 106], [6.04, 100]] // 武家屋敷町の区画（拡大した外周の新地区）[角度, 半径]
        const edoFac = [{ x: ex - 52, z: ez + 44, r: 14 }, { x: ex - 26, z: ez - 58, r: 10 }, ...bukeSpots.map(([a, r]) => ({ x: ex + Math.cos(a) * r, z: ez + Math.sin(a) * r, r: 6.5 }))] // 庭園/寺子屋/武家屋敷の区画（町家を空ける）
        const roofPalette = isNight
          ? [0x2e2f33, 0x342c24, 0x2a2520, 0x3a2c26, 0x33302c]
          : [0x717479, 0x6a5640, 0x564636, 0x7a4f3c, 0x807668] // 瓦銀鼠/茶瓦/杉皮/弁柄/灰茶
        const roofMats = roofPalette.map((c) => tileMat(c, 2, 3, true)) // 瓦の屋根テクスチャ（切妻は片面巻き→両面）
        const roofGeos = roofPalette.map(() => [])
        const nSec = 9 // 城下を9つの街区(扇形)に割り、各区で屋根の基調色をまとめる
        const gableUnit = (() => { // 切妻屋根の単位素片。ridge=ローカルX、妻行=Z、棟高=Y(0→1)
          const g = new THREE.BufferGeometry()
          const P = { a: [-0.5, 0, -0.5], b: [0.5, 0, -0.5], c: [0.5, 0, 0.5], d: [-0.5, 0, 0.5], e: [-0.5, 1, 0], f: [0.5, 1, 0] }
          const v = [], push = (...pts) => pts.forEach((p) => v.push(p[0], p[1], p[2]))
          push(P.a, P.b, P.f); push(P.a, P.f, P.e) // 背スロープ(z-)
          push(P.d, P.e, P.f); push(P.d, P.f, P.c) // 前スロープ(z+)
          push(P.a, P.e, P.d); push(P.b, P.c, P.f) // 妻壁(x∓)
          // ConeGeometry(寄棟)と統合するため index/uv 属性を揃える（非index混在だと mergeGeometries が失敗する）。UVは瓦が軒→棟へ流れるよう割付。
          g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
          const uv = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1] // 各頂点(18)のUV: スロープは軒0→棟1
          g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(uv), 2))
          g.setIndex([...Array(18).keys()]); g.computeVertexNormals(); return g
        })()
        for (let ring = 0; ring < 28; ring++) {
          const rr = 21 + ring * 3.95, n = Math.round(rr * 1.05)
          const onRing = ringRoads.some((rr0) => Math.abs(rr - rr0) < 2.8) // 環状道路のリングは建てない
          for (let k = 0; k < n; k++) {
            const a = (k / n) * 6.2832 + ring * 0.45
            if (angGap(a) < 0.3) continue // 大手門の参道
            let onAve = false; for (const av of avenues) { let d = Math.abs(a - av); if (d > Math.PI) d = 6.2832 - d; if (d < 0.13) { onAve = true; break } }
            if (onAve || onRing || k % 13 === 0) continue // 大通り＋環状道路＋路地の隙間
            const jit = (R() - 0.5) * 1.8, hx = ex + Math.cos(a) * (rr + jit), hz = ez + Math.sin(a) * (rr + jit), hy = heightAt(hx, hz)
            if (hy < SEA.level + 1.0 || edoStream(hx, hz) < 6 || edoFac.some((f) => Math.hypot(hx - f.x, hz - f.z) < f.r)) continue // 海・汀・小川・庭園/寺子屋には建てない
            const tt = R(), two = tt < 0.32, kura = tt > 0.88, oodana = tt > 0.74 && tt <= 0.88 // 2階町家/土蔵/大店
            const hw = oodana ? 3.6 + R() * 1.8 : 2.1 + R() * 1.3
            const hd = oodana ? 2.8 + R() * 1.3 : kura ? hw : 1.7 + R() * 1.0
            const hh = two ? 3.0 + R() * 1.3 : kura ? 2.9 + R() * 0.7 : oodana ? 2.2 + R() * 0.5 : 1.3 + R() * 0.6
            tmpM.makeRotationY(a).setPosition(hx, hy + hh / 2, hz); const bg = new RoundedBoxGeometry(hw, hh, hd, 1, Math.min(0.16, Math.min(hw, hd) * 0.07)); if (!kura) bakeAO(bg, hh); bg.applyMatrix4(tmpM); (kura ? wallB : R() < 0.16 ? wall3 : wallA).push(bg) // 角を面取り＝低ポリの角張りを脱す
            const plg = new THREE.BoxGeometry(hw + 0.5, 0.55, hd + 0.5); tmpM.makeRotationY(a).setPosition(hx, hy + 0.18, hz); plg.applyMatrix4(tmpM); plE.push(plg) // 石の土台（接地）
            const sec = Math.floor((((a % 6.2832) + 6.2832) % 6.2832) / (6.2832 / nSec))
            let ci = (sec * 2 + (sec % 2)) % roofPalette.length; if (R() < 0.22) ci = (ci + 1) % roofPalette.length; if (kura) ci = 2 // 街区基調＋時々隣色で揺らぐ。土蔵は杉皮
            const rh = two ? 1.6 : kura ? 1.0 : oodana ? 1.3 : 1.0
            if (kura || oodana) { // 土蔵・大店は寄棟（四角錐）
              tmpM.makeRotationY(a + Math.PI / 4).setPosition(hx, hy + hh + rh / 2 - 0.05, hz); const rg = new THREE.ConeGeometry(Math.max(hw, hd) * 0.64, rh, 4); rg.applyMatrix4(tmpM); roofGeos[ci].push(rg)
            } else { // 町家は街路に平行な切妻（ridgeを接線方向 a+π/2 へ・庇が両側に出る平入り）
              const rg = gableUnit.clone(); tmpM.makeScale(hw * 1.04, rh, hd * 1.14); rotM.makeRotationY(a + Math.PI / 2); tmpM.premultiply(rotM); tmpM.setPosition(hx, hy + hh - 0.05, hz); rg.applyMatrix4(tmpM); roofGeos[ci].push(rg)
            }
            if (isNight && R() < 0.5) { tmpM.makeRotationY(a).setPosition(hx + Math.cos(a) * (hw * 0.45), hy + hh * (two ? 0.62 : 0.45), hz + Math.sin(a) * (hw * 0.45)); const lg = new THREE.BoxGeometry(0.5, 0.5, 0.12); lg.applyMatrix4(tmpM); litG.push(lg) }
          }
        }
        const wallBMat = mottleMat(season === 'winter' ? 0xeae6dc : 0xe2ddd0, 170, 0.1, [1.2, 1.2]), wall3Mat = facadeMat('machiya', season === 'winter' ? 0xb8b0a2 : 0x9a8a70) // 土蔵=漆喰のまま/板壁の町家=格子窓の正面
        tWall.vertexColors = true; wall3Mat.vertexColors = true // 壁の接地AO（頂点色）を効かせる
        const plinthMat = mottleMat(season === 'winter' ? 0xbcc0c2 : 0x8c867c, 120, 0.12, [2, 1]) // 石の土台
        for (const [geos, mat] of [[wallA, tWall], [wallB, wallBMat], [wall3, wall3Mat], [plE, plinthMat], [litG, litMat]]) { if (geos.length && BufferGeometryUtils.mergeGeometries) { const m = BufferGeometryUtils.mergeGeometries(geos, false); if (m) { const mesh = new THREE.Mesh(m, mat); mesh.castShadow = mat !== litMat; mesh.receiveShadow = mat !== litMat; town.add(mesh) } geos.forEach((g) => g.dispose()) } }
        // ── 城下の街路網（放射の大通り8本＋大手門参道＋環状道路3本）＝入り組んだ道。地形に沿う土の道。統合で軽量。 ──
        { const roadMat = toon(season === 'winter' ? 0xc8ccc6 : 0x7e7050), roadGeos = [], rM = new THREE.Matrix4()
          const seg = (x0, z0, x1, z1, w) => { const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz); if (len < 0.5) return; const px = (x0 + x1) / 2, pz = (z0 + z1) / 2, py = heightAt(px, pz); if (py < SEA.level + 0.6) return; const bg = new THREE.BoxGeometry(w, 0.16, len + 0.9); rM.makeRotationY(Math.atan2(dx, dz)).setPosition(px, py + 0.09, pz); bg.applyMatrix4(rM); roadGeos.push(bg) }
          const road = (x0, z0, x1, z1, w) => { const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 5)); for (let s = 0; s < steps; s++) seg(x0 + (x1 - x0) * s / steps, z0 + (z1 - z0) * s / steps, x0 + (x1 - x0) * (s + 1) / steps, z0 + (z1 - z0) * (s + 1) / steps, w) }
          for (const av of [...avenues, Math.PI]) road(ex + Math.cos(av) * 18, ez + Math.sin(av) * 18, ex + Math.cos(av) * 118, ez + Math.sin(av) * 118, av === Math.PI ? 5.2 : 4.0) // 放射の大通り（参道は太め・外周まで延伸）
          for (const rr0 of ringRoads) { let prev = null; for (let s = 0; s <= 56; s++) { const a = s / 56 * 6.2832, px = ex + Math.cos(a) * rr0, pz = ez + Math.sin(a) * rr0; if (prev) road(prev.x, prev.z, px, pz, 3.8); prev = { x: px, z: pz } } } // 環状道路
          if (roadGeos.length && BufferGeometryUtils.mergeGeometries) { const m = BufferGeometryUtils.mergeGeometries(roadGeos, false); if (m) { const rmesh = new THREE.Mesh(m, roadMat); rmesh.receiveShadow = true; town.add(rmesh) } roadGeos.forEach((g) => g.dispose()) }
        }
        roofGeos.forEach((geos, i) => { if (geos.length && BufferGeometryUtils.mergeGeometries) { const m = BufferGeometryUtils.mergeGeometries(geos, false); if (m) { const mesh = new THREE.Mesh(m, roofMats[i]); mesh.castShadow = true; mesh.receiveShadow = true; town.add(mesh) } geos.forEach((g) => g.dispose()) } })
        gableUnit.dispose()
        // 城下のランドマーク（街並みに目印を：五重塔・火の見櫓）
        { const tx = ex + Math.cos(2.2) * 48, tz = ez + Math.sin(2.2) * 48, ty = heightAt(tx, tz)
          if (ty > SEA.level + 1) { let py = ty; for (let i = 0; i < 5; i++) { const w = 4.0 - i * 0.55, h = 2.1 - i * 0.1; const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), toon(season === 'winter' ? 0xe2ddd0 : 0xcabfa8)); body.position.set(tx, py + h / 2, tz); body.castShadow = true; town.add(body); const roof = new THREE.Mesh(new THREE.ConeGeometry((w + 1.5) * 0.72, 1.0, 4), tRoof); roof.rotation.y = Math.PI / 4; roof.position.set(tx, py + h + 0.4, tz); town.add(roof); town.add(addOutline(roof)); py += h + 0.7 } const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), toon(0xc8a23c)); fin.position.set(tx, py + 1.1, tz); town.add(fin) } } // 五重塔
        { const fx = ex + Math.cos(4.7) * 42, fz = ez + Math.sin(4.7) * 42, fy = heightAt(fx, fz)
          if (fy > SEA.level + 1) { for (const [ddx, ddz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 5), toon(0x5a4632)); leg.position.set(fx + ddx * 0.9, fy + 3.5, fz + ddz * 0.9); leg.rotation.set(ddz * 0.05, 0, -ddx * 0.05); town.add(leg) } const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 2.4), toon(0x6a5238)); cab.position.set(fx, fy + 7.4, fz); cab.castShadow = true; town.add(cab); town.add(addOutline(cab)); const cr = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.0, 4), tRoof); cr.rotation.y = Math.PI / 4; cr.position.set(fx, fy + 8.6, fz); town.add(cr) } } // 火の見櫓
        // ── 城下の賑わい（市場・屋台・提灯・人々）＝街に生気を ──
        const kimono = [0xb0432e, 0x3a5a7a, 0x55703f, 0xc89a34, 0x84548a, 0x5a5a5e, 0xa85a40]
        const mkPerson = (px, py, pz, col) => { const g = new THREE.Group(); g.position.set(px, py, pz); g.rotation.y = R() * 6.28; const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.26, 0.78, 6), toon(col)); body.position.y = 0.4; body.castShadow = true; g.add(body); const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 7, 6), toon(0xe6c6a4)); head.position.y = 0.95; g.add(head); town.add(g) }
        { const ma = Math.PI - 0.6, mr = 31, mcx = ex + Math.cos(ma) * mr, mcz = ez + Math.sin(ma) * mr, mgy = heightAt(mcx, mcz)
          if (mgy > SEA.level + 1) {
            for (let s = 0; s < 9; s++) { const a2 = (s / 9) * 6.2832, sx2 = mcx + Math.cos(a2) * 5.5, sz2 = mcz + Math.sin(a2) * 5.5, sgy = heightAt(sx2, sz2); if (sgy < SEA.level + 1) continue
              const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 1.1), toon(0x8a6a48)); counter.position.set(sx2, sgy + 0.42, sz2); counter.rotation.y = a2; counter.castShadow = true; town.add(counter)
              const awn = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 1.7), toon(s % 2 ? 0xc24a33 : 0x40608a)); awn.position.set(sx2, sgy + 1.75, sz2); awn.rotation.y = a2; town.add(awn); town.add(addOutline(awn))
              for (const pp of [-1.0, 1.0]) { const c2 = Math.cos(a2), s4 = Math.sin(a2); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 4), toon(0x5a4632)); pole.position.set(sx2 - s4 * pp, sgy + 0.9, sz2 + c2 * pp); town.add(pole) }
              mkPerson(sx2 + Math.cos(a2) * 1.6, sgy, sz2 + Math.sin(a2) * 1.6, kimono[s % kimono.length]) // 売り子
            }
            for (let s = 0; s < 9; s++) { const a2 = (s / 9) * 6.2832 + 0.35, lx = mcx + Math.cos(a2) * 4, lz = mcz + Math.sin(a2) * 4; const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8), isNight ? new THREE.MeshBasicMaterial({ color: 0xff9a4a, fog: true }) : toon(0xd8504a)); lan.position.set(lx, mgy + 3.4, lz); town.add(lan) } // 提灯（市場の上）
            for (let k = 0; k < 7; k++) mkPerson(mcx + (R() - 0.5) * 8, mgy, mcz + (R() - 0.5) * 8, kimono[k % kimono.length]) // 買い物客
          }
        }
        for (let k = 0; k < 30; k++) { const a2 = R() * 6.28, r2 = 24 + R() * 42, px = ex + Math.cos(a2) * r2, pz = ez + Math.sin(a2) * r2, py = heightAt(px, pz); if (py < SEA.level + 1) continue; mkPerson(px, py, pz, kimono[k % kimono.length]) } // 通りの人々
        { const yago = ['魚', '酒', '米', '茶', '薬', '呉服', '両替', '蕎麦', '飯', '宿', '油', '炭', '団子', '塩'] // 城下の店の屋号（縦書きの木の掛看板）
          for (let k = 0; k < 13; k++) { const a2 = (k / 13) * 6.28 + 0.3; if (angGap(a2) < 0.34) continue; const r2 = 22 + R() * 9, px = ex + Math.cos(a2) * r2, pz = ez + Math.sin(a2) * r2, py = heightAt(px, pz); if (py < SEA.level + 1.2) continue
            mkSignV(px, py + 1.4, pz, a2 + Math.PI / 2 + (R() - 0.5) * 0.4, yago[k % yago.length], season === 'winter' ? 0xeae0cc : 0xe6d8b8, 0x3a2a1a) } } // 城下の店の看板
        for (const av of [0.4, 1.7, 3.0, 4.4, 5.6]) for (let j = 0; j < 3; j++) { const ang = av + (R() - 0.5) * 0.12, r0 = 24 + j * 5, r1 = 54 + R() * 8; const wg = new THREE.Group(); const wb = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.26, 0.78, 6), toon(kimono[(j * 2 + 1) % kimono.length])); wb.position.y = 0.4; wb.castShadow = true; wg.add(wb); const wh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 7, 6), toon(0xe6c6a4)); wh.position.y = 0.95; wg.add(wh); wg.position.set(ex + Math.cos(ang) * r0, heightAt(ex + Math.cos(ang) * r0, ez + Math.sin(ang) * r0), ez + Math.sin(ang) * r0); town.add(wg); cityWalkers.push({ g: wg, cx: ex, cz: ez, ang, r0, r1, y0: heightAt(ex + Math.cos(ang) * r0, ez + Math.sin(ang) * r0), y1: heightAt(ex + Math.cos(ang) * r1, ez + Math.sin(ang) * r1), sp: 0.05 + R() * 0.04, ph: R() * 2 }) } // 大通りを行き交う人（初期位置を置く＝遠方時に原点へ取り残されない）
        const addPine = (px, py, pz) => { const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.0, 6), toon(0x6a4f38)); tr.position.set(px, py + 1.0, pz); town.add(tr); const fo = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.3, 7), toon(season === 'autumn' ? 0x8a7a40 : 0x4e6e44)); fo.position.set(px, py + 2.8, pz); town.add(fo) }
        // 城下に木立を散らす（家々の合間・辻・空き地を緑で埋める＝home並みの緑量へ）。統合で軽量（1本ごとのドローコールを増やさない）。
        { const leafC = season === 'spring' ? 0x7faa4e : season === 'autumn' ? 0xcf8a38 : season === 'winter' ? 0xcdd6cc : 0x5a7e44
          const trunkGeos = [], coneGeos = [], leafGeos = [], tmM2 = new THREE.Matrix4()
          for (let k = 0; k < 76; k++) { const a2 = R() * 6.2832, r2 = 22 + R() * 96, px = ex + Math.cos(a2) * r2, pz = ez + Math.sin(a2) * r2, py = heightAt(px, pz)
            if (py < SEA.level + 1.4 || edoStream(px, pz) < 5 || Math.hypot(px - ex, pz - ez) < 21 || edoFac.some((f) => Math.hypot(px - f.x, pz - f.z) < f.r + 1)) continue // 海/小川/堀の内/庭園は避ける（拡大した島の外周まで緑を行き渡らせる）
            const pine = R() < 0.4, s = pine ? 1 : 0.85 + R() * 0.5
            const trG = new THREE.CylinderGeometry(0.17 * s, 0.27 * s, 1.9 * s, 6); tmM2.makeTranslation(px, py + 0.95 * s, pz); trG.applyMatrix4(tmM2); trunkGeos.push(trG)
            if (pine) { const fG = new THREE.ConeGeometry(1.6, 2.3, 7); tmM2.makeTranslation(px, py + 2.8, pz); fG.applyMatrix4(tmM2); coneGeos.push(fG) } // 松/杉
            else { const fG = new THREE.IcosahedronGeometry(1.5 * s, 0); tmM2.makeTranslation(px, py + 2.2 * s, pz); fG.applyMatrix4(tmM2); leafGeos.push(fG) } } // 雑木
          for (const [geos, mat] of [[trunkGeos, toon(0x6a4f38)], [coneGeos, toon(season === 'autumn' ? 0x8a7a40 : 0x4e6e44)], [leafGeos, toon(leafC)]]) { if (geos.length && BufferGeometryUtils.mergeGeometries) { const m = BufferGeometryUtils.mergeGeometries(geos, false); if (m) { const mesh = new THREE.Mesh(m, mat); mesh.castShadow = true; mesh.receiveShadow = true; town.add(mesh) } geos.forEach((g) => g.dispose()) } }
        }
        // 大手門（西の参道。鏡柱＋冠木＋渡櫓＋築地塀＋松並木）
        { const gx = ex - 19, gz = ez, gyg = heightAt(gx, gz)
          if (gyg > SEA.level + 0.5) {
            for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.4, 0.7), toon(0x5a4632)); post.position.set(gx, gyg + 1.7, gz + s * 2.0); post.castShadow = true; town.add(post); town.add(addOutline(post)) } // 鏡柱
            const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 4.7), toon(0x5a4632)); lintel.position.set(gx, gyg + 3.5, gz); town.add(lintel) // 冠木
            const yagura = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 5.2), wallC); yagura.position.set(gx, gyg + 4.9, gz); yagura.castShadow = true; town.add(yagura); town.add(addOutline(yagura)) // 渡櫓
            const groof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 1.6, 4), roofC); groof.rotation.y = Math.PI / 4; groof.position.set(gx, gyg + 6.5, gz); groof.scale.x = 0.55; town.add(groof); town.add(addOutline(groof)) // 門の屋根
            for (const s of [-1, 1]) { const dei = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 7), toon(season === 'winter' ? 0xcfc8ba : 0xc4baa6)); dei.position.set(gx, gyg + 0.85, gz + s * 6.6); town.add(dei); town.add(addOutline(dei)); const cap = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.28, 7), roofC); cap.position.set(gx, gyg + 1.8, gz + s * 6.6); town.add(cap) } // 築地塀＋瓦の笠
            for (const s of [-1, 1]) { const lx = gx - 1.6, lz = gz + s * 2.7, ly = heightAt(lx, lz); const pole = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.3, 0.45), toon(0x8a8378)); pole.position.set(lx, ly + 0.65, lz); town.add(pole); const fire = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), isNight ? litMat : toon(0xe2d3a6)); fire.position.set(lx, ly + 1.45, lz); town.add(fire); const lcap = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.38, 4), toon(0x5a5048)); lcap.rotation.y = Math.PI / 4; lcap.position.set(lx, ly + 1.82, lz); town.add(lcap) } // 灯籠（夜に灯る）
            for (let k = 0; k < 5; k++) { const px = gx - 1 - k * 2.6; for (const s of [-1, 1]) { const pz = gz + s * 3.6, py = heightAt(px, pz); if (py < SEA.level + 1.0) continue; addPine(px, py, pz) } } // 参道の松並木
            const bridge = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 3.4), toon(season === 'winter' ? 0xb8b2a6 : 0x9a8a72)); bridge.position.set(ex - 15.5, gyg + 0.3, gz); bridge.castShadow = true; town.add(bridge); town.add(addOutline(bridge)) // 堀に架かる土橋（大手門→石垣の軸線）
            for (const s of [-1, 1]) for (let bx = -3; bx <= 3; bx += 2) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), toon(0x6a4a30)); post.position.set(ex - 15.5 + bx, gyg + 0.7, gz + s * 1.6); town.add(post) } // 橋の欄干
          }
        }
        // ── 二の丸御殿（城内の御殿。低く広がる入母屋の屋根）──
        { const palMat = toon(season === 'winter' ? 0xe8e4da : 0xe0d8c6), palRoof = toon(season === 'winter' ? (isNight ? 0x70787f : 0x9aa0a6) : (isNight ? 0x33373e : 0x49515b))
          const pa = 0.7, pcx = ex + Math.cos(pa) * 19.5, pcz = ez + Math.sin(pa) * 19.5, pgy = heightAt(pcx, pcz)
          for (const [dx, dz, ww, wd] of [[0, 0, 7, 5], [5.2, 1.0, 4, 6.5], [-3.2, 1.6, 5.5, 3.6]]) {
            const wh = 1.8, body = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, wd), palMat); body.position.set(pcx + dx, pgy + wh / 2, pcz + dz); body.castShadow = true; town.add(body); town.add(addOutline(body))
            const md = Math.max(ww, wd), roof = new THREE.Mesh(new THREE.ConeGeometry(md * 0.62, 1.5, 4), palRoof); roof.rotation.y = Math.PI / 4; roof.scale.set(ww / md, 1, wd / md); roof.position.set(pcx + dx, pgy + wh + 0.65, pcz + dz); roof.castShadow = true; town.add(roof); town.add(addOutline(roof))
          }
          addPine(pcx + 4.5, pgy, pcz - 4); addPine(pcx - 5, pgy, pcz - 3) // 御殿前の松
        }
        // ── 船着場（島の港。木の桟橋＋係留の小舟）──
        { const da = 2.5, sdx = Math.cos(da), sdz = Math.sin(da)
          for (let r = 35; r <= 41; r += 1.5) { const px = ex + sdx * r, pz = ez + sdz * r; const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 6), toon(0x5a4632)); pile.position.set(px, SEA.level + 0.3, pz); town.add(pile) } // 杭
          const deck = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 2.4), toon(0x6a4f38)); deck.position.set(ex + sdx * 38, SEA.level + 1.4, ez + sdz * 38); deck.rotation.y = -da; deck.castShadow = true; town.add(deck); town.add(addOutline(deck)) // 桟橋の床
          for (const off of [-2.2, 2.2]) { const bx = ex + sdx * 40 - sdz * off, bz = ez + sdz * 40 + sdx * off; const boat = new THREE.Group(); boat.position.set(bx, SEA.level + 0.15, bz); boat.rotation.y = -da; boat.userData = { ph: R() * 6.28 }; const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 1.2), toon(0x55402a)); hull.position.y = 0.1; boat.add(hull); town.add(boat); boats.push(boat) } // 係留の小舟
        }
        for (let k = 0; k < 6; k++) { const ang = R() * 6.28, rr = 26 + R() * 8, px = ex + Math.cos(ang) * rr, pz = ez + Math.sin(ang) * rr, py = heightAt(px, pz); if (py < SEA.level + 1.2) continue; addPine(px, py, pz) } // 島の松
        // ── 四季の木立（春＝桜／秋＝紅葉／冬＝雪化粧／夏＝緑。堀の外をぐるり囲む）──
        { const folC = season === 'spring' ? 0xeeb6cc : season === 'autumn' ? 0xcf7034 : season === 'winter' ? 0xdfe4e7 : 0x5c7e48
          for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.2832; if (angGap(a) < 0.5 || Math.abs(a - 0.7) < 0.5) continue; const rr = 20.5 + (k % 2) * 1.2, px = ex + Math.cos(a) * rr, pz = ez + Math.sin(a) * rr, py = heightAt(px, pz); if (py < SEA.level + 1.5) continue; const s = 0.9 + R() * 0.3
            const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 1.5 * s, 6), toon(0x6a4f38)); tr.position.set(px, py + 0.75 * s, pz); town.add(tr)
            const fo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 * s, 0), toon(folC)); fo.position.set(px, py + 2.1 * s, pz); fo.castShadow = true; town.add(fo) } } // 四季の木立
        // ── 城下の高台の鎮守の社（拡大に合わせた地形の見どころ。朱の鳥居＋お堂＋鎮守の森） ──
        { const hx0 = ex + 60, hz0 = ez - 50, hy0 = heightAt(hx0, hz0)
          const torii = new THREE.Group(); torii.position.set(hx0, hy0, hz0 + 8); const trd = toon(season === 'winter' ? 0xb04438 : 0xc0392b)
          for (const px of [-2.2, 2.2]) { const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 5.0, 7), trd); pil.position.set(px, 2.5, 0); pil.castShadow = true; torii.add(pil) }
          torii.add(new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.6, 0.7), trd).translateY(4.9)); torii.add(new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.4, 0.5), trd).translateY(3.9)); town.add(torii); town.add(addOutline(torii))
          const hall = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 5), facadeMat('machiya', 0xd8cfb8)); hall.position.set(hx0, hy0 + 1.6, hz0); hall.castShadow = true; hall.receiveShadow = true; town.add(hall); town.add(addOutline(hall))
          const hroof = new THREE.Mesh(new THREE.ConeGeometry(5.4, 2.2, 4), tileMat(season === 'winter' ? 0xb8bcc0 : 0x564636, 2, 2, false)); hroof.rotation.y = Math.PI / 4; hroof.position.set(hx0, hy0 + 4.3, hz0); hroof.castShadow = true; town.add(hroof); town.add(addOutline(hroof))
          for (let k = 0; k < 12; k++) { const a = R() * 6.28, rr = 8 + R() * 12, tx2 = hx0 + Math.cos(a) * rr, tz2 = hz0 + Math.sin(a) * rr, ty2 = heightAt(tx2, tz2); if (ty2 < hy0 - 4) continue; const s = 1.0 + R() * 0.5 // 鎮守の森
            const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.28 * s, 2.0 * s, 6), toon(0x6a4f38)); tr.position.set(tx2, ty2 + 1.0 * s, tz2); town.add(tr)
            const fo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7 * s, 0), toon(season === 'autumn' ? 0xb06a30 : season === 'winter' ? 0x6e7a72 : 0x4e6e42)); fo.position.set(tx2, ty2 + 2.6 * s, tz2); fo.castShadow = true; town.add(fo) }
          for (let i = 0; i < 6; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 1.4), toon(0x9a948a)); st.position.set(hx0 + (i - 5) * 1.0, heightAt(hx0 + (i - 5) * 2.4, hz0 + 8 + i * 1.6) + 0.15, hz0 + 8 + i * 1.6); town.add(st) } } // 参道の石段
        // ── 大名庭園（池＋太鼓橋＋石灯籠＋桜松）＝城下の憩いの場（公園） ──
        { const gx0 = ex - 52, gz0 = ez + 44, gy0 = heightAt(gx0, gz0)
          if (gy0 > SEA.level + 1) {
            const pond = new THREE.Mesh(new THREE.CircleGeometry(8, 22), new THREE.MeshBasicMaterial({ map: wtex, color: isNight ? 0x3a4a52 : 0x8aacba, fog: true })); pond.rotation.x = -Math.PI / 2; pond.position.set(gx0, gy0 + 0.14, gz0); town.add(pond)
            const bank = new THREE.Mesh(new THREE.TorusGeometry(8, 0.32, 6, 26), toon(0x8a8278)); bank.rotation.x = -Math.PI / 2; bank.position.set(gx0, gy0 + 0.22, gz0); town.add(bank)
            const bridge = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.3, 6, 10, Math.PI), toon(season === 'winter' ? 0xb04438 : 0xc0392b)); bridge.position.set(gx0, gy0 + 0.4, gz0); bridge.rotation.set(0, 0.6, 0); town.add(bridge); town.add(addOutline(bridge)) // 太鼓橋
            for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28, lx = gx0 + Math.cos(a) * 10, lz = gz0 + Math.sin(a) * 10, ly = heightAt(lx, lz); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.3, 6), toon(0x9a948a)); post.position.set(lx, ly + 0.65, lz); town.add(post); const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.5, 6), toon(0x8a8278)); cap.position.set(lx, ly + 1.5, lz); town.add(cap) } // 石灯籠
            for (let k = 0; k < 8; k++) { const a = R() * 6.28, rr = 10 + R() * 4, px = gx0 + Math.cos(a) * rr, pz = gz0 + Math.sin(a) * rr, py = heightAt(px, pz); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6), toon(0x6a4f38)); tr.position.set(px, py + 0.8, pz); town.add(tr); const fo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), toon(season === 'spring' ? 0xeeb6cc : season === 'autumn' ? 0xcf7034 : season === 'winter' ? 0xdfe4e7 : 0x4e6e44)); fo.position.set(px, py + 2.2, pz); fo.castShadow = true; town.add(fo) } } }
        // ── 寺子屋（手習いの学び舎＋幟）＝城下の学校 ──
        { const sx0 = ex - 26, sz0 = ez - 58, sy0 = heightAt(sx0, sz0)
          if (sy0 > SEA.level + 1) {
            const hall = new THREE.Mesh(new RoundedBoxGeometry(8, 3.0, 5.4, 1, 0.12), facadeMat('machiya', 0xd8cfb8)); hall.position.set(sx0, sy0 + 1.5, sz0); hall.castShadow = true; hall.receiveShadow = true; town.add(hall); town.add(addOutline(hall))
            const hroof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 2.0, 4), tileMat(season === 'winter' ? 0xb8bcc0 : 0x564636, 2, 2, false)); hroof.rotation.y = Math.PI / 4; hroof.position.set(sx0, sy0 + 4.0, sz0); hroof.castShadow = true; town.add(hroof); town.add(addOutline(hroof))
            const fence = new THREE.Mesh(new THREE.BoxGeometry(14, 1.0, 0.2), toon(0x8a6a48)); fence.position.set(sx0, sy0 + 0.5, sz0 + 6); town.add(fence) // 庭の塀
            const nob = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.2), signMat('手習所', '#e6dcc4', '#3a2a1a', true)); nob.position.set(sx0 - 5.2, sy0 + 2.6, sz0 + 4); town.add(nob); const npole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.4, 5), toon(0x6a5440)); npole.position.set(sx0 - 5.7, sy0 + 2.2, sz0 + 4); town.add(npole) } } // 幟
        // ── 城下の暮らしの作り込み（町なかの庭木・堀の小舟・井戸）＝近づくほど良い街に ──
        { const gC = season === 'spring' ? 0x7faa56 : season === 'autumn' ? 0xb88a3e : season === 'winter' ? 0xcdd6d2 : 0x5e7e46
          for (let k = 0; k < 15; k++) { const a = R() * 6.28; if (angGap(a) < 0.34) continue; const rr = 25 + R() * 36, px = ex + Math.cos(a) * rr, pz = ez + Math.sin(a) * rr, py = heightAt(px, pz); if (py < SEA.level + 1.5) continue; const s = 0.7 + R() * 0.5 // 家々の間の庭木
            const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.2 * s, 1.3 * s, 6), toon(0x6a4f38)); tr.position.set(px, py + 0.65 * s, pz); town.add(tr)
            const fo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 * s, 0), toon(gC)); fo.position.set(px, py + 1.75 * s, pz); fo.castShadow = true; town.add(fo) }
          for (let k = 0; k < 3; k++) { const a = (k / 3) * 6.28 + 0.5, br = 15.8, bx = ex + Math.cos(a) * br, bz = ez + Math.sin(a) * br // 堀に浮かぶ係留の小舟
            const boat = new THREE.Group(); const hull = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.36, 0.85), toon(0x5a4632)); hull.position.y = 0.18; boat.add(hull); const inside = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.55), toon(0x6e5640)); inside.position.y = 0.32; boat.add(inside)
            boat.position.set(bx, gy + 0.16, bz); boat.rotation.y = a + Math.PI / 2; boat.rotation.z = (R() - 0.5) * 0.05; town.add(boat) }
          for (const [wa, wr] of [[1.3, 30], [4.3, 27]]) { const wx = ex + Math.cos(wa) * wr, wz = ez + Math.sin(wa) * wr, wy = heightAt(wx, wz); if (wy < SEA.level + 1.5) continue // 井戸（井筒＋四本柱の小屋根）
            const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 0.9, 8), toon(0x8b8478)); ring.position.set(wx, wy + 0.45, wz); ring.castShadow = true; town.add(ring); town.add(addOutline(ring))
            for (const [dx, dz] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 5), toon(0x5a4632)); post.position.set(wx + dx, wy + 1.25, wz + dz); town.add(post) }
            const wroof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.66, 4), tRoof); wroof.rotation.y = Math.PI / 4; wroof.position.set(wx, wy + 2.4, wz); town.add(wroof); town.add(addOutline(wroof)) }
        }
        // ── 武家屋敷町（拡大した外周の新地区）。築地塀に囲まれた侍の屋敷＝長屋門＋入母屋の主屋＋庭の松。城下の格を上げる ──
        { const bWall = toon(season === 'winter' ? 0xd8d2c4 : 0xcabfa8), bRoofM = tileMat(season === 'winter' ? 0xb8bcc0 : 0x564636, 2, 2, false), bCap = toon(season === 'winter' ? 0xa8acb0 : 0x5a4e3c)
          for (const [a, rr] of bukeSpots) { const cx2 = ex + Math.cos(a) * rr, cz2 = ez + Math.sin(a) * rr, cy = heightAt(cx2, cz2); if (cy < SEA.level + 1.6) continue
            const g = new THREE.Group(); g.position.set(cx2, cy, cz2); g.rotation.y = a + Math.PI / 2; town.add(g) // 街路に正対
            for (const [lx, lz, lw, ld] of [[0, -4.7, 9.4, 0.4], [0, 4.7, 9.4, 0.4], [-4.7, 0, 0.4, 9.0], [4.7, 0, 0.4, 9.0]]) { const w = new THREE.Mesh(new THREE.BoxGeometry(lw, 1.5, ld), bWall); w.position.set(lx, 0.75, lz); w.castShadow = true; g.add(w); const cap = new THREE.Mesh(new THREE.BoxGeometry(lw + 0.2, 0.22, ld + 0.2), bCap); cap.position.set(lx, 1.6, lz); g.add(cap) } // 築地塀＋瓦の笠
            const gate = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.3, 1.3), bWall); gate.position.set(0, 1.15, -4.7); gate.castShadow = true; g.add(gate); g.add(addOutline(gate)) // 長屋門
            const groof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.0, 4), bRoofM); groof.rotation.y = Math.PI / 4; groof.scale.set(1.3, 1, 0.55); groof.position.set(0, 2.7, -4.7); g.add(groof); g.add(addOutline(groof))
            const house = new THREE.Mesh(new RoundedBoxGeometry(5.4, 2.6, 4.2, 1, 0.1), facadeMat('machiya', season === 'winter' ? 0xd9d3c5 : 0xd2c7ad)); house.position.set(0.4, 1.3, 0.6); house.castShadow = true; house.receiveShadow = true; g.add(house); g.add(addOutline(house)) // 主屋
            const hr = new THREE.Mesh(new THREE.ConeGeometry(4.0, 1.7, 4), bRoofM); hr.rotation.y = Math.PI / 4; hr.scale.set(1, 1, 0.86); hr.position.set(0.4, 3.5, 0.6); hr.castShadow = true; g.add(hr); g.add(addOutline(hr))
            for (const sgn of [1, -1]) { const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.34, 3), bWall); ridge.rotation.set(Math.PI / 2, 0, Math.PI / 2); ridge.position.set(0.4, 3.0, 0.6 + sgn * 1.7); g.add(ridge) } // 千鳥破風
            const pt = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.4, 6), toon(0x6a4f38)); pt.position.set(3.0, 0.7, 3.0); g.add(pt); const pf = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.0, 7), toon(season === 'autumn' ? 0x8a6a32 : season === 'winter' ? 0xb8c0c4 : 0x46603a)); pf.position.set(3.0, 2.3, 3.0); pf.castShadow = true; g.add(pf) // 庭の松
          }
        }
      }
      // ── 海の渡りの演出（帆船・島影）。退屈な海にせず、瞑想的な“渡り”に（海鳥は海鳥のループへ）。──
      {
        const mkPine = (px, py, pz, s = 1) => { const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.26 * s, 1.9 * s, 6), toon(0x6a4f38)); tr.position.set(px, py + 0.95 * s, pz); town.add(tr); const fo = new THREE.Mesh(new THREE.ConeGeometry(1.5 * s, 2.2 * s, 7), toon(season === 'autumn' ? 0x8a7a40 : season === 'winter' ? 0x9aa6a0 : 0x4e6e44)); fo.position.set(px, py + 2.6 * s, pz); town.add(fo) }
        const addShip = (sx, sz, ry) => { // 弁才船ふうの大きな四角帆。波にゆれる（boats配列で揺らす）
          const ship = new THREE.Group(); ship.position.set(sx, SEA.level + 0.15, sz); ship.rotation.y = ry; ship.userData = { ph: R() * 6.28 }
          const hull = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.1, 1.9), toon(0x55402a)); hull.position.y = 0.15; ship.add(hull)
          const prow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.5), toon(0x55402a)); prow.position.set(3.0, 0.4, 0); prow.rotation.z = -0.3; ship.add(prow) // 反り上がった舳先
          const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 1.6), toon(0x6a4a30)); cabin.position.set(-1.5, 0.95, 0); ship.add(cabin)
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 5.4, 6), toon(0x4a3826)); mast.position.set(0.5, 3.0, 0); ship.add(mast)
          const sail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.7, 3.5), toon(season === 'winter' ? 0xe6e2d8 : 0xe7dec8)); sail.position.set(0.5, 3.3, 0); ship.add(sail)
          town.add(ship); boats.push(ship)
        }
        addShip(180, -52, 0.5); addShip(320, -28, -0.7); addShip(460, -56, 0.25); addShip(380, -40, -0.4) // 東(江戸)への長い渡りに帆船を散らす
        addShip(150, -200, 1.7); addShip(135, -360, -1.5); addShip(150, -500, 1.6) // 北(戦国)への渡りにも帆船
        addShip(-270, -28, 0.6); addShip(-400, -44, -0.5); addShip(-510, -30, 0.3) // 西(大正)への渡りにも蒸気船/帆船
        const addIslet = (ix, iz, scl) => { // 渡りの途中の緑豊かな小島（岩＋森＋松＝道中を退屈にしない）
          const my = SEA.level - 0.4
          const mound = new THREE.Mesh(new THREE.ConeGeometry(5.2 * scl, 3.4 * scl, 8), toon(0x6e6a5c)); mound.position.set(ix, my + 1.6 * scl, iz); mound.castShadow = true; town.add(mound); town.add(addOutline(mound))
          const cap = new THREE.Mesh(new THREE.ConeGeometry(4.4 * scl, 1.7 * scl, 8), toon(season === 'winter' ? 0xd8dde0 : season === 'autumn' ? 0x8a7a40 : 0x4e6e3e)); cap.position.set(ix, my + 3.1 * scl, iz); town.add(cap) // 緑の頂（広め＝緑豊か）
          const topY = my + 3.4 * scl
          for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.2832, rr = (0.3 + R() * 0.7) * 3.4 * scl; mkPine(ix + Math.cos(a) * rr, topY - rr * 0.22, iz + Math.sin(a) * rr, (0.7 + R() * 0.5) * scl) } // 森
          for (let i = 0; i < 3; i++) { const a = R() * 6.28, rk = new THREE.Mesh(new THREE.IcosahedronGeometry((0.6 + R() * 0.6) * scl, 0), toon(0x7c766a)); rk.position.set(ix + Math.cos(a) * 4.6 * scl, my + 0.5, iz + Math.sin(a) * 4.6 * scl); rk.rotation.set(R() * 3, R() * 3, R() * 3); town.add(rk) } // 岩
        }
        addIslet(180, -38, 1.4); addIslet(300, -50, 1.0); addIslet(420, -40, 1.3); addIslet(520, -52, 1.0) // 東(江戸)への島々（唯一導線を残す渡り＝退屈にしない中継）
        // 北(戦国)・西(大正)の中継の島は撤去＝導線で位置がバレないよう、海の向こうに独立させ「偶然見つける」渡りに（実機FB）。
        // 道中の小島で羽を休める鳥（飛んで近づくと一斉に舞い立つ＝旅の途中の一瞬の生気）
        const mkIslandFlock = (cx, cz) => {
          const bmat = new THREE.MeshBasicMaterial({ color: isNight ? 0x2a3a4e : 0x3a3a40, fog: true }), birds = []
          for (let i = 0; i < 9; i++) {
            const b = new THREE.Group()
            for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.26), bmat); w.position.x = s * 0.38; w.userData.side = s; b.add(w) }
            const bx = cx + (R() - 0.5) * 8, bz = cz + (R() - 0.5) * 8, by = heightAt(bx, bz) + 0.5 + R() * 3
            b.position.set(bx, by, bz); b.userData = { ph: R() * 6.28 }; town.add(b)
            birds.push({ g: b, bx, by, bz, vx: 0, vy: 0, vz: 0 })
          }
          islandFlocks.push({ birds, cx, cz, state: 'perched', t: 0 })
        }
        mkIslandFlock(300, -50) // 東(江戸)の道中の小島の鳥（戦国/大正は島を撤去したので無し）
      }
      // ── 北の海の果ての戦国の山城（時代の異なる第2の目的地。Edoとは遠く海で隔て共視界に入れない）──
      {
        const sx = SENGOKU.x, sz = SENGOKU.z, peak = senH(sx, sz)
        // 配置は全て senH(px,pz) に載せる＝うねる稜線と完全一致で何も浮かない。coneY は中央の城郭の段用（半径だけの近似＝山頂付近は平ら）。
        const coneY = (rr) => { const v = senH(sx + rr, sz); return v > -990 ? v : SEA.level }
        // ── 山本体＝senH を極座標グリッドでサンプルした非対称メッシュ（対称Latheを置換）。稜線・谷・肩の小峰が立ち、頂点色で水彩の濃淡。──
        {
          const RINGS = 30, SEG = 58, vpos = [], vcol = [], idx = []
          const cBase = new THREE.Color(season === 'winter' ? 0xcacfce : season === 'autumn' ? 0x6f5f37 : 0x4a6038) // 裾の緑（季節）
          const cHigh = new THREE.Color(season === 'winter' ? 0xe6eaeb : 0x827e66) // 高所の岩肌/雪
          const tmpC = new THREE.Color()
          for (let i = 0; i <= RINGS; i++) {
            const rr = Math.pow(i / RINGS, 1.05) * senR * 1.26
            for (let j = 0; j <= SEG; j++) {
              const ang = (j / SEG) * Math.PI * 2
              const px = sx + Math.cos(ang) * rr, pz = sz + Math.sin(ang) * rr
              let y = senH(px, pz); if (y < -990) y = SEA.floor - 1.5
              vpos.push(Math.cos(ang) * rr, y, Math.sin(ang) * rr)
              const hT = Math.max(0, Math.min(1, (y - 2) / 22)) // 谷底(緑)〜尾根(岩)
              tmpC.copy(cBase).lerp(cHigh, hT * hT) // 高所ほど岩/雪
              const sh = 0.84 + 0.16 * (0.5 + 0.5 * Math.sin(ang * 3.0 + rr * 0.12)) // 尾根筋のわずかな明暗（水彩のムラ）
              vcol.push(tmpC.r * sh, tmpC.g * sh, tmpC.b * sh)
            }
          }
          for (let i = 0; i < RINGS; i++) for (let j = 0; j < SEG; j++) { const a = i * (SEG + 1) + j, b = a + 1, c = a + (SEG + 1), d = c + 1; idx.push(a, c, b, b, c, d) }
          const mg = new THREE.BufferGeometry()
          mg.setAttribute('position', new THREE.Float32BufferAttribute(vpos, 3)); mg.setAttribute('color', new THREE.Float32BufferAttribute(vcol, 3)); mg.setIndex(idx); mg.computeVertexNormals()
          const mMat = toon(0xffffff); mMat.vertexColors = true
          const mtn = new THREE.Mesh(mg, mMat); mtn.position.set(sx, 0, sz); mtn.castShadow = true; mtn.receiveShadow = true; town.add(mtn)
        }
        // ── 奥の山並み（重なり合う稜線を大気遠近で淡く。城の背後＝北と両袖に不均等に。接近路の南は海を開ける）──
        { const fogC = new THREE.Color(SEN_FOGC.getHex()), rngBase = new THREE.Color(season === 'winter' ? 0xcfd4d6 : season === 'autumn' ? 0x6a6048 : 0x55664c)
          const arcs = [[-58, -86], [-22, -104], [22, -98], [58, -84], [-90, -44], [84, -40], [-82, 8], [82, 2], [-40, -122], [36, -120], [4, -150]] // [dx,dz] 北と両袖の遠山（等間隔を避ける）
          for (let k = 0; k < arcs.length; k++) { const adx = arcs[k][0], adz = arcs[k][1], dist = Math.hypot(adx, adz), far = Math.min(1, (dist - 80) / 70)
            const mx = sx + adx, mz = sz + adz, hh = 27 + R() * 16 - far * 5, rad = 24 + R() * 16
            const col = rngBase.clone().lerp(fogC, 0.4 + far * 0.36) // 遠いほど霞の色へ＝大気遠近
            const ridge = new THREE.Mesh(new THREE.ConeGeometry(rad, hh, 6, 1), toon(col.getHex())); ridge.position.set(mx, SEA.level - 2 + hh / 2, mz); ridge.rotation.y = R() * 3; ridge.scale.x = 1.5 + R() * 0.6; town.add(ridge) // 横に広げ重ねて稜線に
          }
        }
        // ── 川（谷を南北に蛇行し、南の河口で海へ注ぐ。水辺に城下町が沿う）──
        { const rmat = new THREE.MeshBasicMaterial({ map: seaTex || wtex, color: isNight ? 0x33414e : 0x6f93a4, fog: true }), rgeos = [], rM = new THREE.Matrix4(); let prev = null
          for (let s = 0; s <= 42; s++) { const zz = sz + 36 - s * 2.5, cl = senValley(zz), px = sx + cl, gh = senH(px, zz), py = Math.max(SEA.level - 0.1, gh) - 0.04
            if (gh > 8.5) break // 谷頭で止める（川が山へ登って見えるのを防ぐ＝水源は山の中）
            const wdt = Math.max(2.6, 6.4 - Math.max(0, gh - 1) * 0.5) // 上流ほど細る
            if (prev) { const ddx = px - prev.x, ddz = zz - prev.z, len = Math.hypot(ddx, ddz); const bg = new THREE.PlaneGeometry(wdt, len + 1.1); bg.rotateX(-Math.PI / 2); rM.makeRotationY(Math.atan2(ddx, ddz)).setPosition((px + prev.x) / 2, (py + prev.py) / 2, (zz + prev.z) / 2); bg.applyMatrix4(rM); rgeos.push(bg) }
            prev = { x: px, z: zz, py } }
          if (rgeos.length && BufferGeometryUtils.mergeGeometries) { const m = BufferGeometryUtils.mergeGeometries(rgeos, false); if (m) { const rmesh = new THREE.Mesh(m, rmat); town.add(rmesh) } rgeos.forEach((g) => g.dispose()) }
        }
        // ── 城は中央の急峰でなく、東尾根の中腹の平場(bluff)に建つ＝「真ん中に城が奇妙」を解消。石垣の段に天守。──
        const sWall = mottleMat(season === 'winter' ? 0x6e665c : 0x4a3f30, 150, 0.16, [1.4, 1.4]), sRoof = mottleMat(season === 'winter' ? (isNight ? 0x7a828a : 0xa8b0b6) : (isNight ? 0x232730 : 0x34383f), 150, 0.12, [1.8, 1.8]) // 黒い板張りの木目＋黒瓦の濃淡（冬は雪化粧）
        const bx = sx + senBluff.dx, bz = sz + senBluff.dz, bgY = senH(bx, bz)
        for (const [cr, ch] of [[10.5, 2.6], [7, 2.4]]) { const ku = new THREE.Mesh(new THREE.CylinderGeometry(cr - 1.2, cr, ch, 7), toon(season === 'winter' ? 0x9aa0a2 : 0x8a8278)); ku.rotation.y = 0.3; ku.position.set(bx, bgY + ch / 2 - 0.4, bz); ku.castShadow = true; ku.receiveShadow = true; town.add(ku); town.add(addOutline(ku)) } // 石垣の段（平場の土台）
        let yb = bgY + 4.2; const st = [[5.4, 3.4], [4.2, 2.9], [3.0, 2.5]]
        for (let i = 0; i < st.length; i++) {
          const w = st[i][0], h = st[i][1], rw = (w + 1.5) * 0.72, rh = 1.85
          const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), sWall); wall.position.set(bx, yb + h / 2, bz); wall.castShadow = true; town.add(wall); town.add(addOutline(wall))
          for (const a2 of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, h * 0.34, 0.06), toon(isNight ? 0xe8b86a : 0x20242a)); win.position.set(bx + Math.sin(a2) * (w / 2 + 0.04), yb + h * 0.55, bz + Math.cos(a2) * (w / 2 + 0.04)); win.rotation.y = a2; town.add(win) }
          const roof = new THREE.Mesh(new THREE.ConeGeometry(rw, rh, 4), sRoof); roof.rotation.y = Math.PI / 4; roof.position.set(bx, yb + h + rh / 2 - 0.15, bz); roof.castShadow = true; town.add(roof); town.add(addOutline(roof))
          yb += h + rh - 0.9
        }
        for (const sgn of [-1, 1]) { const sh = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.95, 6), toon(0xb89038)); sh.position.set(bx + sgn * 1.1, yb + 0.15, bz); sh.rotation.z = sgn * -0.3; town.add(sh) } // 鯱
        for (const [ox, oz] of [[-7.5, 5.5], [7.0, -5.0]]) { const tx = bx + ox, tz = bz + oz, ty = senH(tx, tz); if (ty < SEA.level) continue; const tur = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.8, 2.3), sWall); tur.position.set(tx, ty + 1.4, tz); tur.castShadow = true; town.add(tur); town.add(addOutline(tur)); const tr = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.3, 4), sRoof); tr.rotation.y = Math.PI / 4; tr.position.set(tx, ty + 3.4, tz); town.add(tr) } // 隅櫓×2
        for (let k = 0; k < 6; k++) { const a = k / 6 * 6.2832, r2 = 9, fx = bx + Math.cos(a) * r2, fz = bz + Math.sin(a) * r2, fy = senH(fx, fz); if (fy < SEA.level) continue; const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.0, 5), toon(0x3a2e20)); pole.position.set(fx, fy + 2.0, fz); town.add(pole); const flag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.9), toon(k % 2 ? 0xa83228 : 0x2a3a6a)); flag.position.set(fx, fy + 3.2, fz + 0.45); town.add(flag) } // 旗指物（平場の縁にぐるり）
        // ── 木柵（平場の縁の乱杭）＋篝火（夜に灯る） ──
        const palMat = toon(0x4a3a28)
        for (let k = 0; k < 26; k++) { const a = k / 26 * 6.2832, px = bx + Math.cos(a) * 9.6, pz = bz + Math.sin(a) * 9.6, py = senH(px, pz); if (py < SEA.level) continue; const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.4, 4), palMat); stake.position.set(px, py + 0.65, pz); town.add(stake) } // 木柵（乱杭）
        const ec = document.createElement('canvas'); ec.width = ec.height = 32; const ecx = ec.getContext('2d'); const eg = ecx.createRadialGradient(16, 16, 1, 16, 16, 16); eg.addColorStop(0, 'rgba(255,184,96,0.95)'); eg.addColorStop(1, 'rgba(255,150,60,0)'); ecx.fillStyle = eg; ecx.fillRect(0, 0, 32, 32); const emberTex = new THREE.CanvasTexture(ec)
        const fireMat = new THREE.MeshBasicMaterial({ color: isNight ? 0xffb24a : 0xe06a2a, fog: true })
        for (let k = 0; k < 3; k++) { const a = k / 3 * 6.2832 + 0.5, r2 = 6.6, fx = bx + Math.cos(a) * r2, fz = bz + Math.sin(a) * r2, fy = senH(fx, fz); if (fy < SEA.level) continue
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.5, 5), toon(0x3a2e20)); post.position.set(fx, fy + 0.75, fz); town.add(post)
          const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.26, 0.34, 8), toon(0x2a2620)); bowl.position.set(fx, fy + 1.55, fz); town.add(bowl)
          const fire = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.8, 6), fireMat); fire.position.set(fx, fy + 2.0, fz); town.add(fire)
          const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: emberTex, color: 0xff8a3a, transparent: true, opacity: isNight ? 0.8 : 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); glow.position.set(fx, fy + 2.0, fz); glow.scale.set(2.6, 2.6, 1); town.add(glow) } // 篝火
        // 城下（山裾に密集する侍屋敷・町家。高さ/大きさ/色を変えて作り分け、メッシュ統合で軽く）
        const samWall = facadeMat('sama', season === 'winter' ? 0xc8c2b6 : 0xab9c84), samWall2 = facadeMat('sama', season === 'winter' ? 0xdcd8ce : 0x8a7a62), samRoof = tileMat(season === 'winter' ? (isNight ? 0x7a828a : 0xa8b0b6) : (isNight ? 0x2e2a24 : 0x46402f), 3, 2, false), samRoof2 = tileMat(isNight ? 0x383229 : 0x5a4e3a, 3, 2, false) // 侍屋敷=連子窓の板壁＋黒瓦の屋根
        const sgWA = [], sgWB = [], sgR = [], sgR2 = [], sgL = [], sgM = new THREE.Matrix4()
        // 城下町＝谷底の川沿いに、街道に沿って不規則な列で家々が並ぶ（的模様の同心円を脱す）。senHに載せ谷底〜中腹のみ。
        for (let s = 0; s < 34; s++) {
          const zz = sz + 30 - s * 2.3, cl = senValley(zz)
          for (const side of [-1, 1]) {
            const ranks = 1 + ((R() * 3) | 0) // 川の両側に1〜3列（不揃い）
            for (let rank = 0; rank < ranks; rank++) {
              if (R() < 0.18) continue // 抜け（空き地・辻）で不規則に
              const off = 5.5 + rank * 4.4 + R() * 1.4
              const px = sx + cl + side * off + (R() - 0.5) * 1.6, pz = zz + (R() - 0.5) * 1.8, py = senH(px, pz)
              if (py < SEA.level + 0.7 || py > 13.5) continue // 谷底〜中腹のみ（高い尾根や城の平場には建てない）
              if (Math.hypot(px - bx, pz - bz) < 11) continue // 城の平場は空ける
              const a = (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (R() - 0.5) * 0.5 // 街道に面して列の向きが揃う
              const tt = R(), two = tt < 0.2, big = tt > 0.86, white = R() < 0.25
              const hw = big ? 3.0 + R() * 1.2 : 2.0 + R() * 1.0, hd = big ? 2.4 + R() * 0.9 : 1.6 + R() * 0.8
              const hh = two ? 2.6 + R() * 0.9 : big ? 2.0 + R() * 0.5 : 1.3 + R() * 0.6
              sgM.makeRotationY(a).setPosition(px, py + hh / 2, pz); const bg = new RoundedBoxGeometry(hw, hh, hd, 1, Math.min(0.16, Math.min(hw, hd) * 0.07)); bakeAO(bg, hh); bg.applyMatrix4(sgM); (white ? sgWB : sgWA).push(bg)
              const rh = two ? 1.3 : 0.85
              sgM.makeRotationY(a).setPosition(px, py + hh + rh / 2 - 0.05, pz); const rg = new THREE.ConeGeometry(Math.max(hw, hd) * 0.66, rh, 4); rg.applyMatrix4(sgM); (R() < 0.4 ? sgR2 : sgR).push(rg) // 切妻も列に揃える
              if (isNight && R() < 0.5) { sgM.makeRotationY(a).setPosition(px - side * hw * 0.45, py + hh * (two ? 0.6 : 0.45), pz); const lg = new THREE.BoxGeometry(0.5, 0.45, 0.12); lg.applyMatrix4(sgM); sgL.push(lg) }
            }
          }
        }
        const sgLit = new THREE.MeshBasicMaterial({ color: 0xf0bd72, fog: true })
        samWall.vertexColors = true; samWall2.vertexColors = true // 壁の接地AO
        for (const [geos, mat] of [[sgWA, samWall], [sgWB, samWall2], [sgR, samRoof], [sgR2, samRoof2], [sgL, sgLit]]) { if (geos.length && BufferGeometryUtils.mergeGeometries) { const m = BufferGeometryUtils.mergeGeometries(geos, false); if (m) { const mesh = new THREE.Mesh(m, mat); mesh.castShadow = mat !== sgLit; mesh.receiveShadow = mat !== sgLit; town.add(mesh) } geos.forEach((g) => g.dispose()) } } // 城下の侍屋敷（夜は灯り窓）
        // ── 街道（谷底の川の東岸に沿う道）＋城の平場へ登る坂道。senHに沿わせ統合で軽量。 ──
        { const mtRoadMat = toon(season === 'winter' ? 0xc2c6c2 : 0x6e6450), roadGeos = [], rM = new THREE.Matrix4(); let prev = null
          for (let s = 0; s <= 40; s++) { const zz = sz + 32 - s * 2.2, cl = senValley(zz), px = sx + cl + 4.8, py = Math.max(SEA.level, senH(px, zz)) + 0.08 // 川の東岸の街道
            if (prev) { const ddx = px - prev.x, ddz = zz - prev.z, len = Math.hypot(ddx, ddz); if (len > 0.3) { const bg = new THREE.BoxGeometry(2.6, 0.16, len + 0.6); rM.makeRotationY(Math.atan2(ddx, ddz)).setPosition((px + prev.x) / 2, (py + prev.py) / 2, (zz + prev.z) / 2); bg.applyMatrix4(rM); roadGeos.push(bg) } }
            prev = { x: px, z: zz, py } }
          prev = null // 街道から城の平場へ登る坂道
          const r0x = sx + senValley(bz + 12) + 4.8, r0z = bz + 12
          for (let s = 0; s <= 14; s++) { const f = s / 14, px = r0x + (bx - r0x) * f, pz = r0z + (bz + 9 - r0z) * f, py = senH(px, pz) + 0.12
            if (prev) { const ddx = px - prev.x, ddz = pz - prev.z, len = Math.hypot(ddx, ddz); if (len > 0.3) { const bg = new THREE.BoxGeometry(2.0, 0.16, len + 0.5); rM.makeRotationY(Math.atan2(ddx, ddz)).setPosition((px + prev.x) / 2, (py + prev.py) / 2, (pz + prev.z) / 2); bg.applyMatrix4(rM); roadGeos.push(bg) } }
            prev = { x: px, z: pz, py } }
          if (roadGeos.length && BufferGeometryUtils.mergeGeometries) { const m = BufferGeometryUtils.mergeGeometries(roadGeos, false); if (m) { const rmesh = new THREE.Mesh(m, mtRoadMat); rmesh.receiveShadow = true; town.add(rmesh) } roadGeos.forEach((g) => g.dispose()) }
        }
        // ── 棚田（西の尾根の谷側斜面に、等高線に沿って段々に連なる水田）。段に高さをスナップして水平な田を連ね、
        //    谷側に石の畦(擁壁)を立てる＝バラけた板でなく「階段状に揃う棚田」。夏春は水鏡、秋は刈田、冬は雪。統合で軽量。 ──
        { const isWaterSeason = season === 'summer' || season === 'spring'
          const padWaterMat = new THREE.MeshBasicMaterial({ map: wtex, color: isNight ? 0x35505e : (season === 'spring' ? 0xa6c4c4 : 0x8ab0b4), fog: true }) // 水鏡（空を映す水田）
          const padGreenMat = toon(season === 'autumn' ? 0xbfa850 : season === 'winter' ? 0xdfe4e6 : 0x6f9450) // 青田/刈田/雪田
          const wallM = toon(season === 'winter' ? 0xc6c8c2 : 0x6f6552)
          const padWG = [], padGG = [], wallG = [], pM = new THREE.Matrix4()
          for (let gz = -18; gz <= 26; gz += 5.0) for (let gx = -54; gx <= -20; gx += 5.8) {
            const px = sx + gx + (R() - 0.5) * 1.0, pz = sz + gz + (R() - 0.5) * 1.0, raw = senH(px, pz)
            if (raw < SEA.level + 1.2 || raw > 20) continue // 斜面の中腹まで段々に（尾根のてっぺんは森のまま）
            const vd = Math.abs((px - sx) - senValley(pz)); if (vd < 8) continue // 谷底の川/町は避ける
            const level = Math.floor(raw / 1.4) * 1.4 + 0.6 // 段に高さをスナップ＝水平な田の面（隣接する同高の田が帯に揃う）
            const water = isWaterSeason && R() < 0.66 // 夏春は水鏡主体（時々青田）
            const pad = new THREE.BoxGeometry(6.2, 0.26, 5.4); pM.makeRotationY((R() - 0.5) * 0.16).setPosition(px, level + 0.13, pz); pad.applyMatrix4(pM); (water ? padWG : padGG).push(pad)
            const wh = Math.max(0.5, raw - level + 1.0); const wl = new THREE.BoxGeometry(6.4, wh, 0.55); pM.makeRotationY((R() - 0.5) * 0.16).setPosition(px + 3.0, level - wh / 2 + 0.26, pz); wl.applyMatrix4(pM); wallG.push(wl) // 谷側(+x)の石の畦
          }
          for (const [geos, mat, sh] of [[padWG, padWaterMat, false], [padGG, padGreenMat, true], [wallG, wallM, true]]) { if (geos.length && BufferGeometryUtils.mergeGeometries) { const m = BufferGeometryUtils.mergeGeometries(geos, false); if (m) { const mesh = new THREE.Mesh(m, mat); mesh.receiveShadow = true; mesh.castShadow = sh; town.add(mesh) } geos.forEach((g) => g.dispose()) } }
        }
        // ── 鳥居の参道（南の河口から谷を遡って城へ向かう朱の鳥居） ──
        { const toriiM = toon(0xb5432f)
          for (let s = 0; s < 5; s++) { const zz = sz + 26 - s * 8, cl = senValley(zz), px = sx + cl + 4.8, py = Math.max(SEA.level, senH(px, zz))
            if (py < SEA.level) continue
            for (const sgn of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 3.0, 6), toriiM); post.position.set(px + sgn * 1.5, py + 1.5, zz); town.add(post) }
            const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.34, 0.3), toriiM); lintel.position.set(px, py + 3.05, zz); town.add(lintel)
            const lintel2 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.22, 0.24), toriiM); lintel2.position.set(px, py + 2.55, zz); town.add(lintel2) }
        }
        // ── 森（尾根筋の杉木立。城を囲む深い緑＝殺風景を脱す）。背の高い杉を尾根に散らす ──
        { const cedarF = season === 'winter' ? 0x6f7a72 : season === 'autumn' ? 0x4d5a3a : 0x35522f, trunkM = toon(0x46382a), folM = toon(cedarF)
          for (let k = 0; k < 54; k++) { const a = R() * 6.2832, rr = 14 + R() * 60, px = sx + Math.cos(a) * rr, pz = sz + Math.sin(a) * rr, py = senH(px, pz)
            if (py < SEA.level + 2.5 || py > 30) continue // 海・谷底の町は避け、斜面〜尾根に森
            if (Math.hypot(px - bx, pz - bz) < 12) continue // 城の平場は空ける
            const vd = Math.abs((px - sx) - senValley(pz)); if (vd < 9 && py < 11) continue // 谷底の町並みは避ける
            const s = 0.85 + R() * 0.5; const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 1.5 * s, 5), trunkM); tr.position.set(px, py + 0.7 * s, pz); town.add(tr)
            const fo = new THREE.Mesh(new THREE.ConeGeometry(1.5 * s, 4.2 * s, 6), folM); fo.position.set(px, py + 3.0 * s, pz); fo.castShadow = true; town.add(fo) } // 杉
        }
        // ── 山寺（西の尾根の中腹に佇む寺＝エリアの新たな見どころ）。山門→石段→本堂(入母屋)＋多宝塔＋鐘楼、杉木立に抱かれる。 ──
        { const tX = sx - 41, tZ = sz - 8, tY = senH(tX, tZ)
          if (tY > SEA.level + 2) {
            const tWall2 = toon(season === 'winter' ? 0xe2ddd0 : 0xd6cbb6), tRoof2 = toon(season === 'winter' ? (isNight ? 0x6e7782 : 0x9aa3ab) : (isNight ? 0x2e3038 : 0x3e4650)), tWood = toon(0x6a4a32)
            // 本堂（入母屋の大屋根）
            const hall = new THREE.Mesh(new RoundedBoxGeometry(8, 3.4, 6, 1, 0.1), tWall2); hall.position.set(tX, tY + 1.7, tZ); hall.castShadow = true; hall.receiveShadow = true; town.add(hall); town.add(addOutline(hall))
            const hroof = new THREE.Mesh(new THREE.ConeGeometry(6.7, 2.4, 4), tRoof2); hroof.rotation.y = Math.PI / 4; hroof.scale.set(1, 1, 0.78); hroof.position.set(tX, tY + 4.6, tZ); hroof.castShadow = true; town.add(hroof); town.add(addOutline(hroof))
            for (const sgn of [-1, 1]) { const chidori = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.4, 3), tWall2); chidori.rotation.set(Math.PI / 2, 0, Math.PI / 2); chidori.position.set(tX, tY + 3.9, tZ + sgn * 2.4); town.add(chidori) } // 千鳥破風
            // 多宝塔（二層の塔＝山寺の象徴）
            { const pX = tX - 8, pZ = tZ + 4, pY = senH(pX, pZ)
              const base = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.6, 3.0), tWall2); base.position.set(pX, pY + 1.3, pZ); base.castShadow = true; town.add(base); town.add(addOutline(base))
              const r1 = new THREE.Mesh(new THREE.ConeGeometry(3.0, 1.2, 4), tRoof2); r1.rotation.y = Math.PI / 4; r1.position.set(pX, pY + 3.1, pZ); town.add(r1); town.add(addOutline(r1))
              const dome = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), tWall2); dome.position.set(pX, pY + 3.5, pZ); town.add(dome)
              const r2 = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.4, 4), tRoof2); r2.rotation.y = Math.PI / 4; r2.position.set(pX, pY + 4.7, pZ); town.add(r2); town.add(addOutline(r2))
              const sorin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), toon(0xc8a23c)); sorin.position.set(pX, pY + 6.1, pZ); town.add(sorin) } // 相輪
            // 鐘楼（袴腰の鐘つき堂）
            { const bX = tX + 7, bZ = tZ + 3, bY = senH(bX, bZ)
              for (const [ox, oz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 2.6, 6), tWood); post.position.set(bX + ox, bY + 1.3, bZ + oz); town.add(post) }
              const broof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.5, 4), tRoof2); broof.rotation.y = Math.PI / 4; broof.position.set(bX, bY + 3.3, bZ); broof.castShadow = true; town.add(broof); town.add(addOutline(broof))
              const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.2, 8), toon(0x6a6258)); bell.position.set(bX, bY + 1.9, bZ); town.add(bell) }
            // 山門（参道の入口の門）＋石段（谷へ下る）
            { const gX = tX + 2, gZ = tZ + 11, gY = senH(gX, gZ)
              for (const sgn of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.2, 6), tWood); post.position.set(gX + sgn * 1.8, gY + 1.6, gZ); town.add(post); town.add(addOutline(post)) }
              const gmon = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.6, 4), tRoof2); gmon.rotation.y = Math.PI / 4; gmon.scale.set(1, 1, 0.6); gmon.position.set(gX, gY + 3.7, gZ); gmon.castShadow = true; town.add(gmon); town.add(addOutline(gmon)) }
            { const stoneM = toon(season === 'winter' ? 0xc4c8c2 : 0x9a948a); let prev = null // 山門→谷の街道へ下る石段
              const s0x = tX + 2, s0z = tZ + 12 // 山門の下から
              for (let s = 0; s <= 18; s++) { const f = s / 18, pz = s0z + 20 * f, tgX = sx + senValley(pz) + 6, px = s0x + (tgX - s0x) * f, py = senH(px, pz) + 0.1
                if (prev) { const ddx = px - prev.x, ddz = pz - prev.z, len = Math.hypot(ddx, ddz); if (len > 0.3) { const step = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, len + 0.5), stoneM); step.position.set((px + prev.x) / 2, (py + prev.y) / 2, (pz + prev.z) / 2); step.rotation.y = Math.atan2(ddx, ddz); town.add(step) } }
                prev = { x: px, y: py, z: pz } } }
            // 杉に囲む（寺の周りに濃い杉木立）
            { const folM2 = toon(season === 'winter' ? 0x6f7a72 : 0x33502d), trunkM2 = toon(0x46382a)
              for (let k = 0; k < 12; k++) { const a = k / 12 * 6.2832, rr = 9 + R() * 4, px = tX + Math.cos(a) * rr, pz = tZ + Math.sin(a) * rr, py = senH(px, pz); if (py < SEA.level + 1) continue; const s = 1.0 + R() * 0.4; const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 1.5 * s, 5), trunkM2); tr.position.set(px, py + 0.7 * s, pz); town.add(tr); const fo = new THREE.Mesh(new THREE.ConeGeometry(1.4 * s, 4.0 * s, 6), folM2); fo.position.set(px, py + 2.9 * s, pz); fo.castShadow = true; town.add(fo) } }
          }
        }
        // ── 谷の霧（低くたなびく霞の帯＝「霧の谷あい」のエモさ）。柔らかな billboard を谷底に数枚。 ──
        { const mc = document.createElement('canvas'); mc.width = mc.height = 64; const mx = mc.getContext('2d'); const mg2 = mx.createRadialGradient(32, 32, 2, 32, 32, 32); mg2.addColorStop(0, 'rgba(255,255,255,0.55)'); mg2.addColorStop(0.6, 'rgba(248,250,252,0.28)'); mg2.addColorStop(1, 'rgba(248,250,252,0)'); mx.fillStyle = mg2; mx.fillRect(0, 0, 64, 64); const mistTex = new THREE.CanvasTexture(mc)
          const mistCol = isNight ? 0x9aa4b2 : season === 'autumn' ? 0xe6dccb : 0xeef2f4
          for (let s = 0; s < 9; s++) { const zz = sz + 24 - s * 6.5, cl = senValley(zz), px = sx + cl + (R() - 0.5) * 16, py = Math.max(SEA.level + 1, senH(px, zz)) + 2.4 + R() * 2
            const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: mistCol, transparent: true, opacity: 0.32 + R() * 0.16, depthWrite: false, fog: true })); m.position.set(px, py, zz); m.scale.set(26 + R() * 12, 9 + R() * 4, 1); town.add(m); senMist.push(m) } // ゆっくり漂わせる
        }
        { const sgKim = [0x6a5a3e, 0x4a4038, 0x7a4030, 0x40506a, 0x55603a, 0x5a5a5e] // 戦国の城下の人々（陣笠・素朴な色）
          for (let k = 0; k < 20; k++) { const zz = sz + 26 - R() * 52, cl = senValley(zz), px = sx + cl + (R() - 0.5) * 18, pz = zz + (R() - 0.5) * 3, py = senH(px, pz); if (py < SEA.level + 0.8 || py > 13) continue; const g = new THREE.Group(); g.position.set(px, py, pz); g.rotation.y = R() * 6.28; const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.26, 0.74, 6), toon(sgKim[k % sgKim.length])); body.position.y = 0.38; body.castShadow = true; g.add(body); const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 7, 6), toon(0xddbfa0)); head.position.y = 0.9; g.add(head); town.add(g) }
          for (let j = 0; j < 10; j++) { const z0 = sz + 20 - j * 4.4, cl = senValley(z0), wg = new THREE.Group(); const wb = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.26, 0.74, 6), toon(sgKim[j % sgKim.length])); wb.position.y = 0.38; wb.castShadow = true; wg.add(wb); const wh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 7, 6), toon(0xddbfa0)); wh.position.y = 0.9; wg.add(wh); wg.position.set(sx + cl + 4.8, Math.max(SEA.level, senH(sx + cl + 4.8, z0)), z0); town.add(wg); cityWalkers.push({ g: wg, road: true, x0: sx + cl + 4.8, z0, len: 8 + R() * 6, sp: 0.05 + R() * 0.04, ph: R() * 2, fn: (u) => { const zz = z0 - u; const c2 = senValley(zz); const xx = sx + c2 + 4.8; return { x: xx, y: Math.max(SEA.level, senH(xx, zz)), z: zz } } }) } // 街道を行き交う旅人（初期位置を置く＝遠方時に原点へ取り残されない）
          const sgmei = ['酒', '鍛冶', '旅籠', '飯', '馬', '薬'] // 城下の店（質素な木の掛看板）
          for (let k = 0; k < 6; k++) { const zz = sz + 20 - k * 6, cl = senValley(zz), side = k % 2 ? 1 : -1, px = sx + cl + side * 6.5, pz = zz + (R() - 0.5) * 2, py = senH(px, pz); if (py < SEA.level + 1 || py > 12) continue; mkSignV(px, py + 1.1, pz, side > 0 ? -Math.PI / 2 : Math.PI / 2, sgmei[k], 0xcfc3a8, 0x2e2418) } } // 城下の店の看板
        { const folC = season === 'spring' ? 0xeeb6cc : season === 'autumn' ? 0xcf7034 : season === 'winter' ? 0xdfe4e7 : 0x5c7e48
          for (let k = 0; k < 9; k++) { const zz = sz + 20 - R() * 40, cl = senValley(zz), px = sx + cl + (R() - 0.5) * 22, pz = zz + (R() - 0.5) * 4, py = senH(px, pz); if (py < SEA.level + 1 || py > 12) continue; const s = 0.8 + R() * 0.3; const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.22 * s, 1.4 * s, 5), toon(0x6a4f38)); tr.position.set(px, py + 0.7 * s, pz); town.add(tr); const fo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 * s, 0), toon(folC)); fo.position.set(px, py + 1.9 * s, pz); fo.castShadow = true; town.add(fo) } } // 四季の木立（桜/紅葉/雪/緑）
      }
      // ── 西の海の向こうの大正の港町（赤レンガ倉庫・時計塔・看板建築・桟橋・蒸気船・ガス灯）。海を渡るとやがて霞から現れる ──
      {
        const tx = TAISHO.x, tz = TAISHO.z, gy = heightAt(tx, tz)
        { const isz = TAISHO.r * 2 + 6, gI = new THREE.PlaneGeometry(isz, isz, 66, 66); gI.rotateX(-Math.PI / 2); const pos = gI.attributes.position
          for (let i = 0; i < pos.count; i++) { const lx = pos.getX(i), lz = pos.getZ(i); pos.setY(i, heightAt(tx + lx, tz + lz) - gy) }
          gI.computeVertexNormals(); const gmesh = new THREE.Mesh(gI, mottleMat(season === 'winter' ? 0xc9c8c2 : 0x9c948a, 220, 0.16, [7, 7])); gmesh.position.set(tx, gy, tz); gmesh.receiveShadow = true; town.add(gmesh) } // 港町の島の地面（石畳/土）
        // ── 運河（港から内陸へ引かれた石積みの水路＋石橋）＝大正の港町の水辺 ──
        { const cz0 = tz + 17, cwmat = new THREE.MeshBasicMaterial({ map: seaTex || wtex, color: isNight ? 0x4a5862 : 0x86a6b6, fog: true }), stone = mottleMat(0x9a948a, 150, 0.12, [2, 1])
          for (let cx0 = -TAISHO.r + 8; cx0 <= 28; cx0 += 5) { const px = tx + cx0, cy = heightAt(px, cz0)
            const w = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4.2), cwmat); w.rotation.x = -Math.PI / 2; w.position.set(px, cy + 0.28, cz0); town.add(w) // 水面
            for (const side of [-1, 1]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.2, 0.7), stone); wall.position.set(px, cy + 1.0, cz0 + 2.6 * side); wall.castShadow = true; town.add(wall) } } // 石積みの護岸
          { const bx = tx + 4, bbank = heightAt(bx, cz0 + 4.5); const br = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 7.0), stone); br.position.set(bx, bbank + 0.5, cz0); br.castShadow = true; town.add(br); town.add(addOutline(br))
            for (const rl of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 7.0), toon(0x6a6258)); rail.position.set(bx + 1.2 * rl, bbank + 1.0, cz0); town.add(rail) } } // 石橋＋欄干
        }
        const brick = mottleMat(season === 'winter' ? 0x8a5648 : 0x9a4f3e, 180, 0.16, [2.6, 1.4]) // 赤煉瓦の濃淡
        const slate = mottleMat(isNight ? 0x3a3e44 : 0x586068, 160, 0.12, [2.2, 2.2]) // スレート屋根
        // 赤レンガ倉庫（港の象徴。海側に長い煉瓦倉庫が並ぶ。拡大した波止場に沿って増設）
        for (let i = 0; i < 7; i++) { const wx = tx - 58 + i * 6.0, wz = tz - 30 + (i % 2) * 3, wy = heightAt(wx, wz); if (wy < SEA.level + 1) continue
          const ww = 4.8, wd = 12, wh = 5.2 + (i % 2) * 1.0
          const body = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, wd), brick); body.position.set(wx, wy + wh / 2, wz); body.castShadow = true; body.receiveShadow = true; town.add(body); town.add(addOutline(body))
          const roof = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.5, 0.5, wd + 0.5), slate); roof.position.set(wx, wy + wh + 0.25, wz); town.add(roof)
          for (let w = 0; w < 4; w++) { const win = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.62), isNight ? new THREE.MeshBasicMaterial({ color: 0xffdca0, fog: true }) : toon(0xe8e2d4)); win.position.set(wx - ww / 2 - 0.04, wy + 1.7, wz - wd / 2 + 1.8 + w * 2.7); town.add(win) } }
        // 時計塔（港町のランドマーク。赤煉瓦＋白い時計＋緑青の尖塔）
        { const cx2 = tx + 6, cz2 = tz - 4, cy = heightAt(cx2, cz2)
          if (cy > SEA.level + 1) { const tower = new THREE.Mesh(new THREE.BoxGeometry(4.2, 16, 4.2), brick); tower.position.set(cx2, cy + 8, cz2); tower.castShadow = true; town.add(tower); town.add(addOutline(tower))
            const band = new THREE.Mesh(new THREE.BoxGeometry(4.7, 1.1, 4.7), toon(0xe6ddc8)); band.position.set(cx2, cy + 14.4, cz2); town.add(band)
            for (const [fx2, fz2] of [[2.36, 0], [-2.36, 0], [0, 2.36], [0, -2.36]]) { const face = new THREE.Mesh(new THREE.CircleGeometry(0.72, 16), isNight ? new THREE.MeshBasicMaterial({ color: 0xfff2cc, fog: true }) : toon(0xf4efe2)); face.position.set(cx2 + fx2, cy + 14.4, cz2 + fz2); face.lookAt(cx2 + fx2 * 2, cy + 14.4, cz2 + fz2 * 2); town.add(face) }
            const spire = new THREE.Mesh(new THREE.ConeGeometry(2.7, 4.2, 6), toon(0x6fae9c)); spire.position.set(cx2, cy + 17.2, cz2); spire.castShadow = true; town.add(spire); town.add(addOutline(spire))
            const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), toon(0xc8a23c)); fin.position.set(cx2, cy + 19.8, cz2); town.add(fin) } } // 時計塔
        // 港町の家々（看板建築＝和洋折衷。煉瓦/クリームの壁＋陸屋根/寄棟。格子の町割り。メッシュ統合で軽く）
        // 壁色のパレット（大正ハイカラ＝クリーム/淡い若草/淡い黄土/淡い青鼠）。建物ごとに振り分けて単調なクリーム一色を脱す。
        const tWallPal = season === 'winter' ? [0xd8d2c4, 0xd2d6cc, 0xdcd4c0, 0xcdd2d4] : [0xcfc3ab, 0xb9c0a6, 0xd6c49a, 0xb7c1c4]
        const tWallMats = tWallPal.map((c) => { const m = facadeMat('yofu', c); m.vertexColors = true; return m }) // 接地AO（頂点色）を効かせる
        // 屋根色のパレット（瓦の赤茶/いぶし茶/スレート青鼠）。俯瞰で一色だった屋根に多様さを。
        const tRoofPal = isNight ? [0x4a3832, 0x423a32, 0x3e444a] : [0x9a5642, 0x6e5a48, 0x5d666e]
        const tRoofMats = tRoofPal.map((c) => mottleMat(c, 150, 0.12, [1.8, 1.8]))
        const taiFac = [{ x: tx + 33, z: tz - 42, r: 14 }, { x: tx + 42, z: tz + 46, r: 13 }] // 公園/学校の区画（建物を空ける）
        const twBuckets = tWallPal.map(() => []), trBuckets = tRoofPal.map(() => []), twC = [], tlit = [], plT = [], tmM = new THREE.Matrix4()
        // 港町の町並み＝完全な碁盤の目の均一さを脱す: 主要街路は残しつつ、街区内は密に詰め、
        // 中心(時計塔)ほど高い看板建築、外周は低い住宅、合間に長屋（横長の連棟）を混ぜ、高さ・大きさ・向きを散らす。
        for (let gx = -94; gx <= 94; gx += 3.7) for (let gz = -78; gz <= 84; gz += 3.7) {
          const onAveX = ((gx + 760) % 19) < 3.7, onAveZ = ((gz + 760) % 19) < 3.7 // 主要街路（約19間隔）だけ道に空ける
          if (onAveX && onAveZ) continue
          const hx = tx + gx + (R() - 0.5) * 1.5, hz = tz + gz + (R() - 0.5) * 1.5, hy = heightAt(hx, hz)
          if (hy < SEA.level + 1.2 || Math.hypot(hx - (tx + 6), hz - (tz - 4)) < 5 || taishoCanal(hx, hz) < 5.0 || taiFac.some((f) => Math.hypot(hx - f.x, hz - f.z) < f.r)) continue // 海/時計塔/運河/公園・学校は空ける
          if ((onAveX || onAveZ) ? R() < 0.5 : R() < 0.12) continue // 街路沿いは間引き、街区内は密に
          const dc = Math.hypot(gx - 6, gz + 4), central = Math.max(0, 1 - dc / 42) // 時計塔＝商業中心からの近さ
          const tt = R(), tall = tt < 0.1 + central * 0.24, longya = !tall && tt > 0.62 && tt < 0.8, isBrick = R() < 0.26 + central * 0.12
          let hw, hd, hh, ang = R() < 0.5 ? 0 : Math.PI / 2
          if (longya) { hw = 2.2 + R() * 0.7; hd = 5.2 + R() * 3.0; hh = 1.9 + R() * 0.4 } // 長屋（横長の連棟）
          else if (tall) { hw = 2.5 + R() * 0.9; hd = 2.5 + R() * 0.9; hh = 4.4 + central * 2.6 + R() * 1.6 } // 看板建築（中心ほど高い）
          else { hw = 2.1 + R() * 1.3; hd = 2.1 + R() * 1.3; hh = 2.2 + central * 1.3 + R() * 1.7 } // 住宅
          tmM.makeRotationY(ang).setPosition(hx, hy + hh / 2, hz); const bg = new RoundedBoxGeometry(hw, hh, hd, 1, Math.min(0.16, Math.min(hw, hd) * 0.07)); if (!isBrick) bakeAO(bg, hh); bg.applyMatrix4(tmM); if (isBrick) twC.push(bg); else twBuckets[(R() * twBuckets.length) | 0].push(bg) // 壁色を振り分け（単調なクリーム一色を脱す）
          const plg = new THREE.BoxGeometry(hw + 0.5, 0.55, hd + 0.5); tmM.makeRotationY(ang).setPosition(hx, hy + 0.18, hz); plg.applyMatrix4(tmM); plT.push(plg) // 石の土台（接地）
          const ri = (R() * trBuckets.length) | 0 // 屋根色を振り分け
          if (tall || R() < 0.42) { const rg = new THREE.BoxGeometry(hw + 0.3, 0.4, hd + 0.3); tmM.makeRotationY(ang).setPosition(hx, hy + hh + 0.2, hz); rg.applyMatrix4(tmM); trBuckets[ri].push(rg) } // 陸屋根(洋風・看板建築)
          else { tmM.makeRotationY(ang + Math.PI / 4).setPosition(hx, hy + hh + 0.5, hz); const rg = new THREE.ConeGeometry(Math.max(hw, hd) * 0.7, 1.4, 4); rg.applyMatrix4(tmM); trBuckets[ri].push(rg) } // 寄棟
          if (isNight && R() < 0.5) { const lg = new THREE.BoxGeometry(0.12, 0.6, 0.6); tmM.makeTranslation(hx + hw / 2 + 0.02, hy + hh * 0.5, hz); lg.applyMatrix4(tmM); tlit.push(lg) }
        }
        const tlitMat = new THREE.MeshBasicMaterial({ color: 0xffd99a, fog: true })
        const plinthMatT = mottleMat(season === 'winter' ? 0xbcc0c2 : 0x908a80, 120, 0.12, [2, 1]) // 港町の石畳の土台
        const tMerge = [...twBuckets.map((g, i) => [g, tWallMats[i]]), ...trBuckets.map((g, i) => [g, tRoofMats[i]]), [twC, brick], [plT, plinthMatT], [tlit, tlitMat]]
        for (const [geos, mat] of tMerge) { if (geos.length && BufferGeometryUtils.mergeGeometries) { const m = BufferGeometryUtils.mergeGeometries(geos, false); if (m) { const mesh = new THREE.Mesh(m, mat); mesh.castShadow = mat !== tlitMat; mesh.receiveShadow = mat !== tlitMat; town.add(mesh) } geos.forEach((g) => g.dispose()) } }
        // ── 港町の街路（碁盤の目の道＝区画整理された大正の町。石畳の道）。地形に沿わせ統合で軽量。 ──
        { const paveMat = mottleMat(season === 'winter' ? 0xc4c8c6 : 0x8e8a84, 100, 0.1, [3, 1]), roadGeos = [], rM = new THREE.Matrix4()
          const seg = (x0, z0, x1, z1, w) => { const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz); if (len < 0.5) return; const px = (x0 + x1) / 2, pz = (z0 + z1) / 2, py = heightAt(px, pz); if (py < SEA.level + 0.6 || taishoCanal(px, pz) < 4) return; const bg = new THREE.BoxGeometry(w, 0.16, len + 0.9); rM.makeRotationY(Math.atan2(dx, dz)).setPosition(px, py + 0.09, pz); bg.applyMatrix4(rM); roadGeos.push(bg) }
          const road = (x0, z0, x1, z1, w) => { const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 5)); for (let s = 0; s < steps; s++) seg(x0 + (x1 - x0) * s / steps, z0 + (z1 - z0) * s / steps, x0 + (x1 - x0) * (s + 1) / steps, z0 + (z1 - z0) * (s + 1) / steps, w) }
          for (let n = -5; n <= 5; n++) { const gx = n * 19; if (Math.abs(gx) > TAISHO.r - 6) continue; road(tx + gx, tz - 84, tx + gx, tz + 90, 4.2) } // 縦の通り（建物の空けと一致）
          for (let mm = -4; mm <= 5; mm++) { const gz = mm * 19; if (Math.abs(gz) > TAISHO.r - 6) continue; road(tx - 96, tz + gz, tx + 96, tz + gz, 4.2) } // 横の通り
          if (roadGeos.length && BufferGeometryUtils.mergeGeometries) { const m = BufferGeometryUtils.mergeGeometries(roadGeos, false); if (m) { const rmesh = new THREE.Mesh(m, paveMat); rmesh.receiveShadow = true; town.add(rmesh) } roadGeos.forEach((g) => g.dispose()) }
        }
        // 桟橋（海へ突き出す木の桟橋）
        for (const po of [-34, -18]) { const px0 = tx - 46, pz0 = tz + po
          const deck = new THREE.Mesh(new THREE.BoxGeometry(20, 0.4, 2.4), toon(0x6e5640)); deck.position.set(px0 - 6, SEA.level + 0.7, pz0); deck.castShadow = true; town.add(deck)
          for (let p = 0; p < 5; p++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.4, 5), toon(0x4a3a28)); leg.position.set(px0 - 14 + p * 4, SEA.level - 0.3, pz0 + (p % 2 ? 1 : -1)); town.add(leg) } }
        // 蒸気船（黒い船体＋煙突＝大正の港。波にゆれる）
        { const ship = new THREE.Group(); ship.position.set(tx - 70, SEA.level + 0.2, tz - 24); ship.rotation.y = 0.3; ship.userData = { ph: R() * 6.28 }
          const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 1.6, 2.8), toon(0x3a3a40)); hull.position.y = 0.4; ship.add(hull); const dk = new THREE.Mesh(new THREE.BoxGeometry(5, 1.0, 2.2), toon(0xc8b89a)); dk.position.set(-0.5, 1.4, 0); ship.add(dk)
          const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 2.6, 10), toon(0x9a4030)); funnel.position.set(-0.5, 3.0, 0); ship.add(funnel); town.add(ship); boats.push(ship) }
        // ── 公園（噴水＋ベンチ＋並木）＝大正のハイカラな憩いの場 ──
        { const px0 = tx + 33, pz0 = tz - 42, py0 = heightAt(px0, pz0)
          if (py0 > SEA.level + 1) {
            const plaza = new THREE.Mesh(new THREE.CircleGeometry(13, 26), mottleMat(season === 'winter' ? 0xc4c8c6 : 0x9a948a, 90, 0.1, [4, 4])); plaza.rotation.x = -Math.PI / 2; plaza.position.set(px0, py0 + 0.06, pz0); plaza.receiveShadow = true; town.add(plaza) // 石畳の広場
            const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.7, 16), toon(0xb8b2a4)); basin.position.set(px0, py0 + 0.35, pz0); town.add(basin); town.add(addOutline(basin))
            const water = new THREE.Mesh(new THREE.CircleGeometry(2.9, 16), new THREE.MeshBasicMaterial({ map: wtex, color: isNight ? 0x4a5862 : 0x9fc0d0, fog: true })); water.rotation.x = -Math.PI / 2; water.position.set(px0, py0 + 0.72, pz0); town.add(water)
            const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 2.0, 8), new THREE.MeshBasicMaterial({ color: 0xddeef4, transparent: true, opacity: 0.6, fog: true })); jet.position.set(px0, py0 + 1.7, pz0); town.add(jet) // 噴水
            for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28, bx = px0 + Math.cos(a) * 8, bz = pz0 + Math.sin(a) * 8, by = heightAt(bx, bz); const bench = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.7), toon(0x6a5a44)); bench.position.set(bx, by + 0.35, bz); bench.rotation.y = a; town.add(bench) } // ベンチ
            for (let k = 0; k < 8; k++) { const a = R() * 6.28, rr = 10 + R() * 3.5, bx = px0 + Math.cos(a) * rr, bz = pz0 + Math.sin(a) * rr, by = heightAt(bx, bz); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.8, 6), toon(0x6a4f38)); tr.position.set(bx, by + 0.9, bz); town.add(tr); const fo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), toon(season === 'autumn' ? 0xc88a3c : season === 'winter' ? 0xd2dad6 : 0x5e7e48)); fo.position.set(bx, by + 2.4, bz); fo.castShadow = true; town.add(fo) } } } // 並木
        // ── 学校（洋風校舎＋校庭）＝大正の学び舎 ──
        { const sx0 = tx + 42, sz0 = tz + 46, sy0 = heightAt(sx0, sz0)
          if (sy0 > SEA.level + 1) {
            const sch = new THREE.Mesh(new RoundedBoxGeometry(14, 4.6, 6, 1, 0.12), facadeMat('yofu', season === 'winter' ? 0xd6cdb8 : 0xc8bb9e)); sch.position.set(sx0, sy0 + 2.3, sz0); sch.castShadow = true; sch.receiveShadow = true; town.add(sch); town.add(addOutline(sch))
            const sroof = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.5, 6.5), tileMat(isNight ? 0x3a3030 : 0x5a4038, 3, 1, false)); sroof.position.set(sx0, sy0 + 4.85, sz0); town.add(sroof)
            const clock = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.0, 0.4), facadeMat('yofu', 0xd0c4a8)); clock.position.set(sx0, sy0 + 5.5, sz0 - 1); town.add(clock); const cf = new THREE.Mesh(new THREE.CircleGeometry(0.6, 14), toon(0xf4efe2)); cf.position.set(sx0, sy0 + 6.2, sz0 - 1.22); town.add(cf) // 時計のある中央棟
            const yard = new THREE.Mesh(new THREE.CircleGeometry(7, 20), mottleMat(season === 'winter' ? 0xc8ccc6 : 0xa8987c, 90, 0.1, [4, 4])); yard.rotation.x = -Math.PI / 2; yard.position.set(sx0, sy0 + 0.06, sz0 + 11); yard.receiveShadow = true; town.add(yard) } } // 校庭
        // ガス灯（暖色の街灯。夜は灯る）＋人々＋並木
        { const tgc = document.createElement('canvas'); tgc.width = tgc.height = 32; const tgx = tgc.getContext('2d'); const tgg = tgx.createRadialGradient(16, 16, 1, 16, 16, 16); tgg.addColorStop(0, 'rgba(255,200,140,0.95)'); tgg.addColorStop(1, 'rgba(255,180,120,0)'); tgx.fillStyle = tgg; tgx.fillRect(0, 0, 32, 32); const tGlow = new THREE.CanvasTexture(tgc)
          for (let k = 0; k < 10; k++) { const a = R() * 6.28, r2 = 14 + R() * 40, lx = tx + Math.cos(a) * r2, lz = tz + Math.sin(a) * r2, ly = heightAt(lx, lz); if (ly < SEA.level + 1.2) continue
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.0, 6), toon(0x3a3e42)); pole.position.set(lx, ly + 1.5, lz); town.add(pole)
            const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), isNight ? new THREE.MeshBasicMaterial({ color: 0xffd28a, fog: true }) : toon(0xf0e4c8)); lamp.position.set(lx, ly + 3.1, lz); town.add(lamp)
            if (isNight) { const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: tGlow, color: 0xffcf8a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); gl.position.set(lx, ly + 3.1, lz); gl.scale.set(2.4, 2.4, 1); town.add(gl) } }
          const tKim = [0x8a3a32, 0x3a4a6a, 0x556040, 0x7a5a34, 0x6a4a5a, 0x40443a] // 大正の人々（着物＋洋装の中間色）
          for (let k = 0; k < 20; k++) { const a = R() * 6.28, r2 = 12 + R() * 44, px = tx + Math.cos(a) * r2, pz = tz + Math.sin(a) * r2, py = heightAt(px, pz); if (py < SEA.level + 1.2) continue; const g = new THREE.Group(); g.position.set(px, py, pz); g.rotation.y = R() * 6.28; const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, 0.78, 6), toon(tKim[k % tKim.length])); body.position.y = 0.4; body.castShadow = true; g.add(body); const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 7, 6), toon(0xe6c6a4)); head.position.y = 0.95; g.add(head); town.add(g) }
          // 大正の店の看板（横書きのホーロー/洋風看板。和洋折衷の店名）
          const tenmei = [['カフエー', 0x9a3a34], ['珈琲', 0x4a3a2a], ['寫眞館', 0x3a4a5a], ['洋食', 0xb24a3a], ['郵便局', 0xc04030], ['銀行', 0x4a5a4a], ['時計店', 0x3a4a44], ['理髪', 0x3a5a6a], ['書肆', 0x6a4a3a], ['牛乳', 0xcfc4aa], ['商會', 0x7a5a3a]]
          for (let k = 0; k < 11; k++) { const a = (k / 11) * 6.28 + 0.2, r2 = 12 + R() * 30, px = tx + Math.cos(a) * r2, pz = tz + Math.sin(a) * r2, py = heightAt(px, pz); if (py < SEA.level + 1.4 || Math.hypot(px - (tx + 6), pz - (tz - 4)) < 6) continue
            const [nm, bg] = tenmei[k % tenmei.length]; mkSignH(px, py + 3.0, pz, a + Math.PI / 2 + (R() - 0.5) * 0.4, nm, bg, 0xf2ece0) } // 大正の店の看板
          const tfolC = season === 'spring' ? 0x88aa55 : season === 'autumn' ? 0xc88a3c : season === 'winter' ? 0xd2dad6 : 0x5e7e48
          const tTrunkG = [], tLeafG = [], tmM4 = new THREE.Matrix4() // 木立を統合＝拡大した島の全域に緑を行き渡らせつつ描画コール据え置き
          for (let k = 0; k < 58; k++) { const a = R() * 6.28, r2 = 12 + R() * 94, px = tx + Math.cos(a) * r2, pz = tz + Math.sin(a) * r2, py = heightAt(px, pz); if (py < SEA.level + 1.5 || taishoCanal(px, pz) < 4) continue; const s = 0.7 + R() * 0.5
            const trG = new THREE.CylinderGeometry(0.12 * s, 0.2 * s, 1.4 * s, 6); tmM4.makeTranslation(px, py + 0.7 * s, pz); trG.applyMatrix4(tmM4); tTrunkG.push(trG)
            const fG = new THREE.IcosahedronGeometry(1.3 * s, 0); tmM4.makeTranslation(px, py + 1.9 * s, pz); fG.applyMatrix4(tmM4); tLeafG.push(fG) }
          for (const [geos, mat] of [[tTrunkG, toon(0x6a4f38)], [tLeafG, toon(tfolC)]]) { if (geos.length && BufferGeometryUtils.mergeGeometries) { const m = BufferGeometryUtils.mergeGeometries(geos, false); if (m) { const mesh = new THREE.Mesh(m, mat); mesh.castShadow = true; mesh.receiveShadow = true; town.add(mesh) } geos.forEach((g) => g.dispose()) } } } // 街のあちこちに木立（密度UP・統合）
        // 港を見下ろす高台の洋館（大正の見どころ。クリームの壁＋マンサード屋根＋並木）
        { const mx0 = tx - 44, mz0 = tz + 42, my0 = heightAt(mx0, mz0)
          const body = new THREE.Mesh(new RoundedBoxGeometry(9, 5.0, 7, 1, 0.12), facadeMat('yofu', 0xe6ddc8)); body.position.set(mx0, my0 + 2.5, mz0); body.castShadow = true; body.receiveShadow = true; town.add(body); town.add(addOutline(body))
          const mans = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 6.4, 2.6, 4), tileMat(isNight ? 0x3a3030 : 0x5a4038, 2, 2, false)); mans.rotation.y = Math.PI / 4; mans.position.set(mx0, my0 + 6.3, mz0); mans.castShadow = true; town.add(mans); town.add(addOutline(mans)) // マンサード屋根
          const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.0, 6), toon(0x6fae9c)); spire.position.set(mx0, my0 + 8.4, mz0); town.add(spire)
          for (let k = 0; k < 8; k++) { const a = R() * 6.28, rr = 8 + R() * 8, px = mx0 + Math.cos(a) * rr, pz = mz0 + Math.sin(a) * rr, py = heightAt(px, pz); if (py < my0 - 4) continue; const s = 1.0 + R() * 0.4
            const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 1.8 * s, 6), toon(0x6a4f38)); tr.position.set(px, py + 0.9 * s, pz); town.add(tr); const fo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 * s, 0), toon(season === 'autumn' ? 0xc88a3c : season === 'winter' ? 0xd2dad6 : 0x5e7e48)); fo.position.set(px, py + 2.4 * s, pz); fo.castShadow = true; town.add(fo) } } // 高台の並木
        // ── 異人館街（東の高台＝拡大した新地区）。色とりどりの洋館＋教会。海を見下ろす丘の上のハイカラな一画 ──
        { const ijx = tx + 52, ijz = tz - 44 // 異人館の丘の中心
          const ijCols = [0xb86a52, 0xd8c49a, 0x9aafa0, 0xc8b8c4, 0xb8c2cc] // 異人館の壁色（くすんだ赤煉瓦/クリーム/淡緑/淡紫/淡青）
          for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.2832 + 0.4, rr = 7 + (k % 2) * 6, hx = ijx + Math.cos(a) * rr, hz = ijz + Math.sin(a) * rr, hy = heightAt(hx, hz); if (hy < SEA.level + 2) continue
            const hw = 4.0 + R() * 1.6, hh = 4.0 + R() * 1.6, body = new THREE.Mesh(new RoundedBoxGeometry(hw, hh, hw * 0.9, 1, 0.12), facadeMat('yofu', ijCols[k % ijCols.length])); body.position.set(hx, hy + hh / 2, hz); body.rotation.y = a; body.castShadow = true; body.receiveShadow = true; town.add(body); town.add(addOutline(body))
            const mans = new THREE.Mesh(new THREE.CylinderGeometry(hw * 0.4, hw * 0.74, 1.8, 4), tileMat(isNight ? 0x3a3030 : 0x5a4038, 2, 2, false)); mans.rotation.y = a + Math.PI / 4; mans.position.set(hx, hy + hh + 0.7, hz); mans.castShadow = true; town.add(mans); town.add(addOutline(mans)) // マンサード屋根
            if (isNight) { const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.06), new THREE.MeshBasicMaterial({ color: 0xffd99a, fog: true })); win.position.set(hx + Math.cos(a) * (hw / 2 + 0.04), hy + hh * 0.5, hz + Math.sin(a) * (hw / 2 + 0.04)); win.rotation.y = a; town.add(win) } }
          { const cx2 = ijx - 2, cz2 = ijz + 8, cy = heightAt(cx2, cz2) // 教会（尖塔＋十字）
            if (cy > SEA.level + 2) { const nave = new THREE.Mesh(new RoundedBoxGeometry(5, 4.6, 8, 1, 0.1), facadeMat('yofu', season === 'winter' ? 0xdcd6c8 : 0xcfc7b4)); nave.position.set(cx2, cy + 2.3, cz2); nave.castShadow = true; nave.receiveShadow = true; town.add(nave); town.add(addOutline(nave))
              const nroof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.0, 4), tileMat(isNight ? 0x33363c : 0x4a525a, 2, 2, false)); nroof.rotation.y = Math.PI / 4; nroof.scale.set(1, 1, 1.5); nroof.position.set(cx2, cy + 5.6, cz2); town.add(nroof); town.add(addOutline(nroof))
              const tower = new THREE.Mesh(new THREE.BoxGeometry(2.4, 9, 2.4), facadeMat('yofu', season === 'winter' ? 0xdcd6c8 : 0xcfc7b4)); tower.position.set(cx2, cy + 4.5, cz2 - 4.5); tower.castShadow = true; town.add(tower); town.add(addOutline(tower))
              const spire = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.4, 4), toon(0x6fae9c)); spire.rotation.y = Math.PI / 4; spire.position.set(cx2, cy + 10.7, cz2 - 4.5); spire.castShadow = true; town.add(spire); town.add(addOutline(spire))
              const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), toon(0xc8a23c)); crossV.position.set(cx2, cy + 13.0, cz2 - 4.5); town.add(crossV); const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.12), toon(0xc8a23c)); crossH.position.set(cx2, cy + 13.2, cz2 - 4.5); town.add(crossH) } }
        }
        // ── 大正の駅舎（赤煉瓦の停車場＋緑青ドーム）＋プラットホーム。路面電車の起点 ──
        { const stx = tx - 4, stz = tz + 30, sty = heightAt(stx, stz)
          if (sty > SEA.level + 1) { const depot = new THREE.Mesh(new RoundedBoxGeometry(12, 5.0, 6, 1, 0.12), brick); depot.position.set(stx, sty + 2.5, stz); depot.castShadow = true; depot.receiveShadow = true; town.add(depot); town.add(addOutline(depot))
            const droof = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.5, 6.6), slate); droof.position.set(stx, sty + 5.1, stz); town.add(droof)
            const dome2 = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x6fae9c)); dome2.position.set(stx, sty + 5.3, stz); dome2.castShadow = true; town.add(dome2) // 緑青のドーム
            const plat = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 2.4), toon(season === 'winter' ? 0xc4c8c6 : 0x9a948a)); plat.position.set(stx, sty + 0.25, stz + 6); plat.receiveShadow = true; town.add(plat) } } // プラットホーム
        // ── 路面電車（大通り z=tz を東西に走る）＝大正の生気。レール＋走る電車。 ──
        { const railM = toon(0x4a4640), railZ = tz, rx0 = tx - 90, rx1 = tx + 90, railY = heightAt(tx, railZ) + 0.12
          for (const dz of [-0.7, 0.7]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(rx1 - rx0, 0.08, 0.14), railM); rail.position.set((rx0 + rx1) / 2, railY, railZ + dz); town.add(rail) } // レール2本
          const tram = new THREE.Group(); const tbody = new THREE.Mesh(new RoundedBoxGeometry(5.4, 2.4, 2.0, 1, 0.18), toon(season === 'winter' ? 0x4a6a5a : 0x2e6a52)); tbody.position.y = 1.5; tbody.castShadow = true; tram.add(tbody); tram.add(addOutline(tbody)) // 輪郭は電車の子＝一緒に動く（townに直接足すと原点に取り残される）
          const tBand = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.5, 2.05), toon(0xe6dcc6)); tBand.position.y = 2.1; tram.add(tBand) // 窓帯
          const tRoofm = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.3, 2.2), toon(0x3a3a36)); tRoofm.position.y = 2.85; tram.add(tRoofm)
          if (isNight) { const tw = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.4, 0.04), new THREE.MeshBasicMaterial({ color: 0xffe2a4, fog: true })); tw.position.set(0, 2.1, 1.03); tram.add(tw); const tw2 = tw.clone(); tw2.position.z = -1.03; tram.add(tw2) }
          tram.position.set(rx0, heightAt(rx0, railZ) + 0.16, railZ); town.add(tram) // 初期位置をレール始点に置く（遠方時に原点へ取り残されてhome中央に出るのを防ぐ）
          trams.push({ g: tram, x0: rx0, x1: rx1, z: railZ, sp: 7 + R() * 2, ph: R() * 100 })
        }
        for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.2832 + R() * 0.25, rr = TAISHO.r - 5 + R() * 5, rx = tx + Math.cos(a) * rr, rz = tz + Math.sin(a) * rr, ry = heightAt(rx, rz); const rk = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 + R() * 1.2, 0), toon(0x7c766a)); rk.position.set(rx, Math.max(SEA.level, ry) + 0.3, rz); rk.rotation.set(R() * 3, R() * 3, R() * 3); rk.scale.y = 0.6; town.add(rk) } // 汀の磯
      }
      // ── 生きもの（街/時代/季節で最適化）。蝶/蜻蛉はふわふわ舞い、犬猫馬は街に佇む＝生気と不自然さの解消 ──
      { const flyOK = season === 'spring' || season === 'summer', dartOK = season === 'summer' && weather !== 'rain'
        const flyCols = season === 'spring' ? [0xf6d0e0, 0xfaf0c0, 0xf2f2ee, 0xeed8a8] : [0xf2ead0, 0xe8e2c0, 0xf6e8b0, 0xeec8a0]
        for (const [cx, cz, kind] of [[0, 0, 'home'], [EDO.x, EDO.z, 'edo'], [SENGOKU.x, SENGOKU.z, 'sengoku'], [TAISHO.x, TAISHO.z, 'taisho']]) {
          if (flyOK && !isNight) for (let k = 0; k < 5; k++) { const a = R() * 6.28, r = 14 + R() * 34, px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r, py = heightAt(px, pz); if (py < SEA.level + 1) continue; mkButterfly(px, py + 2.2 + R() * 2, pz, flyCols[k % flyCols.length]) } // 蝶（春夏の昼）
          if (dartOK && kind !== 'sengoku') for (let k = 0; k < 3; k++) { const a = R() * 6.28, r = 16 + R() * 22, px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r, py = heightAt(px, pz); if (py < SEA.level + 1) continue; mkDragonfly(px, py + 1.6, pz) } // 蜻蛉（夏・水辺）
          const animals = kind === 'sengoku' ? [[0x5a4030, 1.1]] : kind === 'edo' ? [[0x5a4030, 1.1], [0xc8c0b4, 0.55], [0x6a6258, 0.5]] : kind === 'taisho' ? [[0xc8c0b4, 0.55], [0x4a4038, 0.5], [0xddd6c8, 0.55]] : [[0xc8c0b4, 0.55], [0x5a5a5e, 0.5], [0x8a7a5a, 0.55]] // 戦国=馬/江戸=馬犬猫/大正=犬猫/現代=犬猫
          for (const [col, sc] of animals) { const a = R() * 6.28, r = 12 + R() * 26, px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r, py = heightAt(px, pz); if (py < SEA.level + 1.2) continue; mkQuad(px, py, pz, R() * 6.28, col, sc) }
        }
      }
      // ── 行き先の気配（飛び立つと方角がそれとなく分かる導線）。東=城下町への澪標／北=山城への鳥居の海路 ──
      {
        for (let mx = 110; mx <= 520; mx += 30) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 14, 6), toon(0x6a4f38)); pole.position.set(mx, SEA.level + 5, -44); pole.castShadow = true; town.add(pole); const cage = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), toon(0x5a4632)); cage.position.set(mx, SEA.level + 11.5, -44); town.add(cage); town.add(addOutline(cage)); const flag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 2.0), toon(0xc24a33)); flag.position.set(mx, SEA.level + 9.4, -42.9); town.add(flag); if (isNight) { const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffcf8a, fog: true })); lamp.position.set(mx, SEA.level + 11.5, -44); town.add(lamp) } } // 澪標（東＝江戸への海路。島の汀の手前まで）
        // 北(戦国)の鳥居の海路・西(大正)の灯標の海路は撤去＝導線で位置がバレないよう独立させ「偶然見つける」渡りに（実機FB。導線は東=江戸のみ）。
        // 海路に灯る光点（東＝江戸の澪標の足元に連なり、上空からは方角を指す一筋の線として読める。戦国/大正には敷かない）
        const gc = document.createElement('canvas'); gc.width = gc.height = 48; const gcx = gc.getContext('2d'); const ggr = gcx.createRadialGradient(24, 24, 1, 24, 24, 24); ggr.addColorStop(0, 'rgba(255,255,255,0.95)'); ggr.addColorStop(1, 'rgba(255,255,255,0)'); gcx.fillStyle = ggr; gcx.fillRect(0, 0, 48, 48); const glowTex = new THREE.CanvasTexture(gc)
        const goldMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffd6a0, transparent: true, opacity: isNight ? 0.82 : 0.42, depthWrite: false, blending: THREE.AdditiveBlending, fog: true })
        for (let mx = 100; mx <= 520; mx += 13) { const sp = new THREE.Sprite(goldMat); sp.position.set(mx, SEA.level + 1.4, -44); sp.scale.set(5.4, 5.4, 1); town.add(sp) }       // 東＝江戸への海路の光点（唯一残す導線）
      }
      // ── 別世界の演出: 時代の気配（舞う粒子）＋霞の帯（くぐると世界が変わる関門）──
      {
        const mkFx = (cx, cz, count, spread, col, sz) => {
          const g = new THREE.BufferGeometry(), pos = new Float32Array(count * 3), ph = new Float32Array(count)
          for (let i = 0; i < count; i++) { pos[i * 3] = cx + (R() - 0.5) * spread; pos[i * 3 + 1] = SEA.level + 4 + R() * 46; pos[i * 3 + 2] = cz + (R() - 0.5) * spread; ph[i] = R() * 6.28 }
          g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
          const m = new THREE.PointsMaterial({ color: col, size: sz, transparent: true, opacity: 0, depthWrite: false, fog: true, sizeAttenuation: true })
          const pts = new THREE.Points(g, m); pts.frustumCulled = false; town.add(pts)
          return { pts, g, m, ph, y0: SEA.level + 4, yH: 46 }
        }
        edoFx = mkFx(EDO.x, EDO.z, 160, 200, isNight ? 0xffe0a0 : 0xf2bcce, isNight ? 2.5 : 2.1) // 江戸: 夜=蛍/昼=桜の花びら（大きくゆっくり＝ノスタルジー）
        senFx = mkFx(SENGOKU.x, SENGOKU.z, 130, 110, isNight ? 0xffb060 : 0xd8b89a, 2.2)          // 戦国: 篝火の火の粉（昇る）
        taiFx = mkFx(TAISHO.x, TAISHO.z, 150, 170, isNight ? 0xffd2a0 : 0xf0c2a4, 2.3)             // 大正: 夜=ガス灯の灯の粉/昼=潮風に舞う花びら
        const mc = document.createElement('canvas'); mc.width = mc.height = 64; const mcx = mc.getContext('2d'); const mg = mcx.createRadialGradient(32, 32, 1, 32, 32, 32); mg.addColorStop(0, 'rgba(255,255,255,0.8)'); mg.addColorStop(1, 'rgba(255,255,255,0)'); mcx.fillStyle = mg; mcx.fillRect(0, 0, 64, 64); const mistTex = new THREE.CanvasTexture(mc)
        const mistMat = new THREE.SpriteMaterial({ map: mistTex, color: 0xeef2f6, transparent: true, opacity: 0.42, depthWrite: false, fog: true })
        const band = (cx, cz, axis) => { for (let i = 0; i < 10; i++) { const o = (i - 4.5) * 11, sp = new THREE.Sprite(mistMat); axis === 'x' ? sp.position.set(cx, SEA.level + 7 + R() * 14, cz + o) : sp.position.set(cx + o, SEA.level + 7 + R() * 14, cz); sp.scale.set(30, 22, 1); town.add(sp) } }
        band(EDO.x - 129, EDO.z, 'x'); band(SENGOKU.x, SENGOKU.z + 129, 'z'); band(TAISHO.x + 129, TAISHO.z, 'x') // 江戸/戦国/大正の関門（接近路 d≈129 に漂う霧のかたまり＝くぐると別世界。中心から導出し追従）
      }
      // 防波堤（汀から海へ伸びる一本。コンクリの天端を1メッシュへ）
      const jz = -26, jStartX = 80, jEndX = 100, jetGeos = []
      for (let x = jStartX; x <= jEndX; x += 2) { const seg = new THREE.BoxGeometry(2.4, 2.0, 5.2); seg.applyMatrix4(new THREE.Matrix4().makeTranslation(x, SEA.level + 0.4, jz)); jetGeos.push(seg) }
      if (BufferGeometryUtils.mergeGeometries) { const jm = BufferGeometryUtils.mergeGeometries(jetGeos, false); if (jm) { const jetty = new THREE.Mesh(jm, toon(0x9a958c)); jetty.castShadow = true; jetty.receiveShadow = true; town.add(jetty) } }
      jetGeos.forEach((g) => g.dispose())
      // 灯台（防波堤の先端。白に紅帯・上に灯り）
      {
        const lx = jEndX, lz = jz, lan = new THREE.Group(); lan.position.set(lx, SEA.level + 1.4, lz); town.add(lan)
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.5, 8, 14), toon(0xeae6dc)); tower.position.y = 4; tower.castShadow = true; lan.add(tower); lan.add(addOutline(tower))
        for (const by of [2.6, 5.4]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(1.28 - by * 0.06, 1.34 - by * 0.06, 1.1, 14), toon(0xc24a33)); band.position.y = by; lan.add(band) } // 紅帯
        const room = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 1.6, 12), toon(0x6a747c)); room.position.y = 8.6; lan.add(room) // 灯室
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10), new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: true })); lamp.position.y = 8.6; lan.add(lamp) // 灯り（昼も明るく夜は際立つ）
        const cap = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.0, 12), toon(0x3a4248)); cap.position.y = 9.95; lan.add(cap)
        // 光芒（夜に回る扇状の光。加算で淡く。灯室の高さで回る）
        const beam = new THREE.Group(); beam.position.y = 8.6; lan.add(beam); lightBeam = beam
        const beamOp = 0.04 + duskAmt * 0.16
        const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: beamOp, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })
        for (const ang of [0, Math.PI]) { const bg = new THREE.ConeGeometry(2.2, 20, 4, 1, true); bg.rotateZ(Math.PI / 2); bg.translate(10, 0, 0); const bm = new THREE.Mesh(bg, beamMat); bm.rotation.y = ang; bm.scale.set(1, 0.25, 1); beam.add(bm) } // 横に倒した細い扇＝水面を撫でる光
        colliders.push({ x: lx, z: lz, r: 1.6 })
      }
      // 小舟（岸近くに数艘。ゆるく浮かんで揺れる）
      const boatCols = [0xc7b48a, 0xb0563f, 0x6f8aa6]
      for (const bp of [[86, -12], [91, -42], [84, -54], [95, -22]]) {
        const bg = new THREE.Group(); bg.position.set(bp[0], SEA.level + 0.15, bp[1]); bg.rotation.y = R() * 6.28; bg.userData = { ph: R() * 6.28 }; town.add(bg)
        const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 2.4, 4, 8), toon(boatCols[(R() * boatCols.length) | 0])); hull.rotation.x = Math.PI / 2; hull.scale.set(1, 0.5, 1); hull.position.y = 0.2; bg.add(hull)
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.9), toon(0xe6e0d4)); cabin.position.set(0, 0.5, -0.5); bg.add(cabin)
        boats.push(bg)
      }
      // 砂浜（汀の帯。海岸線に沿って砂色の敷きを置く＝丘と海の境をやわらげる。冬は雪の渚）
      const shoreXat = (z) => { let lo = SEA.coast, hi = SEA.shore + 12; for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (heightAt(m, z) > SEA.level) lo = m; else hi = m } return (lo + hi) / 2 }
      const beachMat = toon(season === 'winter' ? 0xe6ebf0 : 0xd9c79c)
      const beachGeos = []
      for (let z = 26; z > -98; z -= 2.3) { const sx = shoreXat(z); const cxb = sx - 2.0; const gy = heightAt(cxb, z); const seg = new THREE.BoxGeometry(6.0, 0.16, 2.5); seg.applyMatrix4(new THREE.Matrix4().makeTranslation(cxb, gy + 0.05, z)); beachGeos.push(seg) }
      if (BufferGeometryUtils.mergeGeometries) { const bm2 = BufferGeometryUtils.mergeGeometries(beachGeos, false); if (bm2) { const beach = new THREE.Mesh(bm2, beachMat); beach.receiveShadow = true; town.add(beach) } }
      beachGeos.forEach((g) => g.dispose())
    }

    // ── 臨海の港（埋立地の工業の岸）。倉庫・紅白の煙突・ガントリークレーン・ガスタンク・コンテナ。──
    {
      const hx = HARBOR.x, hz = HARBOR.z, padY = HARBOR.padY
      const metal = toon(0x8a939a), metal2 = toon(0xb0aaa0), frameMat = toon(0x596169), tankMat = toon(0xc6cace)
      const lit = duskAmt > 0.2 // 夕夜は工場夜景の灯り（窓・投光器・作業灯）
      const warmLight = new THREE.MeshBasicMaterial({ color: 0xffd28a, fog: true }), coolLight = new THREE.MeshBasicMaterial({ color: 0xdfeaff, fog: true }), tealLight = new THREE.MeshBasicMaterial({ color: 0x86e0d4, fog: true })
      // 埋立地の舗装（コンクリの盤）。平らな緑地でなく工業の岸に見せる。
      const padDisc = new THREE.Mesh(new THREE.CircleGeometry(HARBOR.r - 0.4, 30), toon(season === 'winter' ? 0xb8bcc0 : 0x8e8c87)); padDisc.rotateX(-Math.PI / 2); padDisc.position.set(hx, padY + 0.04, hz); padDisc.receiveShadow = true; town.add(padDisc)
      // 倉庫×2（金属の長い陸屋根＋シャッター。夕夜は窓が灯る）
      for (const w of [[-5, 3, 8, 5.5, 4.2], [-6, -5, 6.5, 4.5, 3.6]]) {
        const g = new THREE.Group(); g.position.set(hx + w[0], padY, hz + w[1]); town.add(g)
        const body = new THREE.Mesh(new THREE.BoxGeometry(w[2], w[4], w[3]), metal2); body.position.y = w[4] / 2; body.castShadow = true; body.receiveShadow = true; g.add(body)
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w[2] + 0.3, 0.4, w[3] + 0.3), metal); roof.position.y = w[4] + 0.2; roof.castShadow = true; g.add(roof)
        const door = new THREE.Mesh(new THREE.BoxGeometry(w[2] * 0.4, w[4] * 0.7, 0.12), toon(0x3a3e42)); door.position.set(0, w[4] * 0.35, w[3] / 2 + 0.07); g.add(door)
        if (lit) for (let i = 0; i < 4; i++) { const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.08), warmLight); win.position.set((i - 1.5) * w[2] * 0.2, w[4] * 0.62, w[3] / 2 + 0.05); g.add(win) } // 灯る窓
        colliders.push({ x: hx + w[0], z: hz + w[1], r: Math.max(w[2], w[3]) / 2 })
      }
      // 投光器（照明塔）×3＝工場夜景の主役。背の高い柱の上で煌々と灯る。
      for (const fp of [[8, 6], [-9, -7], [3, -8]]) {
        const g = new THREE.Group(); g.position.set(hx + fp[0], padY, hz + fp[1]); town.add(g)
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 11, 6), frameMat); pole.position.y = 5.5; pole.castShadow = true; g.add(pole)
        const bar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.2, 0.3), frameMat); bar.position.y = 10.9; g.add(bar)
        for (const lx of [-0.7, 0, 0.7]) { const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), lit ? coolLight : toon(0x9aa0a4)); head.position.set(lx, 10.9, 0.1); g.add(head) } // 投光ヘッド（夕夜は白く灯る）
      }
      // 煙突×2（紅白の帯・天辺に赤灯・うっすら煙）
      for (const c of [[6.5, -3.5], [4, 4.5]]) {
        const g = new THREE.Group(); g.position.set(hx + c[0], padY, hz + c[1]); town.add(g)
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 16, 12), toon(0xe8e4dc)); stack.position.y = 8; stack.castShadow = true; g.add(stack)
        for (const by of [4, 8, 12]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.72 - by * 0.012, 0.86 - by * 0.012, 1.3, 12), toon(0xc24a33)); band.position.y = by; g.add(band) }
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff5a4a, fog: true })); tip.position.y = 16.4; g.add(tip)
        const smokeMat = new THREE.MeshBasicMaterial({ color: 0xd8dde2, transparent: true, opacity: 0.16, depthWrite: false, fog: true })
        for (let s = 0; s < 3; s++) { const pf = new THREE.Mesh(new THREE.SphereGeometry(1.0 + s * 0.5, 7, 6), smokeMat); pf.position.set(0.4 + s * 0.5, 17.5 + s * 1.8, 0.2); g.add(pf) } // たなびく煙（淡い）
        colliders.push({ x: hx + c[0], z: hz + c[1], r: 1.1 })
      }
      // ガスタンク（球形・脚付き）
      {
        const g = new THREE.Group(); g.position.set(hx - 3, padY, hz + 7); town.add(g)
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 12), tankMat); sphere.position.y = 4.4; sphere.castShadow = true; g.add(sphere); g.add(addOutline(sphere))
        for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.4, 6), frameMat); leg.position.set(Math.cos(a) * 2.4, 1.7, Math.sin(a) * 2.4); g.add(leg) }
        if (lit) for (const a of [0.5, 2.6, 4.7]) { const sl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), tealLight); sl.position.set(Math.cos(a) * 3.05, 4.4 + Math.sin(a) * 1.5, Math.sin(a) * 3.05); g.add(sl) } // 球面の保安灯（青緑）
        colliders.push({ x: hx - 3, z: hz + 7, r: 3.3 })
      }
      // ガントリークレーン（門型・水際へブームを張り出す）
      {
        const g = new THREE.Group(); g.position.set(hx + 9, padY, hz - 1); town.add(g)
        for (const lx of [-3, 3]) for (const lz of [-2, 2]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 12, 0.4), frameMat); leg.position.set(lx, 6, lz); leg.castShadow = true; g.add(leg) }
        const beam = new THREE.Mesh(new THREE.BoxGeometry(7, 0.7, 1.0), frameMat); beam.position.set(0, 12, 0); g.add(beam)
        const boom = new THREE.Mesh(new THREE.BoxGeometry(15, 0.5, 0.7), frameMat); boom.position.set(5.5, 12.7, 0); boom.castShadow = true; g.add(boom) // 海側へ張り出す
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 1.3), toon(0xc24a33)); cab.position.set(0, 11.1, 0); g.add(cab)
        if (lit) { for (const bx2 of [-5.5, 0, 11]) { const wl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), warmLight); wl.position.set(bx2, 12.0, 0.4); g.add(wl) } const rb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff5a4a, fog: true })); rb.position.set(0, 12.9, 0); g.add(rb) } // 作業灯＋頂部の赤灯
        // 動くトロリー＋吊りケーブル＋フック（荷役の動き）
        const trolley = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.1), toon(0x9a3f34)); trolley.position.set(5.5, 12.0, 0); g.add(trolley)
        const hcable = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1, 0.07), toon(0x33333a)); hcable.position.set(5.5, 9, 0); g.add(hcable)
        const hook = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), toon(0x46423a)); hook.position.set(5.5, 6, 0); g.add(hook)
        crane = { trolley, hcable, hook }
        colliders.push({ x: hx + 9, z: hz - 1, r: 4 })
      }
      // コンテナ（色とりどりの箱を積む）
      const contCols = [0xc24a33, 0x3a6a8a, 0x5a8a5a, 0xd0a040, 0xaa5a3a, 0x6a6a72]
      for (let i = 0; i < 9; i++) { const ox = -9 + (i % 5) * 2.6, oz = -8.5 + ((i / 5) | 0) * 2.4; const stack = 1 + ((R() * 2.4) | 0); for (let s = 0; s < stack; s++) { const ct = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 2.0), toon(contCols[(R() * contCols.length) | 0])); ct.position.set(hx + ox, padY + 0.6 + s * 1.25, hz + oz); ct.castShadow = true; town.add(ct) } }
      // 貨物船（岸壁に着けた一隻＝港の主役）。船体・甲板・船橋・煙突・甲板のコンテナ。
      {
        const g = new THREE.Group(); g.position.set(hx + 13, SEA.level, hz - 1); g.userData = { ph: R() * 6.28 }; town.add(g) // 船腹を岸(z方向)と平行に＝長軸z
        const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 19), toon(0x9a3f34)); hull.position.y = 1.3; hull.castShadow = true; g.add(hull)
        const deck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.6, 19.2), toon(0x4a4640)); deck.position.y = 2.8; g.add(deck)
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3, 3.6), toon(0xe6e0d4)); bridge.position.set(0, 4.5, -6.5); bridge.castShadow = true; g.add(bridge)
        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.72, 2.4, 10), toon(0xc24a33)); funnel.position.set(0, 5.2, -8.2); g.add(funnel)
        for (let i = 0; i < 5; i++) { const ct = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.3, 2.5), toon(contCols[(R() * contCols.length) | 0])); ct.position.set(0, 3.75, 5 - i * 2.7); ct.castShadow = true; g.add(ct) }
        boats.push(g)
      }
      // タグボート（湾を行き来する曳船。小さな船体＋背の高い操舵室＋煙突）
      {
        tug = new THREE.Group(); tug.position.set(92, SEA.level + 0.2, -56); town.add(tug)
        const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 2.6, 4, 8), toon(0x2a4a6a)); hull.rotation.x = Math.PI / 2; hull.scale.set(1, 0.55, 1); hull.position.y = 0.3; tug.add(hull)
        const deck = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 3.4), toon(0x8a4030)); deck.position.y = 0.7; tug.add(deck)
        const house = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 1.8), toon(0xeae2d0)); house.position.set(0, 1.5, 0.2); house.castShadow = true; tug.add(house)
        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.0, 8), toon(0xc24a33)); funnel.position.set(0, 2.0, -1.0); tug.add(funnel)
        tug.userData = { cx: 92, cz: -56, rad: 13 }
      }
      // 連絡船（湾を大きな楕円で渡る客船。二層の甲板・窓・煙突。夜は窓が灯る）
      {
        ferry = new THREE.Group(); ferry.position.set(88, SEA.level + 0.2, -38); town.add(ferry)
        const hull = new THREE.Mesh(new THREE.BoxGeometry(8.4, 2.0, 2.8), toon(0x2f5a86)); hull.position.y = 1.0; hull.castShadow = true; ferry.add(hull)
        const hullTop = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.5, 2.9), toon(0xeae4d6)); hullTop.position.y = 2.1; ferry.add(hullTop)
        const deck1 = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.5, 2.4), toon(0xf0ece2)); deck1.position.set(-0.3, 3.1, 0); deck1.castShadow = true; ferry.add(deck1)
        const deck2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.3, 2.1), toon(0xf0ece2)); deck2.position.set(-0.6, 4.4, 0); ferry.add(deck2)
        const wheelhouse = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 2.0), toon(0xe2dccf)); wheelhouse.position.set(2.4, 3.0, 0); ferry.add(wheelhouse) // 船橋（前方）
        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 1.8, 10), toon(0xc24a33)); funnel.position.set(-1.4, 5.4, 0); ferry.add(funnel)
        const winMat = duskAmt > 0.2 ? new THREE.MeshBasicMaterial({ color: 0xffe6b0, fog: true }) : toon(0x39474f)
        for (const dy of [3.1, 4.4]) for (const dz of [-1.16, 1.16]) { const w = new THREE.Mesh(new THREE.BoxGeometry(dy > 4 ? 3.8 : 5.6, 0.6, 0.05), winMat); w.position.set(-0.4, dy, dz); ferry.add(w) }
        ferry.userData = { cx: 88, cz: -46, rx: 15, rz: 17 }
      }
      spawnAvoid.push({ x: hx, z: hz, r: HARBOR.r })
    }

    // ── 港の大橋（湾を渡る斜張橋）と小島。海上の目印・飛んでくぐれる。──
    {
      const BZ = ISLAND.z, A = 72, B = ISLAND.x - 2 // 橋の両端x（A=岸、B=島の手前）
      const Ay = heightAt(A, BZ) + 0.6, By = heightAt(B, BZ) + 0.6, span = B - A
      const deckY = (x) => { const t = Math.max(0, Math.min(1, (x - A) / span)); return Ay + (By - Ay) * t + Math.sin(Math.PI * t) * 7 }
      const deckMat = toon(0xc4c0b6), towerMat = toon(0xd6d0c4), cableMat = toon(0x70747a)
      const lit2 = duskAmt > 0.2, warm2 = new THREE.MeshBasicMaterial({ color: 0xffd28a, fog: true })
      // 橋桁（弧を描く床版）＋欄干（1メッシュへ）
      const deckGeos = [], railGeos = []
      for (let x = A; x <= B; x += 1.4) {
        const y = deckY(x), slope = deckY(x + 0.7) - deckY(x - 0.7)
        const seg = new THREE.BoxGeometry(1.5, 0.45, 4.4); seg.rotateZ(-Math.atan2(slope, 1.4)); seg.applyMatrix4(new THREE.Matrix4().makeTranslation(x, y, BZ)); deckGeos.push(seg)
        for (const rz of [-2.1, 2.1]) { const r = new THREE.BoxGeometry(1.5, 0.5, 0.12); r.applyMatrix4(new THREE.Matrix4().makeTranslation(x, y + 0.5, BZ + rz)); railGeos.push(r) }
      }
      if (BufferGeometryUtils.mergeGeometries) {
        const dm = BufferGeometryUtils.mergeGeometries(deckGeos, false); if (dm) { const deck = new THREE.Mesh(dm, deckMat); deck.castShadow = true; deck.receiveShadow = true; town.add(deck) }
        const rmg = BufferGeometryUtils.mergeGeometries(railGeos, false); if (rmg) town.add(new THREE.Mesh(rmg, deckMat))
      }
      deckGeos.concat(railGeos).forEach((g) => g.dispose())
      // 主塔×2（H型・海面から立つ）＋扇状のケーブル
      for (const tx of [A + span * 0.32, A + span * 0.68]) {
        const dY = deckY(tx), topY = dY + 17, legBot = SEA.level - 1, legH = topY - legBot
        const g = new THREE.Group(); g.position.set(tx, 0, BZ); town.add(g)
        for (const lz of [-2.4, 2.4]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.72, legH, 8), towerMat); leg.position.set(0, legBot + legH / 2, lz); leg.castShadow = true; g.add(leg) }
        const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 5.4), towerMat); cross1.position.set(0, dY + 0.2, 0); g.add(cross1)
        const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 5.4), towerMat); cross2.position.set(0, topY - 3, 0); g.add(cross2)
        for (const lz of [-2.4, 2.4]) for (const dxp of [-9, -5.5, 5.5, 9]) {
          const dx2 = tx + dxp, dy2 = deckY(dx2) + 0.4, cdy = dy2 - topY, clen = Math.hypot(dxp, cdy)
          const cable = new THREE.Mesh(new THREE.BoxGeometry(clen, 0.07, 0.07), cableMat); cable.position.set(dxp / 2, (topY + dy2) / 2, lz); cable.rotation.z = Math.atan2(cdy, dxp); g.add(cable)
        }
        if (lit2) { const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff5a4a, fog: true })); beacon.position.set(0, topY + 0.4, 0); g.add(beacon) }
        colliders.push({ x: tx, z: BZ, r: 2.8 })
      }
      // 橋の灯り（夕夜、橋桁に沿って暖色の点）
      if (lit2) for (let x = A + 2; x < B; x += 4) { const lp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 6), warm2); lp.position.set(x, deckY(x) + 0.7, BZ + 2.1); town.add(lp) }
      // 小島の造形（盛り上がった地面＋一本松＋岩＋灯標）
      {
        const ix = ISLAND.x, iz = ISLAND.z, iy = heightAt(ix, iz)
        tree(ix, iz + 1, 1.3 + R() * 0.4) // 島の一本松
        for (const rp of [[-3, -2, 1.0], [2.5, 2, 0.8], [3.2, -3, 0.7]]) { const rk = new THREE.Mesh(new THREE.IcosahedronGeometry(rp[2], 0), toon(0x8a857c)); rk.position.set(ix + rp[0], heightAt(ix + rp[0], iz + rp[1]) + rp[2] * 0.4, iz + rp[1]); rk.castShadow = true; town.add(rk) }
        const beaconG = new THREE.Group(); beaconG.position.set(ix - 4, iy, iz - 2); town.add(beaconG)
        const bp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3.4, 8), toon(0xeae6dc)); bp.position.y = 1.7; beaconG.add(bp)
        const bband = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.8, 8), toon(0xc24a33)); bband.position.y = 2.4; beaconG.add(bband)
        const blamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: true })); blamp.position.y = 3.6; beaconG.add(blamp)
        colliders.push({ x: ix, z: iz, r: 4 }); spawnAvoid.push({ x: ix, z: iz, r: 6 })
      }
    }

    // ── 磯・岩場（南の海岸の岩礁）＋白波、そして海鳥。海辺の自然を厚く。──
    {
      const rockMat = toon(0x7a756c), rockMat2 = toon(0x8c8378)
      const foamMat = new THREE.MeshBasicMaterial({ color: 0xeef2f4, transparent: true, opacity: 0.45, depthWrite: false, fog: true })
      const rocks = [[76, -14, 1.6], [79, -17, 2.2], [81, -20, 1.4], [77, -22, 1.9], [80.5, -25, 2.4], [78, -28, 1.7], [83, -18, 1.1], [75, -26, 1.3], [82, -23, 1.5], [79.5, -31, 2.0], [74.5, -20, 1.4], [84, -22, 0.9], [76.5, -33, 1.5]]
      for (const r of rocks) {
        const rx = r[0], rz = r[1], rs = r[2], gy = heightAt(rx, rz)
        const rk = new THREE.Mesh(new THREE.IcosahedronGeometry(rs, 0), R() < 0.5 ? rockMat : rockMat2)
        rk.position.set(rx, Math.max(gy, SEA.level) + rs * 0.25, rz); rk.rotation.set(R() * 3, R() * 3, R() * 3); rk.scale.y = 0.66 + R() * 0.4; rk.castShadow = true; rk.receiveShadow = true; town.add(rk)
        if (gy < SEA.level + 0.6) { const foam = new THREE.Mesh(new THREE.CircleGeometry(rs * 1.6, 12), foamMat); foam.rotateX(-Math.PI / 2); foam.position.set(rx, SEA.level + 0.13, rz); town.add(foam) } // 水中の岩の根の白波
        if (gy > SEA.level - 1) colliders.push({ x: rx, z: rz, r: rs * 0.8 })
      }
      // 海鳥（かもめ。湾の上をゆるく旋回し、はばたく）
      gulls = []
      for (let i = 0; i < 6; i++) {
        const g = new THREE.Group()
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 3, 5), toon(0xf2f0ea)); body.rotation.z = Math.PI / 2; g.add(body)
        const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 1.5), toon(0xe8e4dc)); wingL.position.z = 0.85; g.add(wingL)
        const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 1.5), toon(0xe8e4dc)); wingR.position.z = -0.85; g.add(wingR)
        g.userData = { cx: 88 + R() * 16, cz: -42 + (R() - 0.5) * 56, rad: 6 + R() * 10, y: SEA.level + 9 + R() * 11, sp: (R() < 0.5 ? 1 : -1) * (0.18 + R() * 0.16), ph: R() * 6.28 }
        scene.add(g); gulls.push(g)
      }
      const mkGull = (cx, cz) => { const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 3, 5), toon(0xf2f0ea)); body.rotation.z = Math.PI / 2; g.add(body); for (const s of [1, -1]) { const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 1.5), toon(0xe8e4dc)); wing.position.z = s * 0.85; g.add(wing) } g.userData = { cx, cz, rad: 7 + R() * 12, y: SEA.level + 12 + R() * 16, sp: (R() < 0.5 ? 1 : -1) * (0.16 + R() * 0.14), ph: R() * 6.28 }; scene.add(g); gulls.push(g) }
      for (let i = 0; i < 7; i++) mkGull(160 + R() * 360, -44 + (R() - 0.5) * 50) // 東(江戸)への長い渡りの海鳥
      for (let i = 0; i < 6; i++) mkGull(140 + (R() - 0.5) * 50, -180 - R() * 360) // 北(戦国)への渡りの海鳥
      for (let i = 0; i < 5; i++) mkGull(-260 - R() * 320, -30 + (R() - 0.5) * 50) // 西(大正)への渡りの海鳥
    }

    // ── 海釣りの桟橋（南の海へ伸びる木の桟橋）＋釣り人。静かな海辺の暮らし。──
    {
      const pz = -5, x0 = 73, x1 = 92, deckY = SEA.level + 2
      const woodMat = toon(0x9a7a52), pileMat = toon(0x6a5238), railMat = toon(0x866a48)
      const deckGeos = [], railGeos = []
      for (let x = x0; x <= x1; x += 1.1) { const seg = new THREE.BoxGeometry(1.2, 0.18, 3.0); seg.applyMatrix4(new THREE.Matrix4().makeTranslation(x, deckY, pz)); deckGeos.push(seg) }
      for (let x = x0; x <= x1; x += 2.2) for (const rz of [-1.4, 1.4]) { const post = new THREE.BoxGeometry(0.1, 0.7, 0.1); post.applyMatrix4(new THREE.Matrix4().makeTranslation(x, deckY + 0.42, pz + rz)); railGeos.push(post); const top = new THREE.BoxGeometry(2.2, 0.08, 0.08); top.applyMatrix4(new THREE.Matrix4().makeTranslation(x + 1.1, deckY + 0.78, pz + rz)); railGeos.push(top) }
      if (BufferGeometryUtils.mergeGeometries) {
        const dm = BufferGeometryUtils.mergeGeometries(deckGeos, false); if (dm) { const deck = new THREE.Mesh(dm, woodMat); deck.castShadow = true; deck.receiveShadow = true; town.add(deck) }
        const rm = BufferGeometryUtils.mergeGeometries(railGeos, false); if (rm) town.add(new THREE.Mesh(rm, railMat))
      }
      deckGeos.concat(railGeos).forEach((g) => g.dispose())
      // 杭（水中へ）
      const pileH = deckY - (SEA.level - 3)
      for (let x = x0 + 1; x <= x1; x += 3.6) for (const dz of [-1.3, 1.3]) { const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, pileH, 6), pileMat); pile.position.set(x, deckY - pileH / 2 + 0.1, pz + dz); pile.castShadow = true; town.add(pile) }
      // 釣り人×3（桟橋の先で海へ竿を垂れる）。腰掛け＋体＋頭＋竿＋バケツ。
      const skinMat = toon(0xf0c49c), rodMat = toon(0x40382c)
      for (const ap of [[87, 1.0], [89.5, -0.8], [84, 1.2]]) {
        const ax = ap[0], az = pz + ap[1], g = new THREE.Group(); g.position.set(ax, deckY + 0.18, az); town.add(g)
        const stool = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), toon(0x6a5238)); stool.position.y = 0.2; g.add(stool)
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 3, 6), toon([0x5a78a0, 0x6a8a5a, 0xb0894a][(R() * 3) | 0])); body.position.y = 0.85; body.castShadow = true; g.add(body)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), skinMat); head.position.y = 1.32; g.add(head)
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.1, 10), toon(0xcfc6a8)); hat.position.y = 1.46; g.add(hat) // 麦わら帽
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 4.2, 4), rodMat); rod.position.set(1.6, 1.6, 0); rod.rotation.z = -0.7; g.add(rod) // 海へ伸びる竿
        const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.4, 8), toon(0x9aa0a4)); bucket.position.set(-0.5, 0.2, 0.2); g.add(bucket)
      }
      spawnAvoid.push({ x: (x0 + x1) / 2, z: pz, r: 12 }) // 桟橋・海上には降りない
      // 魚が時々跳ねる（桟橋・磯のあたりの海面）＋広がる波紋。海辺の生き物の気配。
      const fishMat = toon(0xa8c0cc), rippleMat = new THREE.MeshBasicMaterial({ color: 0xeef2f4, transparent: true, opacity: 0.4, depthWrite: false, fog: true })
      for (const sp of [[89, -10], [93, -24], [87, -34], [95, -15], [91, -45]]) {
        const fish = new THREE.Group(); fish.visible = false; town.add(fish)
        const bodyF = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.66, 3, 6), fishMat); bodyF.rotation.z = Math.PI / 2; fish.add(bodyF)
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.42, 4), fishMat); tail.rotation.z = -Math.PI / 2; tail.position.x = -0.58; fish.add(tail)
        const ripple = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 5, 18), rippleMat.clone()); ripple.rotation.x = -Math.PI / 2; ripple.position.set(sp[0], SEA.level + 0.12, sp[1]); ripple.visible = false; town.add(ripple)
        fishJumps.push({ fish, ripple, x: sp[0], z: sp[1], t0: R() * 8, period: 6 + R() * 5, jumpDur: 1.1 })
      }
    }

    // ── 砂浜の海の家＋ビーチパラソル＋浮き輪。夏の海辺の賑わい。──
    {
      const bx = 71, bz = -36, by = heightAt(bx, bz) // 砂浜の上（汀の手前の乾いた砂）
      // 海の家（板の小屋＋庇＋暖簾）。海(+x)へ開く。
      const hut = new THREE.Group(); hut.position.set(bx, by, bz); town.add(hut)
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.6, 4), toon(0xcdb185)); body.position.y = 1.3; body.castShadow = true; body.receiveShadow = true; hut.add(body)
      const roof = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 4.8), toon(0x9a6a4e)); roof.position.y = 2.7; roof.castShadow = true; hut.add(roof)
      const eave = new THREE.Mesh(new THREE.BoxGeometry(5, 0.18, 1.8), toon(0x9a6a4e)); eave.position.set(2.4, 2.2, 0); hut.add(eave) // 海側の庇
      for (const pz of [-1.7, 1.7]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.0, 6), toon(0x7a5a40)); post.position.set(3.0, 1.0, pz); hut.add(post) }
      // 暖簾（青の布）
      const nc = document.createElement('canvas'); nc.width = 96; nc.height = 40; const ncx = nc.getContext('2d')
      ncx.fillStyle = '#3a6a8a'; ncx.fillRect(0, 0, 96, 40); ncx.fillStyle = '#f0ece0'; ncx.font = 'bold 22px sans-serif'; ncx.textAlign = 'center'; ncx.textBaseline = 'middle'; ncx.fillText('うみのいえ', 48, 21)
      const noren = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 3.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(nc) })); noren.position.set(2.4, 1.7, 0); hut.add(noren)
      colliders.push({ x: bx, z: bz, r: 2.6 })
      // ビーチパラソル＋浮き輪＋ビーチボール（冬は仕舞う）
      if (season !== 'winter') {
        const paraCols = [[0xd84a4a, 0xf0ece0], [0x3a8ac0, 0xf0ece0], [0xe0a030, 0xf0ece0]]
        for (const pp of [[74, -32], [76, -38], [73.5, -40]]) {
          const px2 = pp[0], pz2 = pp[1], pgy = heightAt(px2, pz2)
          const g = new THREE.Group(); g.position.set(px2, pgy, pz2); town.add(g)
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), toon(0xdedacc)); pole.position.y = 1.3; g.add(pole)
          const cols = paraCols[(R() * paraCols.length) | 0]
          const rc = document.createElement('canvas'); rc.width = 32; rc.height = 8; const rcx = rc.getContext('2d')
          for (let i = 0; i < 8; i++) { rcx.fillStyle = '#' + new THREE.Color(i % 2 ? cols[0] : cols[1]).getHexString(); rcx.fillRect(i * 4, 0, 4, 8) }
          const rtex = new THREE.CanvasTexture(rc); rtex.wrapS = THREE.RepeatWrapping; rtex.repeat.set(4, 1)
          const top = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.8, 12), new THREE.MeshToonMaterial({ map: rtex, gradientMap: grad })); top.position.y = 2.7; top.castShadow = true; g.add(top)
        }
        // 浮き輪（水面に浮かぶ・揺れる）
        const ring = new THREE.Group(); ring.position.set(80, SEA.level + 0.15, -34); ring.userData = { ph: R() * 6.28 }; town.add(ring)
        const tube = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.26, 8, 16), toon(0xe24a4a)); tube.rotation.x = Math.PI / 2; ring.add(tube)
        for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283; const wseg = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.27, 8, 4, 0.8), toon(0xf0ece0)); wseg.rotation.x = Math.PI / 2; wseg.rotation.z = a; ring.add(wseg) }
        boats.push(ring) // 波で揺れる
        // ビーチボール
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), toon(0xf0c040)); ball.position.set(75, heightAt(75, -34) + 0.5, -34); ball.castShadow = true; town.add(ball)
      }
    }

    // ── 川辺の遊歩道（東岸の護岸の上を歩ける帯）。路面＋手すり＋街灯＋ベンチ＋並木。──
    {
      const px = RIVER.x + 4.0          // 東岸の遊歩道の中心（護岸の上）
      const railX = RIVER.x + 2.5       // 川側の手すり（路面の水際）
      const zTop = 18, zEnd = -86, dz = 2.2
      // 路面（地面に沿わせた敷石。1メッシュへ）
      const pathGeos = []
      for (let z = zTop; z > zEnd; z -= dz) { const gy = heightAt(px, z); const seg = new THREE.BoxGeometry(3.6, 0.12, dz + 0.1); seg.applyMatrix4(new THREE.Matrix4().makeTranslation(px, gy + 0.06, z)); pathGeos.push(seg) }
      if (BufferGeometryUtils.mergeGeometries) { const pm = BufferGeometryUtils.mergeGeometries(pathGeos, false); if (pm) { const path = new THREE.Mesh(pm, toon(0xbab2a4)); path.receiveShadow = true; town.add(path) } }
      pathGeos.forEach((g) => g.dispose())
      // 手すり（川側。親柱＋上桟を1メッシュへ）
      const railGeos = []
      for (let z = zTop; z > zEnd; z -= 2.0) { const gy = heightAt(px, z); const post = new THREE.BoxGeometry(0.1, 0.9, 0.1); post.applyMatrix4(new THREE.Matrix4().makeTranslation(railX, gy + 0.45, z)); railGeos.push(post); const top = new THREE.BoxGeometry(0.09, 0.09, 2.0); top.applyMatrix4(new THREE.Matrix4().makeTranslation(railX, gy + 0.85, z - 1.0)); railGeos.push(top) }
      if (BufferGeometryUtils.mergeGeometries) { const rm = BufferGeometryUtils.mergeGeometries(railGeos, false); if (rm) { const rail = new THREE.Mesh(rm, toon(0x8a8478)); rail.castShadow = true; town.add(rail) } }
      railGeos.forEach((g) => g.dispose())
      // 街灯（夕夜は灯る）
      const litHead = duskAmt > 0.2 ? new THREE.MeshBasicMaterial({ color: 0xffce86, fog: true }) : toon(0xb8b4a0)
      for (let z = 12; z > zEnd + 4; z -= 16) { const gy = heightAt(px + 1.3, z); const lp = new THREE.Group(); lp.position.set(px + 1.3, gy, z); town.add(lp); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6), toon(0x4a4a4e)); pole.position.y = 1.7; pole.castShadow = true; lp.add(pole); const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), litHead); head.position.y = 3.5; lp.add(head) }
      // ベンチ（川を向く＝-x側を向く）
      for (let z = 4; z > zEnd + 6; z -= 22) { const gy = heightAt(px + 0.6, z); const bg = new THREE.Group(); bg.position.set(px + 0.6, gy, z); bg.rotation.y = -Math.PI / 2; town.add(bg); const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.46), toon(0x8a6a48)); seat.position.y = 0.46; seat.castShadow = true; bg.add(seat); const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.36, 0.1), toon(0x8a6a48)); back.position.set(0, 0.72, -0.2); bg.add(back) }
      // 並木（町側の縁。川沿いの立ち木）
      for (let z = 9; z > zEnd; z -= 9) tree(px + 2.7, z, 0.8 + R() * 0.5)
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
      const rowR = R() // 段ごとの作付けの素＝同じ段は似た材になり「棚田が段で揃う」。市松のばらつき(散漫なタイル感)を脱す
      for (let px = -11; px <= 11; px += 5.6) {
        const jx = (R() - 0.5) * 0.5
        const gy = heightAt(px + jx, pz)
        const r = rowR * 0.64 + R() * 0.36 // 段の傾向6.4割＋区画ごとのゆらぎ＝段で揃いつつ単調にならない
        const w = 5.28 + R() * 0.28 // 区画を広げ隙間を詰める（5.6格子にほぼ接する＝割れたタイルの隙間を消す）
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
      const pos = [], uv = [], col = []
      for (const v of tri) {
        pos.push(v[0], v[1], v[2]); uv.push((v[0] / baseW + 0.5) * 2.0, 0.85 - v[1] / h * 0.8) // 茅の縦筋が勾配を下る
        const f = 0.8 + (v[1] / h) * 0.34; col.push(f, f, f) // 軒=翳り0.8→大棟=明1.14の縦グラデ（大屋根に量感を出す。vertexColors材のみ反映）
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
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
      const tcx = tc.getContext('2d'); const tb = new THREE.Color(0x564a2e) // 深い茅色（陽で起きてちょうど麦藁色に。淡い合板感を脱す）
      tcx.fillStyle = '#' + tb.getHexString(); tcx.fillRect(0, 0, 64, 64)
      // 横の茅の段（葺き重ねた束の段＝段の下に影、すぐ上に束の照り）＝合板でなく「葺いた茅」に読ませる
      for (let y = 7; y < 64; y += 12) {
        tcx.fillStyle = 'rgba(38,30,16,0.5)'; tcx.fillRect(0, y, 64, 2.6)          // 段の影
        tcx.fillStyle = 'rgba(150,128,84,0.32)'; tcx.fillRect(0, y + 2.6, 64, 1.7) // 束の照り
      }
      // 縦の茅の筋（葺きおろし）
      for (let i = 0; i < 120; i++) { const col = tb.clone().offsetHSL((R() - 0.5) * 0.02, (R() - 0.5) * 0.06, (R() - 0.5) * 0.26); tcx.strokeStyle = '#' + col.getHexString(); tcx.lineWidth = 0.5 + R() * 1.3; tcx.globalAlpha = 0.42; const lx = R() * 64; tcx.beginPath(); tcx.moveTo(lx, 0); tcx.lineTo(lx + (R() - 0.5) * 4, 64); tcx.stroke() }
      tcx.globalAlpha = 1
      const thatchTex = new THREE.CanvasTexture(tc); thatchTex.wrapS = thatchTex.wrapT = THREE.RepeatWrapping; thatchTex.repeat.set(3, 2)
      const thatchMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: thatchTex, vertexColors: true })
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
    const farmRoof = [toon(0x6a6258), toon(0x7a5e50), toon(0x5e6a5c)].map((m) => { m.vertexColors = true; return m }) // 寄棟の縦グラデで瓦屋根にも量感
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
    // ── 朝靄（谷戸の朝・棚田とせせらぎに低くたなびく霧の薄衣）。大きく柔らかい横長スプライトを谷底に低く敷く。
    // 谷戸の朝の情景の核。やわらかい白の薄veil＝近景の硬い造形を少し溶かし、霞(fog)と地続きの大気感を出す。冬は省略（雪で別の趣）。
    if (weather !== 'snow') {
      const mc = document.createElement('canvas'); mc.width = mc.height = 64
      const mx = mc.getContext('2d')
      const mg = mx.createRadialGradient(32, 32, 1, 32, 32, 31)
      mg.addColorStop(0, 'rgba(255,255,255,0.55)'); mg.addColorStop(0.5, 'rgba(255,255,255,0.22)'); mg.addColorStop(1, 'rgba(255,255,255,0)')
      mx.fillStyle = mg; mx.fillRect(0, 0, 64, 64)
      const mistTex = new THREE.CanvasTexture(mc)
      const mistTint = skyHorizon.clone().lerp(new THREE.Color(0xffffff), 0.55).getHex() // 朝の地平色を含む淡い白
      const nMist = LIGHT ? 6 : 11
      for (let i = 0; i < nMist; i++) {
        const mxp = (R() - 0.5) * 24, mz = -43 + R() * 46
        const gy = heightAt(mxp, mz)
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: mistTint, transparent: true, opacity: 0.13 + R() * 0.1, depthWrite: false, fog: true }))
        spr.position.set(mxp, gy + 1.5 + R() * 1.4, mz)
        spr.scale.set(15 + R() * 11, 6.5 + R() * 4, 1)
        scene.add(spr)
      }
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

  // ── 熱気球（空をゆっくり漂う）。街・湾の上空に。眺めの楽しみ。街のみ。 ──
  if (kind !== 'yato') {
    balloons = []
    const stripeSets = [['#d8584a', '#f0ece0'], ['#3a8ac0', '#f0d040'], ['#e0a030', '#6fae8f']]
    const spots = [[2, -34, 30, 42], [72, -42, 18, 38]] // [cx, cz, rad, y]
    for (let i = 0; i < spots.length; i++) {
      const g = new THREE.Group()
      const cols = stripeSets[i % stripeSets.length]
      const ec = document.createElement('canvas'); ec.width = 64; ec.height = 16; const ecx = ec.getContext('2d')
      for (let s = 0; s < 16; s++) { ecx.fillStyle = s % 2 ? cols[0] : cols[1]; ecx.fillRect(s * 4, 0, 4, 16) }
      const etex = new THREE.CanvasTexture(ec); etex.wrapS = etex.wrapT = THREE.RepeatWrapping
      const envMat = new THREE.MeshToonMaterial({ map: etex, gradientMap: grad, fog: true })
      const env = new THREE.Mesh(new THREE.SphereGeometry(4, 18, 14), envMat); env.scale.y = 1.22; env.position.y = 0.5; env.castShadow = true; g.add(env)
      const neck = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.2, 14), envMat); neck.position.y = -4.0; g.add(neck)
      const basket = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 1.5), toon(0x8a6a48)); basket.position.y = -6.6; basket.castShadow = true; g.add(basket)
      for (const cz2 of [-0.6, 0.6]) for (const cx2 of [-0.6, 0.6]) { const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 4), new THREE.MeshBasicMaterial({ color: 0x6a6258, fog: true })); cord.position.set(cx2, -5.1, cz2); g.add(cord) }
      if (duskAmt > 0.2) { const flame = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffb060, fog: true })); flame.position.y = -5.4; g.add(flame) } // バーナーの炎
      g.position.set(spots[i][0], heightAt(spots[i][0], spots[i][1]) + spots[i][3], spots[i][1])
      g.userData = { cx: spots[i][0], cz: spots[i][1], rad: spots[i][2], y: heightAt(spots[i][0], spots[i][1]) + spots[i][3], ph: i * 2.1, sp: 0.035 + i * 0.012 }
      scene.add(g); balloons.push(g)
    }
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
      if (!LIGHT && i % 2 === 0) { const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.34, 3, 6), toon([0x5a78a0, 0xc06a6a, 0x6a8a5a][i % 3])); rider.position.set((R() - 0.5) * 0.4, -0.1, 0.3); gond.add(rider); const rh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 6), toon(0xf0c49c)); rh.position.set(rider.position.x, 0.32, 0.3); gond.add(rh) } // 乗客
      if (duskAmt > 0.25) { const lit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.05), litMat); lit.position.z = 0.83; gond.add(lit) }
      wheel.add(gond); gondolas.push(gond)
    }
    // 夕夜の電飾（リムに沿う豆電球＋ハブ＋スポークの灯り。車輪と一緒に回って瞬く）
    if (duskAmt > 0.25) {
      const bulbA = new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: true }), bulbB = new THREE.MeshBasicMaterial({ color: 0xff9a6a, fog: true }), bulbC = new THREE.MeshBasicMaterial({ color: 0x86c0e8, fog: true })
      const NB = LIGHT ? 20 : 40 // 非力端末は電飾を半分に
      // 豆電球を色ごとに1メッシュへ統合（車輪と一緒に回る。ドローコール削減）
      const gA = [], gB = [], gC = [], ball = new THREE.SphereGeometry(0.17, 6, 6)
      for (let i = 0; i < NB; i++) { const a = i / NB * 6.283; const b = ball.clone(); b.translate(Math.cos(a) * R0, Math.sin(a) * R0, 0.22); [gA, gB, gC][i % 3].push(b) }
      const hubG = new THREE.SphereGeometry(0.5, 8, 8); hubG.translate(0, 0, 0.3); gA.push(hubG)
      if (!LIGHT) { const sball = new THREE.SphereGeometry(0.12, 6, 6); for (let i = 0; i < N; i++) { const a = (i / N) * 6.283; const s = sball.clone(); s.translate(Math.cos(a) * R0 * 0.52, Math.sin(a) * R0 * 0.52, 0.22); gA.push(s) } }
      for (const [geos, mat] of [[gA, bulbA], [gB, bulbB], [gC, bulbC]]) { if (geos.length && BufferGeometryUtils.mergeGeometries) { const m = BufferGeometryUtils.mergeGeometries(geos, false); if (m) wheel.add(new THREE.Mesh(m, mat)); geos.forEach((g) => g.dispose()) } }
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
  // 雪は一面の明るい空＝トゥーンの陰影で雲底が暗く落ちると「重い灰の天井」に見える。雪天だけ陰影を持たない
  // フラット材(MeshBasic)にし、淡い白〜冷灰のやわらかな曇り空に溶かす（積雲の翳りは晴天/夜のみ）。
  const SNOWY = weather === 'snow'
  const mkCloud = (col) => SNOWY ? new THREE.MeshBasicMaterial({ color: col, fog: false }) : new THREE.MeshToonMaterial({ color: col, gradientMap: grad, fog: false })
  const cloudMat = mkCloud(SNOWY ? 0xf6f4f0 : 0xfbfaf6)       // 陽の当たる白（雪天は少し落として白飛びを抑える）
  const cloudBot = mkCloud(isNight ? 0x767e92 : (SNOWY ? 0xe6e9ee : 0xe9e4dc)) // 影になる雲底（やわらかな陰。雪天は淡い冷灰でほぼ均一＝明るい空に溶ける）
  // 雲は高い空に置く（街を見渡す巡航高度の上）。低いと飛んで街を見渡す時に雲が邪魔になる（実機FB）。
  // 高くしても窓辺で見上げれば見え、ぐっと高く飛べば雲に分け入れる＝双方の良いとこ取り。light端末は控えめ。
  // 積雲を全世界(現代＋江戸/戦国/大正の空＋渡りの空)に散らす。地域でほのかに色を変える(戦国=冷/大正=暖)。
  const cumN = LIGHT ? 16 : 26
  for (let i = 0; i < cumN; i++) {
    const g = new THREE.Group()
    const n = 5 + ((R() * 4) | 0) // 5〜8房＝もこもこの積雲
    const region = i % 5
    let cx, cz, topMat = cloudMat
    if (region === 0) { cx = (R() - 0.5) * 260; cz = -40 - R() * 120 }                                                          // 現代の空
    else if (region === 1) { cx = EDO.x + (R() - 0.5) * 250; cz = EDO.z + (R() - 0.5) * 210 }                                    // 江戸の空
    else if (region === 2) { cx = SENGOKU.x + (R() - 0.5) * 200; cz = SENGOKU.z + (R() - 0.5) * 200; topMat = mkCloud(isNight ? 0x6c7488 : 0xdfe2ea) } // 戦国＝冷たく重い雲
    else if (region === 3) { cx = TAISHO.x + (R() - 0.5) * 220; cz = TAISHO.z + (R() - 0.5) * 200; topMat = mkCloud(isNight ? 0x8a7a82 : 0xf4e7d6) } // 大正＝暖かなセピアの雲
    else { cx = (R() - 0.5) * 940; cz = -150 - R() * 360 }                                                                       // 渡りの空（広く低く）
    for (let j = 0; j < n; j++) {
      const s = 4 + R() * 7, up = Math.pow(R(), 0.6) // 上ほど房が多い＝盛り上がる頂・底は平ら
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), up < 0.25 ? cloudBot : topMat)
      puff.position.set((R() - 0.5) * 24, up * 7, (R() - 0.5) * 11); puff.scale.y = 0.58; g.add(puff)
    }
    g.position.set(cx, 54 + R() * 34, cz)
    scene.add(g); clouds.push(g)
  }
  // 巻雲（cirrus）＝高い空の薄い刷毛のような筋雲（晴天/夕。雨雪では出さない）。平たく細長く淡い＝空に高さと多様さ。
  if (!SNOWY && weather !== 'rain') {
    const ciN = LIGHT ? 6 : 11, ciMat = mkCloud(isNight ? 0x8088a0 : 0xf4f1ea)
    for (let i = 0; i < ciN; i++) {
      const g = new THREE.Group(), n = 4 + ((R() * 4) | 0)
      for (let j = 0; j < n; j++) { const s = 5 + R() * 9, wisp = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), ciMat); wisp.position.set((R() - 0.5) * 40, 0, (R() - 0.5) * 6); wisp.scale.set(1.7, 0.16, 0.5); g.add(wisp) }
      g.position.set((R() - 0.5) * 920, 98 + R() * 20, -120 - R() * 340); g.rotation.y = R() * 3; scene.add(g); clouds.push(g)
    }
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
  // バス（街道を走る大型車。クリーム＋緑帯・夜は室内灯）。cars に混ぜて同じ流れで走る。
  for (let b = 0; b < 2; b++) {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new RoundedBoxGeometry(2.0, 2.3, 6.6, 2, 0.3), toon(0xe8e2d0)); body.position.y = 1.3; body.castShadow = true; g.add(body)
    const belt = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.42, 6.62), toon(0x4a8a5a)); belt.position.y = 0.95; g.add(belt)
    const win = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.72, 5.6), glassMat); win.position.y = 1.7; g.add(win)
    const roof = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.2, 6.4, 1, 0.1), toon(0xe8e2d0)); roof.position.y = 2.45; roof.castShadow = true; g.add(roof)
    for (const wx of [-0.95, 0.95]) for (const wz of [-2.1, 2.1]) { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 12), wheelMat); wheel.rotation.z = Math.PI / 2; wheel.position.set(wx, 0.42, wz); g.add(wheel) }
    const dir = b === 0 ? 1 : -1
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 0.08), new THREE.MeshBasicMaterial({ color: 0xc23a2c, fog: true })); tail.position.set(0, 0.8, dir > 0 ? 3.34 : -3.34); g.add(tail)
    if (duskAmt > 0.2) { const light = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: true })); light.position.set(0, 0.78, dir > 0 ? -3.34 : 3.34); g.add(light); const inl = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 5.4), new THREE.MeshBasicMaterial({ color: 0xffe0a0, fog: true })); inl.position.y = 1.7; g.add(inl) }
    g.userData = { dir, lane: dir > 0 ? -1.7 : 1.7, speed: 5 + R() * 2, z: -90 + R() * 120 }
    town.add(g); cars.push(g)
  }
  // 駅前のロータリー（島・植栽）＋バス停（上屋・ベンチ・丸看板）。駅(34,-44)の手前。
  {
    const rx = 31, rz = -36, ry = heightAt(rx, rz)
    const curb = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.28, 6, 20), toon(0xb6b0a4)); curb.rotation.x = Math.PI / 2; curb.position.set(rx, ry + 0.22, rz); town.add(curb)
    const isle = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.32, 20), toon(season === 'spring' ? 0x7a9a4e : season === 'autumn' ? 0x9a8048 : 0x6e8a4e)); isle.position.set(rx, ry + 0.16, rz); isle.receiveShadow = true; town.add(isle)
    tree(rx, rz, 1.2 + R() * 0.3)
    const stopX = rx - 5.5, stopZ = rz - 1, sgy = heightAt(stopX, stopZ)
    const sg = new THREE.Group(); sg.position.set(stopX, sgy, stopZ); town.add(sg)
    const proof = new THREE.Mesh(new THREE.BoxGeometry(3, 0.16, 1.6), toon(0x6a8a9a)); proof.position.set(0, 2.6, 0); proof.castShadow = true; sg.add(proof)
    for (const px of [-1.2, 1.2]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), toon(0x8a8680)); post.position.set(px, 1.3, -0.6); sg.add(post) }
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.4), toon(0x8a6a48)); bench.position.set(0, 0.5, -0.5); sg.add(bench)
    const signpost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), toon(0x8a8680)); signpost.position.set(1.7, 1.2, 0.5); sg.add(signpost)
    const sign = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 16), new THREE.MeshBasicMaterial({ color: 0xf0ece0 })); sign.rotation.x = Math.PI / 2; sign.position.set(1.7, 2.4, 0.5); sg.add(sign)
    colliders.push({ x: rx, z: rz, r: 3.2 })
  }

  // ── 歩く住民（歩道を行き交う人影）＋ランドマークの賑わい。脚・腕のある中品質に底上げ（近景=walk/低空で映える）。──
  const peepCols = [0x5a78a0, 0xc06a6a, 0x6a8a5a, 0xb0a060, 0x8a6aa0, 0xd0d0c8, 0x4a5560, 0xcf6f93, 0xd0904e]
  const pantsCols = [0x3a3a44, 0x4a4036, 0x33414e, 0x46342e, 0x55504a], hairCols = [0x2a221c, 0x1e1a16, 0x3a2e24, 0x4c3727, 0x6b5038]
  const skinCols = [0xf0c49c, 0xf6d2b0, 0xe8b489]
  const makePeep = () => {
    const g = new THREE.Group()
    const pm = toon(pantsCols[(R() * pantsCols.length) | 0]), tm = toon(peepCols[(R() * peepCols.length) | 0]), hm = toon(hairCols[(R() * hairCols.length) | 0]), sm = toon(skinCols[(R() * skinCols.length) | 0])
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.62, 6), pm); leg.position.set(s * 0.11, 0.4, 0); leg.castShadow = true; g.add(leg) } // 2本の脚
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.54, 8), tm); torso.position.y = 0.98; torso.castShadow = true; g.add(torso) // 胴
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), tm); shoulder.position.y = 1.18; shoulder.scale.set(1.1, 0.6, 0.8); g.add(shoulder) // 肩
    for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.5, 6), tm); arm.position.set(s * 0.28, 0.94, 0); arm.rotation.z = s * 0.07; arm.castShadow = true; g.add(arm) } // 腕
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), sm); head.position.y = 1.42; head.scale.set(0.96, 1.04, 0.96); g.add(head)
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.215, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.66), hm); hair.position.set(0, 1.45, -0.015); g.add(hair) // 髪（上＋後ろ。顔は出す）
    g.scale.setScalar(0.86 + R() * 0.28) // 背丈の個体差（子供〜大人）
    return g
  }
  peeps = []
  for (let i = 0; i < (LIGHT ? 6 : 11); i++) {
    const g = makePeep()
    const dir = (i % 2 === 0) ? 1 : -1
    g.userData = { dir, x: (dir > 0 ? -3.0 : 3.0) + (R() - 0.5), speed: 1.1 + R() * 0.8, z: -85 + R() * 105, ph: R() * 6.28 }
    town.add(g); peeps.push(g)
  }
  // ランドマークの賑わい（駅前・商店街・川辺・公園に人が集う。その場でゆっくり佇み・体の向きを変える）。
  const crowdSpots = [
    { x: STATION.x, z: STATION.z + STATION.r - 1.5, n: 5, rad: 3.2 }, // 駅前の広場
    { x: STATION.x, z: STATION.z - 4.6, n: 5, rad: 3.4 },             // 駅のホーム（電車を待つ人）
    { x: 0, z: -14, n: 4, rad: 2.6 },                                 // 商店街のゲート下
    { x: 0, z: -28, n: 5, rad: 3.0 },                                 // 商店街の通り（買い物客）
    { x: -45.5, z: -17, n: 3, rad: 2.4 },                             // 川辺（東岸の遊歩道）
    { x: 14, z: -19, n: 4, rad: 2.4 },                                // 公園の池のほとり
    { x: TEMPLE.x, z: TEMPLE.z + 7, n: 4, rad: 2.6 },                 // 寺の参道
    { x: SCHOOL.x, z: SCHOOL.z + 6, n: 4, rad: 3.0 },                 // 学校の校庭
    { x: FUN.x, z: FUN.z + 9, n: 5, rad: 3.0 },                       // 遊園地のゲート前
    { x: 73, z: -34, n: 3, rad: 2.6 },                                // 砂浜（海辺の人）
    { x: HARBOR.x - 2, z: HARBOR.z + 1, n: 3, rad: 3.0 },             // 港（働く人）
    { x: -47, z: -42, n: 2, rad: 2.2 },                               // 川辺の遊歩道（南寄り）
    { x: DOWNTOWN.x, z: DOWNTOWN.z + 8, n: 6, rad: 4.2 },             // 副都心の駅前広場（通勤の人波）
    { x: DOWNTOWN.x - 10, z: DOWNTOWN.z - 6, n: 4, rad: 3.2 },        // 副都心の通り
    { x: STADIUM.x, z: STADIUM.z + 18, n: 6, rad: 4.4 },             // 競技場のゲート前（観客）
  ]
  for (const s of crowdSpots) for (let i = 0; i < (LIGHT ? Math.ceil(s.n * 0.5) : s.n); i++) {
    const g = makePeep()
    const hx = s.x + (R() - 0.5) * s.rad * 1.4, hz = s.z + (R() - 0.5) * s.rad * 1.4
    g.userData = { loiter: true, hx, hz, rad: 0.3 + R() * 0.6, ph: R() * 6.28, sp: 0.3 + R() * 0.4, face: R() * 6.28 }
    g.position.set(hx, heightAt(hx, hz), hz)
    town.add(g); peeps.push(g)
  }
  // ── 作り込んだ住人（顔つき・アニメ調）。近景で映える要所に少数（猫と同じ「基本図形＋トゥーン＋顔」）。──
  const RES_SKIN = [0xf7d8bc, 0xfadcc2, 0xf2cda8, 0xf6d4b4] // 明るくミルキーな肌（トゥーンの陰側が暗く落ちるので地色は明るめが正解）
  const RES_HAIR = [0x2a221c, 0x1d1916, 0x3a2a1e, 0x4c3727, 0x6b5038, 0x2c2c32]
  const RES_TOP = [0x5a78a0, 0xbf6a6a, 0x6a8a5a, 0xb0a060, 0x8a6aa0, 0xd8d4cc, 0x495560, 0xd0904e, 0xcf6f93]
  const RES_BOT = [0x39414e, 0x4a4036, 0x2e3640, 0x55504a, 0x6a3a3a, 0x40506a]
  const RES_IRIS = [0x5a86c2, 0x5a9e60, 0xb88a3e, 0x9a6238, 0x7a5aa8] // 明るい瞳（青/緑/琥珀/茶/菫）＝白目と明るい虹彩で目を開いて見せる
  // 住人の接地影（足元に柔らかな影＝人形の浮きを消し、地に立たせる）
  const resShadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 48; const x = c.getContext('2d'); const grd = x.createRadialGradient(24, 24, 1, 24, 24, 24); grd.addColorStop(0, 'rgba(0,0,0,0.42)'); grd.addColorStop(0.6, 'rgba(0,0,0,0.2)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = grd; x.fillRect(0, 0, 48, 48); const t = new THREE.CanvasTexture(c); return t })()
  const resShadowMat = new THREE.MeshBasicMaterial({ map: resShadowTex, transparent: true, depthWrite: false, fog: true })
  const resShadowGeo = new THREE.PlaneGeometry(1, 1)
  const RES_OUTLINE = new THREE.MeshBasicMaterial({ color: 0x2a211c, side: THREE.BackSide, fog: true }) // セル画の黒い主線（裏面を法線方向に押し出す定番手法）
  const makeResident = (cfg = {}) => {
    // アニメ寄りだが人に近い：自然なアーモンドの目・一体感のある体・関節（膝/肘）・接地影。約6頭身。
    const g = new THREE.Group()
    const outfit = cfg.outfit || 'modern'
    const skin = toon(cfg.skin), hairM = toon(cfg.hair), topM = toon(cfg.top), botM = toon(cfg.bottom || cfg.top), shoeM = toon(cfg.shoe || 0x33302b)
    skin.emissive = new THREE.Color(cfg.skin); skin.emissiveIntensity = 0.16 // 顔が影側でも暗く沈まないよう肌をわずかに自己発光（のっぺりさせず読める明るさに）
    const white = new THREE.MeshBasicMaterial({ color: 0xf6f1ea, fog: true }), dark = toon(0x2c2622), irisM = toon(cfg.iris || 0x5a4632), mouthM = toon(0xc08274), browM = toon(cfg.hair), blush = toon(0xe2a596)
    const accentM = toon(cfg.accent || 0x8a6a3a) // 帯・襟・差し色
    const SP = (r, w, h) => new THREE.SphereGeometry(r, w || 16, h || 14), CY = (a, b, h, s) => new THREE.CylinderGeometry(a, b, h, s || 16), BX = (w, h, d) => new THREE.BoxGeometry(w, h, d)
    const add = (p, geo, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sx !== undefined) m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz); m.castShadow = true; p.add(m); return m }
    // ── 一体の連続メッシュ：断面リング(楕円)を滑らかにつなぐ＝球の寄せ集めでない「一枚の体・手足」。──
    const outlineList = [] // 黒い主線を付ける主要メッシュ（シルエット）
    const loft = (rings, mat, parent, noOutline) => { const N = 14, vp = [], idx = []
      for (const r of rings) for (let j = 0; j < N; j++) { const a = (j / N) * Math.PI * 2; vp.push((r.x || 0) + Math.cos(a) * r.rx, r.y, (r.z || 0) + Math.sin(a) * (r.rz || r.rx)) }
      for (let i = 0; i < rings.length - 1; i++) { const a0 = i * N, a1 = (i + 1) * N; for (let j = 0; j < N; j++) { const jn = (j + 1) % N; idx.push(a0 + j, a1 + j, a0 + jn, a0 + jn, a1 + j, a1 + jn) } } // 外向き
      const cap = (r, dir, base) => { const c = vp.length / 3; vp.push(r.x || 0, r.y + dir * Math.max(r.rx, r.rz || r.rx) * 0.85, r.z || 0); for (let j = 0; j < N; j++) { const jn = (j + 1) % N; if (dir > 0) idx.push(base + j, base + jn, c); else idx.push(base + jn, base + j, c) } }
      cap(rings[0], -1, 0); cap(rings[rings.length - 1], 1, (rings.length - 1) * N)
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3)); geo.setIndex(idx); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m); if (!noOutline) outlineList.push(m); return m }
    // 黒い主線＝メッシュの裏面を法線方向に押し出した複製。関節がズレないよう各メッシュごとに作る。
    const addOutlines = (amt) => { for (const m of outlineList) { const g2 = m.geometry.clone(); const pos = g2.attributes.position, nor = g2.attributes.normal
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + nor.getX(i) * amt, pos.getY(i) + nor.getY(i) * amt, pos.getZ(i) + nor.getZ(i) * amt)
      const om = new THREE.Mesh(g2, RES_OUTLINE); om.position.copy(m.position); om.quaternion.copy(m.quaternion); om.scale.copy(m.scale); om.renderOrder = -1; m.parent.add(om) } }
    const arms = [], legs = []
    // 腕＝肩→肘→手首の滑らかな一本のテーパー（少し前へ＝自然）＋手。肩で振れる。
    const buildArms = (sleeveMat, wide) => { const asym = (Math.random() - 0.5) * 0.12; for (const s of [-1, 1]) { const armG = new THREE.Group(); armG.position.set(s * 0.165, 1.36, 0); g.add(armG) // 肩端の少し下＝肩の出っぱりを抑える
      if (wide) loft([{ y: 0.02, rx: 0.08 }, { y: -0.18, rx: 0.09 }, { y: -0.36, rx: 0.07 }, { y: -0.47, rx: 0.05 }], sleeveMat, armG) // 着物の袖
      else { loft([{ y: 0.03, rx: 0.05 }, { y: -0.16, rx: 0.045, z: 0.01 }, { y: -0.31, rx: 0.04, z: 0.05 }, { y: -0.47, rx: 0.036, z: 0.085 }], sleeveMat, armG); add(armG, SP(0.038), skin, 0, -0.57, 0.1, 1, 1, 1.3) } // 肘で前へ曲げ・手は縦長に
      armG.rotation.z = s * 0.12; armG.userData = { base: (s > 0 ? asym : -asym) }; arms.push(armG) } } // 左右でわずかに角度差＝非対称（人形臭を消す）
    // 脚＝腰→膝→足首の滑らかな一本のテーパー＋足。股関節で振れる。
    const buildLegs = (legMat, rad) => { for (const s of [-1, 1]) { const legG = new THREE.Group(); legG.position.set(s * 0.078, 0.92, 0); g.add(legG)
      loft([{ y: 0.05, rx: rad * 1.22 }, { y: -0.2, rx: rad }, { y: -0.4, rx: rad * 0.9, z: 0.012 }, { y: -0.6, rx: rad * 0.82, z: 0.02 }, { y: -0.8, rx: rad * 0.72, z: 0.02 }], legMat, legG); add(legG, SP(0.055), shoeM, 0, -0.84, 0.06, 1.45, 0.5, 1.95); legs.push(legG) } }
    // ── 体（衣装別。胴は一体のロフトで人体の一枚の形に）──
    if (outfit === 'kimono' || outfit === 'armor') {
      loft([{ y: 0.06, rx: 0.2, rz: 0.16 }, { y: 0.5, rx: 0.17, rz: 0.14 }, { y: 0.9, rx: 0.15, rz: 0.12 }, { y: 1.2, rx: 0.152, rz: 0.116 }, { y: 1.42, rx: 0.172, rz: 0.118 }, { y: 1.47, rx: 0.085, rz: 0.072 }], topM, g) // 着物の身頃（裾広がりの一枚）
      add(g, CY(0.158, 0.152, 0.1, 18), accentM, 0, 0.9, 0) // 帯
      for (const s of [-1, 1]) add(g, BX(0.04, 0.4, 0.02), white, s * 0.038, 1.2, 0.12).rotation.z = -s * 0.3 // 襟
      for (const s of [-1, 1]) add(g, SP(0.057), shoeM, s * 0.06, 0.05, 0.05, 1.4, 0.5, 1.9) // 足
      buildArms(topM, true)
      if (outfit === 'armor') { loft([{ y: 0.86, rx: 0.185, rz: 0.155 }, { y: 1.08, rx: 0.2, rz: 0.165 }, { y: 1.3, rx: 0.185, rz: 0.155 }], botM, g) // 胴丸（胸当て）
        for (const s of [-1, 1]) add(g, SP(0.088, 12, 10), botM, s * 0.165, 1.4, 0, 1, 0.82, 0.9) } // 肩の防具
    } else if (outfit === 'hakama') {
      loft([{ y: 0.9, rx: 0.16, rz: 0.13 }, { y: 1.18, rx: 0.152, rz: 0.116 }, { y: 1.42, rx: 0.168, rz: 0.116 }, { y: 1.47, rx: 0.085, rz: 0.072 }], topM, g) // 上衣
      loft([{ y: 0.06, rx: 0.225, rz: 0.17 }, { y: 0.4, rx: 0.2, rz: 0.155 }, { y: 0.78, rx: 0.17, rz: 0.135 }, { y: 0.93, rx: 0.16, rz: 0.128 }], botM, g) // 袴（下が広い）
      add(g, CY(0.165, 0.225, 0.09, 18), accentM, 0, 0.86, 0) // 帯
      for (const s of [-1, 1]) add(g, SP(0.057), shoeM, s * 0.06, 0.05, 0.05, 1.4, 0.5, 1.9)
      buildArms(topM, true)
    } else if (outfit === 'dress') {
      buildLegs(skin, 0.05) // 脚
      loft([{ y: 0.1, rx: 0.235, rz: 0.18 }, { y: 0.5, rx: 0.155, rz: 0.125 }, { y: 0.86, rx: 0.125, rz: 0.1 }, { y: 1.1, rx: 0.12, rz: 0.095 }, { y: 1.3, rx: 0.138, rz: 0.1 }, { y: 1.42, rx: 0.155, rz: 0.105 }, { y: 1.47, rx: 0.08, rz: 0.07 }], topM, g) // ワンピース（裾広がり〜くびれ〜肩の一枚）
      add(g, CY(0.124, 0.124, 0.05, 16), accentM, 0, 1.0, 0) // ウエスト
      buildArms(topM, false)
    } else if (outfit === 'blouse') { // 添付の模倣: 白い半袖ブラウス＋濃色ハイウエストのワイドパンツ＋肩紐
      buildLegs(botM, 0.084)
      loft([{ y: 0.74, rx: 0.15, rz: 0.12 }, { y: 0.95, rx: 0.145, rz: 0.115 }, { y: 1.1, rx: 0.135, rz: 0.105 }], botM, g) // ハイウエストのパンツ
      loft([{ y: 1.07, rx: 0.13, rz: 0.1 }, { y: 1.22, rx: 0.135, rz: 0.102 }, { y: 1.34, rx: 0.155, rz: 0.108 }, { y: 1.42, rx: 0.182, rz: 0.112 }, { y: 1.47, rx: 0.085, rz: 0.072 }], topM, g) // 白ブラウス（主役）
      for (const s of [-1, 1]) add(g, BX(0.024, 0.32, 0.025), botM, s * 0.07, 1.26, 0.095).rotation.z = s * 0.03 // 肩紐
      buildArms(topM, false)
    } else { // modern / suit
      buildLegs(botM, 0.07)
      loft([{ y: 0.74, rx: 0.155, rz: 0.115 }, { y: 0.95, rx: 0.138, rz: 0.103 }, { y: 1.07, rx: 0.126, rz: 0.097 }], botM, g) // 腰〜パンツ
      loft([{ y: 1.04, rx: 0.125, rz: 0.096 }, { y: 1.18, rx: 0.124, rz: 0.095 }, { y: 1.33, rx: 0.16, rz: 0.11 }, { y: 1.43, rx: 0.21, rz: 0.118 }, { y: 1.47, rx: 0.085, rz: 0.075 }], topM, g) // 胴（肩を広く＝撫で肩を解消・腰くびれの一枚）
      if (outfit === 'suit') add(g, BX(0.04, 0.3, 0.02), accentM, 0, 1.24, 0.1) // ネクタイ
      buildArms(topM, false)
    }
    add(g, CY(0.05, 0.054, 0.16, 12), skin, 0, 1.45, 0) // 首（少し長く＝頭が肩にめり込まない）
    // ── 頭（小さめ＝約7頭身）＋顔（角のある輪郭：頭頂は丸く・こめかみ最大・顎へ細めて顎先を出す＝アニメの面） ──
    const headG = new THREE.Group(); headG.position.set(0, 1.6, 0); g.add(headG)
    loft([{ y: 0.1, rx: 0.038 }, { y: 0.06, rx: 0.093, rz: 0.088 }, { y: 0.0, rx: 0.104, rz: 0.095 }, { y: -0.05, rx: 0.093, rz: 0.087 }, { y: -0.097, rx: 0.063, rz: 0.073 }, { y: -0.13, rx: 0.028, rz: 0.046 }], skin, headG) // 角のある顔の輪郭
    for (const s of [-1, 1]) add(headG, SP(0.02), skin, s * 0.1, -0.012, 0.0, 0.7, 1, 0.7) // 耳
    const eyeM = toon(0x4a3a32) // 目は黒でなく濃茶＝硬さ/暗さを抑える
    for (const s of [-1, 1]) { // 小さくシンプルな目（層を重ねず：濃茶の小さなアーモンド＋虹彩＋キャッチライト）。ジブリ風の控えめな目。
      add(headG, SP(0.016, 14, 12), eyeM, s * 0.046, -0.006, 0.099, 1.45, 0.95, 0.35) // 目（小さな濃茶のアーモンド）
      add(headG, SP(0.0095, 12, 10), irisM, s * 0.046, -0.007, 0.104, 1.0, 1.0, 0.4)  // 虹彩（少し明るい芯）
      add(headG, SP(0.0046, 8, 8), white, s * 0.046 + s * 0.004, -0.001, 0.108)       // キャッチライト
      add(headG, BX(0.03, 0.005, 0.006), browM, s * 0.05, 0.036, 0.095).rotation.z = s * 0.1 // 細い眉
      add(headG, SP(0.014, 8, 8), blush, s * 0.07, -0.026, 0.085, 1.2, 0.7, 0.4) // 頬のほのかな赤み
    }
    add(headG, BX(0.008, 0.016, 0.01), skin, 0, -0.032, 0.105, 1, 1, 1).rotation.x = 0.2 // 鼻筋（控えめ）
    add(headG, BX(0.027, 0.009, 0.009), mouthM, 0, -0.066, 0.1)  // 口
    // ── 髪（hairStyle）。小さい頭に合わせた寸法 ──
    const hs = cfg.hairStyle
    if (hs === 'topknot') { add(headG, SP(0.113, 16, 14), hairM, 0, 0.012, -0.03, 1.02, 1.0, 1.0)
      add(headG, CY(0.026, 0.032, 0.07, 10), hairM, 0, 0.115, -0.012); add(headG, SP(0.04, 10, 8), skin, 0, 0.072, 0.08, 1.6, 0.5, 0.6) } // 髷＋月代
    else if (hs === 'bob') { add(headG, SP(0.125, 18, 16), hairM, 0, 0.0, -0.012, 1.04, 1.05, 1.05)
      for (const s of [-1, 1]) add(headG, SP(0.052, 12, 12), hairM, s * 0.108, -0.06, 0.014, 0.7, 1.5, 0.95)
      for (const [hx, hz] of [[-0.054, 0.085], [0.0, 0.097], [0.054, 0.085]]) add(headG, SP(0.038, 12, 10), hairM, hx, 0.068, hz, 1, 0.8, 0.8) }
    else if (hs === 'hat') { add(headG, SP(0.111, 14, 12), hairM, 0, 0.0, -0.032, 1.0, 0.9, 1.0) }
    else if (hs === 'short') { add(headG, SP(0.113, 16, 14), hairM, 0, 0.03, -0.012, 1.04, 0.95, 1.04)
      for (const [hx, hz] of [[-0.063, 0.083], [0.0, 0.095], [0.063, 0.083]]) add(headG, SP(0.029, 10, 8), hairM, hx, 0.075, hz, 1, 0.8, 0.8) }
    else { add(headG, SP(0.117, 18, 16), hairM, 0, 0.018, -0.032, 1.03, 1.03, 1.0)
      for (const [hx, hz] of [[-0.078, 0.074], [-0.037, 0.095], [0.0, 0.101], [0.037, 0.095], [0.078, 0.074]]) add(headG, SP(0.032, 12, 10), hairM, hx, 0.069, hz, 1, 0.9, 0.9)
      if ((hs | 0) === 1) add(headG, SP(0.063, 14, 12), hairM, 0, -0.086, -0.094, 1.1, 1.0, 0.9)
      else for (const s of [-1, 1]) add(headG, SP(0.045, 12, 12), hairM, s * 0.095, -0.043, -0.012, 0.7, 1.4, 0.9) }
    // ── 帽子（hat）。小さい頭に合わせ高さ・寸法を更新 ──
    if (cfg.hat === 'kasa') { add(g, CY(0.035, 0.28, 0.13, 16), toon(cfg.hatCol || 0xc6a866), 0, 1.72, 0) }
    else if (cfg.hat === 'jingasa') { add(g, CY(0.045, 0.24, 0.08, 16), toon(cfg.hatCol || 0x4a3a2c), 0, 1.71, 0) }
    else if (cfg.hat === 'fedora') { const hm = toon(cfg.hatCol || 0x3a322a); add(g, CY(0.155, 0.155, 0.018, 16), hm, 0, 1.685, 0); add(g, CY(0.095, 0.105, 0.11, 14), hm, 0, 1.745, 0) }
    else if (cfg.hat === 'cap') { const hm = toon(cfg.hatCol || 0x2a2e38); add(g, SP(0.122, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), hm, 0, 1.66, 0); add(g, BX(0.17, 0.022, 0.08), hm, 0, 1.645, 0.115) }
    // ── 小道具（prop） ──
    if (cfg.prop === 'swords') for (const [ln, yy] of [[0.56, 0.9], [0.4, 0.86]]) { const sw = add(g, CY(0.013, 0.013, ln, 6), toon(0x2a2620), -0.2, yy, -0.04); sw.rotation.z = 0.5; sw.rotation.x = -0.2 }
    else if (cfg.prop === 'spear') { add(g, CY(0.018, 0.018, 1.9, 6), toon(0x5a4632), 0.25, 0.92, -0.05); add(g, CY(0.0, 0.026, 0.15, 6), toon(0xb8bcc2), 0.25, 1.9, -0.05) }
    else if (cfg.prop === 'bundle') { add(g, SP(0.14, 12, 10), toon(cfg.accent || 0x8a6a4a), 0, 1.16, -0.18, 1, 1.1, 0.9) }
    else if (cfg.prop === 'cane') { add(g, CY(0.013, 0.013, 0.86, 6), toon(0x3a2e22), 0.25, 0.44, 0.12) }
    else if (cfg.prop === 'bag') { const bm = toon(cfg.bagCol || 0x8a7256) // 斜め掛けの鞄（添付の少女）
      const strap = add(g, BX(0.028, 0.52, 0.02), bm, 0, 1.18, 0.12); strap.rotation.z = 0.52 // たすき掛けの紐
      add(g, BX(0.17, 0.2, 0.08), bm, 0.2, 0.92, 0.07, 1, 1, 1).rotation.y = 0.1 } // 鞄本体（腰）
    addOutlines(0.009) // 体・手足・頭に黒い主線（セル画のライン）
    // 接地影（足元の柔らかな影＝人形の浮きを消して地に立たせる）
    const shadow = new THREE.Mesh(resShadowGeo, resShadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.03, 0.02); shadow.scale.set(0.5, 0.72, 1); shadow.renderOrder = 1; g.add(shadow)
    g.scale.setScalar((cfg.scale || 1) * (0.98 + R() * 0.12))
    g.userData = { arms, legs, headG }
    return g
  }
  // ── home（現代）の住人を要所に ──
  const residentSpots = [ { x: 0, z: -25 }, { x: STATION.x - 1.4, z: STATION.z + STATION.r - 1.2 }, { x: 13, z: -16 }, { x: -44, z: -18 }, { x: DOWNTOWN.x - 2, z: DOWNTOWN.z + 9 }, { x: 2, z: -30 } ]
  const placeResident = (hx, hz, cfg) => { const g = makeResident(cfg); const gy = heightAt(hx, hz); if (gy < SEA.level + 0.6) return; g.position.set(hx, gy, hz); const u = g.userData; u.ax = hx; u.az = hz; u.tx = hx; u.tz = hz; u.face = R() * 6.28; u.ph = R() * 6.28; u.pauseT = 0.5 + R() * 4; u.moving = false; u.speed = 0.66 + R() * 0.5; u.rad = 4 + R() * 5; g.rotation.y = u.face; town.add(g); residents.push(g) }
  const RES_MODERN = ['modern', 'modern', 'suit', 'blouse']
  for (const sp of residentSpots) placeResident(sp.x + (R() - 0.5) * 1.6, sp.z + (R() - 0.5) * 1.6, { skin: RES_SKIN[(R() * RES_SKIN.length) | 0], hair: RES_HAIR[(R() * RES_HAIR.length) | 0], top: RES_TOP[(R() * RES_TOP.length) | 0], bottom: RES_BOT[(R() * RES_BOT.length) | 0], iris: RES_IRIS[(R() * RES_IRIS.length) | 0], outfit: RES_MODERN[(R() * RES_MODERN.length) | 0], hairStyle: (R() * 3) | 0 })
  // ── 添付画像の模倣：港町の少女（白い半袖ブラウス＋濃色ハイウエストのワイドパンツ＋黒のショートボブ＋斜め掛けの鞄）。港・水辺・街角に。──
  const harborGirl = () => ({ skin: RES_SKIN[(R() * RES_SKIN.length) | 0], hair: [0x1d1916, 0x241c18, 0x2c2622][(R() * 3) | 0], iris: [0x3a2e26, 0x4a3a2c, 0x4a6a9a][(R() * 3) | 0], outfit: 'blouse', top: [0xf0ece2, 0xeae6da, 0xf2eee6][(R() * 3) | 0], bottom: [0x33373e, 0x2e3a42, 0x3a3530][(R() * 3) | 0], hairStyle: 'bob', prop: 'bag', bagCol: [0x8a7256, 0x6a5a44, 0x9a8460][(R() * 3) | 0] })
  for (const sp of [{ x: HARBOR.x - 3, z: HARBOR.z + 4 }, { x: 70, z: -38 }, { x: -43, z: -15 }, { x: 4, z: -27 }, { x: STATION.x + 2, z: STATION.z + STATION.r - 2 }]) placeResident(sp.x + (R() - 0.5) * 1.4, sp.z + (R() - 0.5) * 1.4, harborGirl())
  // ── 各エリア（時代）の住人を、装い・小道具を時代に合わせて量産（近景=walk/低空で映える） ──
  const pickC = (a) => a[(R() * a.length) | 0]
  const placeEra = (cx, cz, n, factory) => { for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832 + R() * 0.6, rr = 8 + R() * 22; placeResident(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr, factory()) } }
  // 江戸: 町人(着物+髷)・侍(甲冑+刀)・笠の行商
  const EDO_KIMONO = [0x3a4a5e, 0x5a4230, 0x55504a, 0x6a3a30, 0x44503a, 0x4a4a52, 0x70604a], EDO_OBI = [0x8a6a3a, 0x7a3a32, 0x55603a, 0x3a4250, 0x9a7a44]
  placeEra(EDO.x, EDO.z, 8, () => { const r = R(), skin = pickC(RES_SKIN), hair = pickC(RES_HAIR), iris = pickC(RES_IRIS)
    if (r < 0.24) return { outfit: 'armor', skin, hair, iris, hairStyle: 'topknot', top: pickC([0x3a3a44, 0x4a4038, 0x33414e]), bottom: pickC([0x55504a, 0x6a5238, 0x4a4a3a]), accent: pickC(EDO_OBI), prop: 'swords' } // 侍
    if (r < 0.46) return { outfit: 'kimono', skin, hair, iris, hairStyle: 'hat', hat: 'kasa', top: pickC(EDO_KIMONO), accent: pickC(EDO_OBI), prop: R() < 0.5 ? 'bundle' : null } // 笠の行商
    return { outfit: 'kimono', skin, hair, iris, hairStyle: r < 0.74 ? 'topknot' : 'short', top: pickC(EDO_KIMONO), accent: pickC(EDO_OBI) } }) // 町人
  // 大正: 書生(袴+学生帽)・モダンガール(洋装+ボブ)・洋装紳士(背広+中折れ帽)
  const TAI_DRESS = [0xb5677e, 0x6a8a9a, 0x9a7aa0, 0xc08a5a, 0x5a7a6a], TAI_SUIT = [0x3a3a42, 0x4a4036, 0x44484a, 0x55504a]
  placeEra(TAISHO.x, TAISHO.z, 8, () => { const r = R(), skin = pickC(RES_SKIN), hair = pickC(RES_HAIR), iris = pickC(RES_IRIS)
    if (r < 0.34) return { outfit: 'hakama', skin, hair, iris, hairStyle: 'hat', hat: 'cap', top: pickC([0x3a4250, 0x40443a, 0x4a4038]), bottom: pickC([0x2e3038, 0x35302c]), accent: 0x2a2e30 } // 書生
    if (r < 0.66) return { outfit: 'dress', skin, hair, iris, hairStyle: 'bob', top: pickC(TAI_DRESS), accent: pickC([0xf0e6d2, 0xeae0cc, 0x8a3a44]) } // モダンガール
    return { outfit: 'suit', skin, hair, iris, hairStyle: 'hat', hat: 'fedora', top: pickC(TAI_SUIT), bottom: pickC(TAI_SUIT), accent: pickC([0x7a3a32, 0x3a4a5e]), prop: R() < 0.5 ? 'cane' : null } }) // 紳士
  // 戦国: 農夫(笠+素朴な着物)・足軽(陣笠+甲冑+槍)・武者(甲冑+刀)
  const SEN_DRAB = [0x5a4c3a, 0x4a4a44, 0x44503a, 0x6a5a44, 0x504838]
  placeEra(SENGOKU.x, SENGOKU.z, 7, () => { const r = R(), skin = pickC(RES_SKIN), hair = pickC(RES_HAIR), iris = pickC(RES_IRIS)
    if (r < 0.36) return { outfit: 'armor', skin, hair, iris, hairStyle: 'hat', hat: 'jingasa', top: pickC([0x40382e, 0x3a3a34]), bottom: pickC([0x4a3a30, 0x3a4250, 0x55504a]), accent: 0x6a3a30, prop: 'spear' } // 足軽
    if (r < 0.58) return { outfit: 'armor', skin, hair, iris, hairStyle: 'topknot', top: pickC([0x3a3a40, 0x44382e]), bottom: pickC([0x6a3a30, 0x3a4a5e, 0x55503a]), accent: pickC([0x9a7a44, 0x7a3a32]), prop: 'swords' } // 武者
    return { outfit: 'kimono', skin, hair, iris, hairStyle: 'hat', hat: 'kasa', hatCol: 0xb8a060, top: pickC(SEN_DRAB), accent: pickC([0x5a4c3a, 0x4a4438]) } }) // 農夫
    const maxAniso = renderer.capabilities.getMaxAnisotropy()
    // ── 2.5D：3Dの人物を8方向に焼いて板ポリの絵にする（2Dの質感 × 3Dの整合・回転 × 板ポリの軽さ）──
    // 3Dを1体だけ作り、正射影で8方向から1枚ずつ描き出してテクスチャ化。実行時は見る角度に応じて該当方向の絵を見せる（紙人形/Doom方式）。
    const SPR_DIRS = 8, cellW = 200, cellH = 330
    const bakeScene = new THREE.Scene()
    bakeScene.add(new THREE.HemisphereLight(0xfff3e3, 0x6e665a, 1.18)) // 柔らかな全体光（どの世界の明るさにも馴染むよう平板めに）
    const bakeKey = new THREE.DirectionalLight(0xffffff, 0.5); bakeKey.position.set(0.35, 1.0, 0.95); bakeScene.add(bakeKey) // ほんのり前上から
    // 正射影の上下はカメラ基準。カメラを図の中央(y0.9)に置き、上下を±0.92にして world-y ≒ -0.02〜1.82 を写す（全身が収まる）。
    const bakeCam = new THREE.OrthographicCamera(-0.56, 0.56, 0.92, -0.92, 0.1, 12)
    bakeCam.position.set(0, 0.9, 5); bakeCam.lookAt(0, 0.9, 0)
    const bakeRT = new THREE.WebGLRenderTarget(cellW, cellH, { samples: LIGHT ? 0 : 4 })
    bakeRT.texture.colorSpace = THREE.SRGBColorSpace // オフスクリーンはlinearで貯まる→読み出してsRGBのcanvasに置くと暗くなる。sRGBで書き出させて見た目を合わせる
    const bakeFigureViews = (cfg) => {
      const fig = makeResident({ ...cfg, scale: 1 })
      const last = fig.children[fig.children.length - 1]; if (last && last.material === resShadowMat) fig.remove(last) // 接地影(共有資源)はベイクに含めない＝板ポリ側で別に付ける
      fig.scale.setScalar(1); fig.rotation.set(0, 0, 0); fig.position.set(0, 0, 0)
      bakeScene.add(fig)
      const prevRT = renderer.getRenderTarget(), prevA = renderer.getClearAlpha(), prevC = new THREE.Color(); renderer.getClearColor(prevC)
      renderer.setClearColor(0x000000, 0)
      const views = [], buf = new Uint8Array(cellW * cellH * 4)
      for (let d = 0; d < SPR_DIRS; d++) {
        fig.rotation.y = (d / SPR_DIRS) * Math.PI * 2 // d=0は正面（+z＝カメラ向き）／d=4は背面
        renderer.setRenderTarget(bakeRT); renderer.clear(); renderer.render(bakeScene, bakeCam)
        renderer.readRenderTargetPixels(bakeRT, 0, 0, cellW, cellH, buf)
        const cv = document.createElement('canvas'); cv.width = cellW; cv.height = cellH; const cx = cv.getContext('2d')
        const img = cx.createImageData(cellW, cellH)
        for (let y = 0; y < cellH; y++) { const sy = cellH - 1 - y; img.data.set(buf.subarray(sy * cellW * 4, (sy + 1) * cellW * 4), y * cellW * 4) } // GLは下が原点→上下反転
        cx.putImageData(img, 0, 0)
        const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; views.push(t)
      }
      renderer.setRenderTarget(prevRT); renderer.setClearColor(prevC, prevA)
      bakeScene.remove(fig)
      fig.traverse((o) => { if (o.geometry && o.geometry !== resShadowGeo) o.geometry.dispose(); if (o.material && o.material !== RES_OUTLINE && o.material !== resShadowMat) o.material.dispose() }) // 焼き終えたら破棄（共有資源は除く）
      return views
    }
    const makeFigureSprite = (views, facing) => {
      const mat = new THREE.MeshBasicMaterial({ map: views[0], transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, fog: true })
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.0), mat); m.position.y = 0.95
      const grp = new THREE.Group(); grp.add(m)
      const sh = new THREE.Mesh(resShadowGeo, resShadowMat); sh.rotation.x = -Math.PI / 2; sh.position.set(0, 0.03, 0.05); sh.scale.set(0.62, 0.84, 1); sh.renderOrder = 1; grp.add(sh) // 接地影で地に立たせる
      grp.userData = { spr: m, mat, views, facing: facing || 0, cur: 0 }
      return grp
    }
    try {
      // 港町の少女（添付の模倣：白い半袖ブラウス＋濃色ハイウエストのワイドパンツ＋黒ボブ＋斜め掛けの鞄）を数体ぶん焼き、街に配置。
      const harborGirlCfg = () => ({ skin: RES_SKIN[(R() * RES_SKIN.length) | 0], hair: [0x1d1916, 0x241c18, 0x2c2622][(R() * 3) | 0], iris: [0x3a2e26, 0x4a3a2c, 0x4a6a9a][(R() * 3) | 0], outfit: 'blouse', top: [0xf0ece2, 0xeae6da, 0xf2eee6][(R() * 3) | 0], bottom: [0x33373e, 0x2e3a42, 0x3a3530][(R() * 3) | 0], hairStyle: 'bob', prop: 'bag', bagCol: [0x8a7256, 0x6a5a44, 0x9a8460][(R() * 3) | 0] })
      const variants = []
      for (let i = 0; i < 4; i++) variants.push(bakeFigureViews(harborGirlCfg())) // 色違い4体＝「いろんな人が世界にいる」
      const SP_SPOTS = [{ x: HARBOR.x - 4, z: HARBOR.z + 5 }, { x: 6, z: -26 }, { x: -42, z: -16 }, { x: HARBOR.x + 9, z: HARBOR.z - 3 }, { x: 30, z: -40 }, { x: -18, z: 24 }]
      for (const sp of SP_SPOTS) { const hx = sp.x + (R() - 0.5) * 3, hz = sp.z + (R() - 0.5) * 3, gy = heightAt(hx, hz); if (gy < SEA.level + 0.6) continue
        const gr = makeFigureSprite(variants[(R() * variants.length) | 0], R() * 6.2832); gr.position.set(hx, gy, hz); town.add(gr); animeSprites.push(gr) }
    } catch (e) { /* ベイク不可の端末では人物を置かない（クラッシュ回避） */ }
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

  // ── 季節の降りもの（春=桜の花びら／秋=落ち葉が公園のあたりに舞う）。街のみ・天気が降りものでない時。──
  if (kind !== 'yato' && (season === 'spring' || season === 'autumn') && weather !== 'petals' && weather !== 'leaves') {
    const N = LIGHT ? 70 : 130
    const bx = PARK.x, bz = PARK.z, R0 = 18, floor = heightAt(PARK.x, PARK.z) - 0.5
    const pos = new Float32Array(N * 3), spd = new Float32Array(N), phs = new Float32Array(N)
    for (let i = 0; i < N; i++) { pos[i * 3] = bx + (R() - 0.5) * R0 * 2; pos[i * 3 + 1] = floor + R() * 20; pos[i * 3 + 2] = bz + (R() - 0.5) * R0 * 2; spd[i] = 0.7 + R() * 0.9; phs[i] = R() * 6.28 }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({ color: season === 'spring' ? 0xf2bcd0 : 0xd07e2a, size: season === 'spring' ? 0.8 : 0.92, transparent: true, opacity: 0.92, sizeAttenuation: true, fog: true, depthWrite: false })
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts)
    seasonFall = { pts, pos, spd, phs, N, bx, bz, R0, floor, swirl: season === 'spring' ? 2.2 : 2.8 }
  }

  // ── 鯉のぼり（春。真鯉・緋鯉・子鯉が風になびく）。街のみ・春のみ。 ──
  if (kind !== 'yato' && season === 'spring') {
    koinobori = []
    const carpCols = [0x2a2a2e, 0xc23a2e, 0x3a6a8a, 0x6a8a5a] // 黒(真鯉)/赤(緋鯉)/青/緑
    for (const sp of [[-44, -22], [-12, -40], [50, -12], [10, -56], [-28, -36]]) {
      const x = sp[0], z = sp[1], gy = heightAt(x, z)
      const g = new THREE.Group(); g.position.set(x, gy, z); g.rotation.y = (R() - 0.5) * 1.2; town.add(g) // 向きを少し振る
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 9, 6), toon(0xb0aaa0)); pole.position.y = 4.5; pole.castShadow = true; g.add(pole)
      const yagu = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 6, 10), toon(0xd9b44a)); yagu.position.y = 9.1; yagu.rotation.x = Math.PI / 2; g.add(yagu) // 矢車
      const fuki = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 1.5, 8, 1, true), toon(0xe0a838)); fuki.rotation.z = Math.PI / 2; fuki.position.set(0.85, 8.6, 0); g.add(fuki) // 吹き流し
      const sizes = [2.5, 1.9, 1.4]; let cy = 8.0
      for (let i = 0; i < 3; i++) {
        const carp = new THREE.Group(); carp.position.set(0, cy, 0); g.add(carp); koinobori.push({ grp: carp, ph: i * 0.6 + R() * 0.4 })
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.07, sizes[i], 9, 1, true), toon(carpCols[i % carpCols.length])); body.rotation.z = Math.PI / 2; body.position.x = sizes[i] / 2; body.castShadow = true; carp.add(body)
        for (const ez of [-0.16, 0.16]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), toon(0xf0ece0)); eye.position.set(0.18, 0.13, ez); carp.add(eye) }
        cy -= 0.85
      }
      colliders.push({ x, z, r: 0.5 })
    }
  }

  // ── 庭・空き地の季節の花（夏=ひまわり／秋=コスモス）。merged で軽く。街のみ。 ──
  if (kind !== 'yato' && (season === 'summer' || season === 'autumn')) {
    const isHimawari = season === 'summer'
    const stemGeos = [], headGeos = [], centerGeos = []
    for (const cl of [[-20, -10], [22, -6], [-7, -52], [42, -34], [-46, -16]]) {
      const n = 3 + ((R() * 3) | 0)
      for (let i = 0; i < n; i++) {
        const fx = cl[0] + (R() - 0.5) * 4, fz = cl[1] + (R() - 0.5) * 4, fgy = heightAt(fx, fz)
        if (fx > SEA.coast || Math.abs(fx - RIVER.x) < RIVER.halfW + 1) continue // 海・川は避ける
        const h = isHimawari ? 2.0 + R() * 0.7 : 1.2 + R() * 0.5
        const sg = new THREE.CylinderGeometry(0.04, 0.06, h, 5); sg.translate(fx, fgy + h / 2, fz); stemGeos.push(sg)
        const hr = isHimawari ? 0.5 : 0.24
        const hd = new THREE.CylinderGeometry(hr, hr, 0.1, isHimawari ? 14 : 8); hd.rotateX(0.5 + (R() - 0.5) * 0.4); hd.translate(fx, fgy + h, fz); headGeos.push(hd)
        if (isHimawari) { const ct = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 12); ct.rotateX(0.5); ct.translate(fx, fgy + h + 0.02, fz); centerGeos.push(ct) }
      }
    }
    if (BufferGeometryUtils.mergeGeometries) {
      const sm = stemGeos.length && BufferGeometryUtils.mergeGeometries(stemGeos, false); if (sm) town.add(new THREE.Mesh(sm, toon(0x5e8a4a)))
      const hm = headGeos.length && BufferGeometryUtils.mergeGeometries(headGeos, false); if (hm) { const heads = new THREE.Mesh(hm, toon(isHimawari ? 0xe8b830 : 0xe884a4)); heads.castShadow = true; town.add(heads) }
      const cm = centerGeos.length && BufferGeometryUtils.mergeGeometries(centerGeos, false); if (cm) town.add(new THREE.Mesh(cm, toon(0x5a4030)))
      stemGeos.concat(headGeos, centerGeos).forEach((g) => g.dispose())
    }
  }

  // 全ての木の幹を1メッシュへ統合（静止）＝ドローコールを大きく削る（葉は木ごとに揺れるので別）。
  if (trunkGeos.length && BufferGeometryUtils.mergeGeometries) {
    const tm = BufferGeometryUtils.mergeGeometries(trunkGeos, false)
    if (tm) { const trunks = new THREE.Mesh(tm, trunkMat); trunks.castShadow = true; trunks.receiveShadow = true; town.add(trunks) }
    trunkGeos.forEach((g) => g.dispose())
  }

  // ── カメラ（高台のマンション上階の窓から見下ろす）。谷戸は少し低く寄せて谷を見渡す ──
  const camera = new THREE.PerspectiveCamera(62, W / H, 0.5, 600)
  const eye = kind === 'yato'
    ? new THREE.Vector3(0, 28, 27)  // 谷戸: 少し低く・谷へ寄る（棚田と茅葺屋敷が映える）
    : new THREE.Vector3(0, 31, 30)  // 街: 高台の上階から見下ろす

  // ── 室内の窓枠（3Dの壁＋窓の開口）。部屋の中から窓越しに外を覗く“本物”の手応え＝近い窓枠と遠い景色が
  //    視差で分離して動き、見回す（＝室内で頭を動かす）と窓が視界を横切り壁の側が覗く。乗り出すと退いて街へ。
  //    世界座標に固定（カメラに親子付けしない）＝カメラの平行移動/回転で枠と景色が正しくずれる。 ──
  const winRoom = new THREE.Group()
  const winRoomMats = []
  let winSashR = null, winSashX0 = 0, winSashX1 = 0 // 引き違いの可動ガラス障子（窓をあけると横へすべる）
  const winCurtains = [] // 窓辺のカーテン（窓をあけると外気でそっとそよぐ）
  let windChime = null // 夏の窓辺の風鈴（窓をあけると外気でちりんと揺れる）
  const teaSteam = [] // 急須から立ちのぼる湯気
  let winPendulum = null // 振り子柱時計（振り子が静かに揺れる）
  let winDust = null // 窓の光に舞うほこり（昼の“居る部屋”の空気感）
  let winCat = null // 窓辺の日だまりで丸くなって眠る猫（呼吸でそっと上下）
  let winRefl = null // 窓ガラスへの室内の映り込み（夕/夜ほど強い・窓をあけると消える）
  {
    // 寸法（局所座標。原点=窓の中心、カメラは局所(0,1.5,3.2)＝立って窓辺に居る）。FY床/CY天井/SX側壁/BZ奥壁/WINCY窓の中心高。
    const dWall = 3.2, owW = 2.4, owH = 1.7, FY = -1.1, CY = 3.7, SX = 4.7, BZ = 7.4, WINCY = 1.0 // 少し広い部屋に
    const RW = 2 * SX + 0.8, RD = BZ + 0.9, WT = CY + 0.3 // 室の幅/奥行/壁の上端（躯体はこれで一括スケール）
    const C = (d, n) => isNight ? n : d
    // 室内全体の時間帯の色味＝昼は素、夕ほど飴色に温まる（“いま何時か”を部屋の中から感じる）。夜は専用色のまま。
    const roomWarm = isNight ? null : new THREE.Color(0xffffff).lerp(new THREE.Color(0xffd6a2), duskAmt * 0.5)
    // 不透明＝室内が深度を書き込み、手前の壁が奥の壁/家具と「窓の外の街」を遮蔽＝隠れた街の塗り(fill)を早期Zで省く＋
    // 半透明ブレンドの全画面オーバードローをゼロに（カクつきの主因を断つ）。乗り出すとカメラが窓の開口を通って前へ
    // 出るので室内は自然に背後へ退く（フェード不要）。
    const mk = (col, map) => { const m = new THREE.MeshBasicMaterial({ color: col, map: map || null, fog: false }); if (roomWarm) m.color.multiply(roomWarm); m.vertexColors = true; winRoomMats.push(m); return m }
    // 角をわずかに面取り（街のトゥーンの丸みに合わせ、硬い箱の安っぽさを和らげる）。細い桟/薄板は面取りすると角が
    // 立ってチカチカするので平らな箱にする（しきい値を上げて家具だけ丸める）。
    const box = (w, h, d, x, y, z, mat) => { const r = Math.min(0.05, Math.min(w, h, d) * 0.24); const g = r > 0.032 ? new RoundedBoxGeometry(w, h, d, 1, r) : new THREE.BoxGeometry(w, h, d); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.renderOrder = 2; grad(m); winRoom.add(m); return m } // grad=窓からの採光の陰影（家具にも）
    const cyl = (rt, rb, h, x, y, z, mat, seg) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat); m.position.set(x, y, z); m.renderOrder = 2; grad(m); winRoom.add(m); return m }
    const maxAniso = renderer.capabilities.getMaxAnisotropy() // 浅い角度の床テクスチャの明滅(モアレ)を抑える
    const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t }
    // テクスチャ: 畳・天井板・カレンダー・障子
    // 畳: 市松に目を互い違い（縦目／横目）＋畳縁で“ちゃんとした畳の間”に。目は低コントラスト・粗めでモアレ(チカチカ)を避ける。
    const tatTex = cv(256, 256, (x) => {
      const base = C('#9a9c5e', '#3a3c2c'), hem = C('#414a2b', '#181a10'), grain = C('rgba(58,64,28,0.06)', 'rgba(8,10,5,0.08)')
      x.fillStyle = base; x.fillRect(0, 0, 256, 256)
      const cell = (cx, cy, vert) => { x.strokeStyle = grain; x.lineWidth = 2
        if (vert) { for (let gx = cx + 12; gx < cx + 122; gx += 13) { x.beginPath(); x.moveTo(gx, cy + 8); x.lineTo(gx, cy + 120); x.stroke() } }
        else { for (let gy = cy + 12; gy < cy + 122; gy += 13) { x.beginPath(); x.moveTo(cx + 8, gy); x.lineTo(cx + 120, gy); x.stroke() } } }
      cell(0, 0, false); cell(128, 0, true); cell(0, 128, true); cell(128, 128, false) // 互い違いの目（市松）
      x.strokeStyle = hem; x.lineWidth = 6
      for (const g of [0, 128, 256]) { x.beginPath(); x.moveTo(g, 0); x.lineTo(g, 256); x.stroke(); x.beginPath(); x.moveTo(0, g); x.lineTo(256, g); x.stroke() } // 畳縁（タイル継ぎ目で連続）
    })
    tatTex.wrapS = tatTex.wrapT = THREE.RepeatWrapping; tatTex.repeat.set(3, 2.4)
    const ceilTex = cv(128, 128, (x) => { x.fillStyle = C('#4a3e2c', '#211c16'); x.fillRect(0, 0, 128, 128); x.strokeStyle = 'rgba(0,0,0,0.34)'; x.lineWidth = 3; for (let i = 0; i <= 128; i += 22) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke() } })
    ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping; ceilTex.repeat.set(3, 3)
    const calTex = cv(64, 88, (x) => { x.fillStyle = '#efe9da'; x.fillRect(0, 0, 64, 88); x.fillStyle = '#b83c30'; x.fillRect(0, 0, 64, 20); x.fillStyle = 'rgba(70,58,46,0.55)'; for (let r = 0; r < 5; r++) for (let cc2 = 0; cc2 < 7; cc2++) x.fillRect(5 + cc2 * 8, 26 + r * 11, 5, 7) })
    // 砂壁の粒（白基調に細かな明暗の砂目＝乗算でうっすら凹凸感。のっぺりを脱す）
    const sandTex = cv(128, 128, (x) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 2400; i++) { const a = 0.04 + R() * 0.07, s = 1 + R() * 1.6; x.fillStyle = R() < 0.5 ? `rgba(54,44,32,${a})` : `rgba(255,250,238,${a})`; x.fillRect(R() * 128, R() * 128, s, s) } })
    sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping; sandTex.repeat.set(2.6, 2.6)
    // 腰壁の板目（横の継ぎ目＋うっすら縦の木目）
    const plankTex = cv(64, 64, (x) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64); x.strokeStyle = 'rgba(18,12,7,0.5)'; x.lineWidth = 2; for (let gy = 0; gy <= 64; gy += 16) { x.beginPath(); x.moveTo(0, gy); x.lineTo(64, gy); x.stroke() } x.strokeStyle = 'rgba(40,28,16,0.1)'; x.lineWidth = 1; for (let i = 0; i < 44; i++) { const gx = R() * 64; x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx + (R() - 0.5) * 6, 64); x.stroke() } })
    plankTex.wrapS = plankTex.wrapT = THREE.RepeatWrapping; plankTex.repeat.set(9, 1.3)
    // 材（昭和の茶の間。暖色・飴色の木・砂壁・畳。夜は沈める）
    const wallMat = mk(C(0x8c7c5c, 0x2a2430), sandTex), wainsMat = mk(C(0x6a4e34, 0x221b22), plankTex) // 砂壁(粒)・腰壁(板目)
    const tatMat = mk(0xffffff, tatTex), cmat = mk(0xffffff, ceilTex)
    // 木目（横に流れるやわらかな濃淡の筋＝飴色の木の手触り。家具全般に効く）
    const woodTex = cv(64, 64, (x) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64); for (let i = 0; i < 22; i++) { const y = R() * 64, a = 0.05 + R() * 0.08; x.strokeStyle = `rgba(58,38,22,${a})`; x.lineWidth = 0.6 + R() * 1.4; x.beginPath(); x.moveTo(0, y); for (let xx = 0; xx <= 64; xx += 8) x.lineTo(xx, y + Math.sin(xx * 0.2 + i) * 1.2); x.stroke() } })
    woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.repeat.set(2, 2)
    const woodMat = mk(C(0x7a5630, 0x2c241d), woodTex), woodDk = mk(C(0x4a3320, 0x1d1611))
    // 布の織り目（細かな格子＋微細なムラ＝座布団が布に見える）
    const clothTex = cv(48, 48, (x) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, 48, 48); x.strokeStyle = 'rgba(0,0,0,0.07)'; x.lineWidth = 1; for (let i = 0; i < 48; i += 3) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 48); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(48, i); x.stroke() } for (let i = 0; i < 380; i++) { x.fillStyle = `rgba(${R() < 0.5 ? 0 : 255},${R() < 0.5 ? 0 : 255},${R() < 0.5 ? 0 : 255},0.03)`; x.fillRect(R() * 48, R() * 48, 1.5, 1.5) } })
    clothTex.wrapS = clothTex.wrapT = THREE.RepeatWrapping; clothTex.repeat.set(3, 3)
    const fabMat = mk(C(0xa8564a, 0x3a2630), clothTex), fab2 = mk(C(0x4e6a52, 0x26302a), clothTex)
    const lampMat = mk(C(0xfff0c8, 0xffdf9a)), scrollMat = mk(C(0xe8e0cc, 0x726a5c))
    const ceramMat = mk(C(0xb6c2cc, 0x3a4048)), blackMat = mk(C(0x262420, 0x14120d)), greenMat = mk(C(0x4e7446, 0x26361f))
    const tvMat = mk(C(0x7c6e5c, 0x2a2620)), screenMat = mk(C(0x1c2026, 0x0f1115)), mikanMat = mk(C(0xe8902e, 0x6a4520)), creamMat = mk(C(0xe6ddc6, 0x5c564c)), redMat = mk(C(0xc24a38, 0x52261e))
    // 室内面に頂点色の陰影（窓・灯りに近いほど明るく、奥/床際ほど暗い＝平らな箱でなく光のある3D室内）
    for (const m of [wallMat, tatMat, cmat]) m.vertexColors = true
    const grad = (m) => {
      const p = m.geometry.attributes.position, c = new Float32Array(p.count * 3)
      for (let i = 0; i < p.count; i++) {
        const lz = m.position.z + p.getZ(i), ly = m.position.y + p.getY(i)
        const near = Math.max(0, 1 - lz / (BZ + 0.4))       // 窓に近い=1／奥=0（窓からの採光）
        const lo = Math.min(1, Math.max(0, (ly - FY) / (CY - FY + 0.6))) // 床=0／天井=1
        const b = Math.max(0.4, Math.min(1.36, (0.6 + near * 0.74) * (0.86 + lo * 0.2))) // 窓際ほど明るい
        const warm = near * (isNight ? 0.25 : (0.34 + duskAmt * 0.36)) // 窓際は暖色（昼の外光・夕ほど濃い）／奥は素
        c[i * 3] = Math.min(1.5, b * (1 + warm * 0.14)); c[i * 3 + 1] = b; c[i * 3 + 2] = b * (1 - warm * 0.16)
      }
      m.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3)); return m
    }
    // ── 家具の接地影（畳に柔らかい影を敷いて“浮き”を消す＝見下ろしで効く作り込み）──
    const shadowTex = cv(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(0.6, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64) })
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: isNight ? 0.34 : 0.42, depthWrite: false, fog: false }); winRoomMats.push(shadowMat)
    const floorShadow = (x, z, w, d) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), shadowMat); m.rotation.x = -Math.PI / 2; m.position.set(x, FY + 0.016, z); m.renderOrder = 3; winRoom.add(m); return m } // 不透明な畳(renderOrder2)より後に重ねて畳を暗くする（先に描くと畳に上書きされ消える）
    // ── 躯体（床=畳／天井=竿縁／奥・両側=砂壁）。RW/RD/WTで一括スケール。 ──
    const WH = WT - FY + 0.6 // 壁の高さ
    grad(box(RW, 0.3, RD, 0, FY - 0.15, BZ / 2, tatMat))        // 床（畳）
    grad(box(RW, 0.3, RD, 0, CY, BZ / 2, cmat))                // 天井（板目）
    grad(box(RW, WH, 0.3, 0, (WT + FY) / 2, BZ, wallMat))       // 奥壁
    grad(box(0.3, WH, RD, -SX, (WT + FY) / 2, BZ / 2, wallMat)) // 左壁
    grad(box(0.3, WH, RD, SX, (WT + FY) / 2, BZ / 2, wallMat))  // 右壁
    // ── 前壁（窓のある壁）。腰壁＋上壁＋左右壁で“ちょうど開ける高さの窓”に。 ──
    const oT = WINCY + owH / 2, oB = WINCY - owH / 2 // 開口の上端/下端
    grad(box(RW, WT - oT, 0.3, 0, (oT + WT) / 2, 0, wallMat))     // 窓の上の壁
    box(RW, oB - (FY - 0.4), 0.3, 0, (oB + FY - 0.4) / 2, 0, wainsMat) // 腰壁（窓の下＝羽目板）
    grad(box((RW - owW) / 2, owH, 0.3, -(owW / 2 + (RW - owW) / 4), WINCY, 0, wallMat)) // 窓の左の壁
    grad(box((RW - owW) / 2, owH, 0.3, owW / 2 + (RW - owW) / 4, WINCY, 0, wallMat))    // 窓の右の壁
    box(owW + 0.6, 0.1, 0.22, 0, oB - 0.06, 0.28, woodMat) // 窓台（腰壁の上の見切り。室内側へ出し、下桟とは高さをずらして重ねない）
    // アルミサッシの窓枠＋引き違いの召し合わせ（団地/マンションの掃き出し窓）＋窓台
    const alMat = mk(C(0x9ea29e, 0x44484c)) // アルミサッシ（明るすぎる細桟はチカチカするので鈍い銀灰に）
    // チカチカの真因＝桟が壁の厚み(z=-0.15..0.15)に埋もれて壁面/窓台とZファイティング。
    // → 全ての桟を壁の室内面(z=0.15)より十分手前へ出す。横桟<縦桟<召し合わせ の順で前後を段付け＝角は手前の桟が確実に覆う。
    box(owW + 0.2, 0.1, 0.1, 0, oT, 0.25, alMat); box(owW + 0.2, 0.1, 0.1, 0, oB + 0.06, 0.25, alMat)             // 上下の横桟（壁より手前・窓台の上）
    box(0.1, owH + 0.2, 0.1, -owW / 2 - 0.05, WINCY, 0.29, alMat); box(0.1, owH + 0.2, 0.1, owW / 2 + 0.05, WINCY, 0.29, alMat) // 左右の縦桟（さらに手前）
    box(0.06, owH, 0.06, 0, WINCY, 0.32, alMat) // 中央の召し合わせ（最前）
    box(0.14, 0.06, 0.08, 0.1, WINCY - 0.06, 0.31, alMat) // クレセント錠
    // 引き違いのガラス障子（2枚）。閉=開口を覆う／窓をあけると右の障子が左へすべって右半分が開く（実際の窓の開閉）。
    // ガラスは“ごく淡い映り込み”だけ（景色を曇らせない）。斜めの細い光の筋を1本＋極薄の地色。端はパネルを枠の内側に隠す。
    const glassTex = cv(64, 64, (x) => { x.fillStyle = 'rgba(210,222,234,0.02)'; x.fillRect(0, 0, 64, 64); x.strokeStyle = 'rgba(255,255,255,0.12)'; x.lineWidth = 3.5; x.beginPath(); x.moveTo(12, 64); x.lineTo(46, 0); x.stroke(); x.strokeStyle = 'rgba(255,255,255,0.06)'; x.lineWidth = 2; x.beginPath(); x.moveTo(40, 64); x.lineTo(56, 0); x.stroke() })
    const glassMat = new THREE.MeshBasicMaterial({ map: glassTex, transparent: true, opacity: 1, depthWrite: false, fog: false }); winRoomMats.push(glassMat)
    const lpane = new THREE.Mesh(new THREE.PlaneGeometry(owW / 2 - 0.1, owH - 0.12), glassMat); lpane.position.set(-owW / 4, WINCY, 0.18); lpane.renderOrder = 4; winRoom.add(lpane) // 左の障子（固定・壁より手前/桟より奥）
    const rpane = new THREE.Mesh(new THREE.PlaneGeometry(owW / 2 - 0.1, owH - 0.12), glassMat); rpane.position.set(owW / 4, WINCY, 0.20); rpane.renderOrder = 4; winRoom.add(rpane) // 右の障子（あけると左へ）
    winSashR = rpane; winSashX0 = owW / 4; winSashX1 = -owW / 4
    // 窓ガラスへの室内の映り込み（街と一緒に暖かい部屋の気配が硝子に映る。夕/夜ほど強く・昼はほぼ無い・窓をあけると消える）
    { const reflTex = cv(128, 128, (x) => {
        const g = x.createLinearGradient(0, 72, 0, 128); g.addColorStop(0, 'rgba(255,228,182,0)'); g.addColorStop(1, 'rgba(255,222,168,0.42)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128) // 下半分にうっすら室内の暖色
        const rg = x.createRadialGradient(94, 30, 2, 94, 30, 26); rg.addColorStop(0, 'rgba(255,242,208,0.8)'); rg.addColorStop(1, 'rgba(255,242,208,0)'); x.fillStyle = rg; x.fillRect(0, 0, 128, 128) }) // 灯りの映り込み（上右＝街の焦点を避ける）
      const reflBase = isNight ? 0.5 : duskAmt * 0.24
      const reflMat = new THREE.MeshBasicMaterial({ map: reflTex, transparent: true, opacity: reflBase, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }); winRoomMats.push(reflMat)
      const refl = new THREE.Mesh(new THREE.PlaneGeometry(owW - 0.06, owH - 0.12), reflMat); refl.position.set(0, WINCY, 0.215); refl.renderOrder = 5; winRoom.add(refl)
      winRefl = { mat: reflMat, base: reflBase } }
    box(owW + 0.4, 0.13, 0.4, 0, oB - 0.06, 0.18, woodMat) // 室内側の窓台
    box(0.16, 0.12, 0.16, owW / 2 - 0.12, oB + 0.12, 0.26, greenMat) // 窓辺の小さな植木
    // ── 窓辺の一輪挿し（季節の花＝移ろう暮らし。春=桜色/夏=朝顔/秋=コスモス橙/冬=椿の紅） ──
    { const vx = 0.18, vy = oB + 0.02, vz = 0.30
      const bloomBright = ({ spring: 0xe6a6c2, summer: 0x7d8fd6, autumn: 0xd9803a, winter: 0xc23a30 })[season] || 0xe6a6c2
      const bloomDim = new THREE.Color(bloomBright).multiplyScalar(0.5).getHex()
      const flMat = mk(C(bloomBright, bloomDim)), stMat = mk(C(0x5a7a48, 0x2c3a26)), vaseMat = mk(C(0xcfd8da, 0x3a4248))
      cyl(0.036, 0.05, 0.15, vx, vy + 0.06, vz, vaseMat, 12) // 花瓶（淡い硝子）
      for (const [dx, dy, dz] of [[0, 0.2, 0], [-0.06, 0.16, 0.03], [0.07, 0.17, -0.03], [0.01, 0.13, 0.05]]) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, dy, 5), stMat); stem.position.set(vx + dx * 0.5, vy + 0.1 + dy / 2, vz + dz * 0.5); stem.rotation.z = -dx * 1.4; stem.renderOrder = 2; winRoom.add(stem)
        const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.032, 0), flMat); fl.position.set(vx + dx, vy + 0.12 + dy, vz + dz); grad(fl); fl.renderOrder = 2; winRoom.add(fl) }
    }
    // ── 窓辺の湯呑み（縁側でお茶＝“いま家でくつろいでいる”気配）。湯気は teaSteam に合流して立ちのぼる。──
    { const cupY = oB + 0.04
      cyl(0.064, 0.052, 0.016, -0.72, cupY - 0.02, 0.31, ceramMat, 14) // 受け皿
      cyl(0.05, 0.043, 0.078, -0.72, cupY + 0.03, 0.31, ceramMat, 14)  // 湯呑み
      cyl(0.064, 0.064, 0.006, -0.72, cupY + 0.07, 0.31, mk(C(0x6a8a52, 0x33422a)), 14) // お茶の面（緑）
      const stTex2 = cv(48, 48, (x) => { const g = x.createRadialGradient(24, 24, 1, 24, 24, 24); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.32)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 48, 48) })
      for (let i = 0; i < 2; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: stTex2, transparent: true, opacity: 0, depthWrite: false, fog: false })); sp.position.set(-0.72, cupY + 0.12, 0.31); sp.userData = { x0: -0.72, y0: cupY + 0.12, ph: i / 2 }; sp.renderOrder = 7; winRoom.add(sp); teaSteam.push(sp); winRoomMats.push(sp.material) } }
    // ベランダの手すり（窓の外・下＝団地の上階から街を見下ろす気配）。室内と一緒に乗り出すと退く。
    const railMat = mk(C(0xa6a298, 0x3a3e44)) // ベランダ手すり（鈍い色でチカチカ抑制）
    box(owW + 0.7, 0.08, 0.08, 0, oB + 0.62, -0.55, railMat); box(owW + 0.7, 0.08, 0.08, 0, oB + 0.04, -0.55, railMat) // 上下の手すり桟
    for (let i = -3; i <= 3; i++) box(0.05, 0.62, 0.05, i * ((owW + 0.5) / 6.2), oB + 0.33, -0.55, railMat) // 縦の手すり子
    // ── 天井から下がる和紙の照明（昭和の傘＋裸電球。明るい＝灯り） ──
    box(0.05, CY - 2.5, 0.05, 0, CY - (CY - 2.5) / 2, 2.4, woodDk) // 吊りコード
    cyl(0.42, 0.34, 0.42, 0, 2.32, 2.4, lampMat, 14)             // 和紙の傘
    box(0.5, 0.05, 0.5, 0, 2.55, 2.4, woodDk); cyl(0.09, 0.09, 0.14, 0, 2.06, 2.4, lampMat) // 傘の天板＋電球
    box(0.018, 0.42, 0.018, 0.17, 1.86, 2.4, woodDk); cyl(0.04, 0.04, 0.09, 0.17, 1.6, 2.4, lampMat) // 灯りの引き紐＋握り玉（昭和の暮らし）
    { const gTex = cv(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 1, 32, 32, 32); g.addColorStop(0, 'rgba(255,232,178,0.95)'); g.addColorStop(0.45, 'rgba(255,216,150,0.32)'); g.addColorStop(1, 'rgba(255,216,150,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64) }); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, transparent: true, opacity: isNight ? 0.9 : 0.42, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); gl.position.set(0, 2.12, 2.4); gl.scale.set(2.4, 2.4, 1); gl.renderOrder = 6; winRoom.add(gl); winRoomMats.push(gl.material) } // 灯りの暖かいにじみ（夜ほど強い）
    if (isNight) { const pTex = cv(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(255,224,168,0.55)'); g.addColorStop(0.6, 'rgba(255,210,150,0.18)'); g.addColorStop(1, 'rgba(255,210,150,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64) }); const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: pTex, transparent: true, opacity: 0.6, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); pool.rotation.x = -Math.PI / 2; pool.position.set(0, FY + 0.04, 2.4); pool.renderOrder = 4; winRoom.add(pool); winRoomMats.push(pool.material) } // 夜: 灯りが畳に落とす暖かな光だまり
    // ── 和室の骨格: 四隅の柱と壁をめぐる長押（昭和の茶の間らしい陰影） ──
    const postMat = mk(C(0x6f573c, 0x40342a)) // 飴色の柱・長押
    for (const [px, pz] of [[-SX + 0.11, 0.22], [SX - 0.11, 0.22], [-SX + 0.11, BZ - 0.22], [SX - 0.11, BZ - 0.22]]) box(0.17, WT - FY, 0.17, px, (WT + FY) / 2, pz, postMat) // 四隅の柱
    const ngY = oT + 0.5 // 長押の高さ（窓・鴨居の上）
    box(RW, 0.1, 0.06, 0, ngY, 0.05, postMat); box(RW, 0.1, 0.06, 0, ngY, BZ - 0.05, postMat) // 前後の長押
    box(0.06, 0.1, RD, -SX + 0.04, ngY, BZ / 2, postMat); box(0.06, 0.1, RD, SX - 0.04, ngY, BZ / 2, postMat) // 左右の長押
    // ── 右壁＝居間の顔: ブラウン管テレビ＋木の台＋柱時計＋カレンダー ──
    box(1.5, 0.66, 0.7, SX - 0.42, FY + 0.33, 3.0, woodMat)        // テレビ台
    box(1.04, 0.78, 0.66, SX - 0.5, FY + 1.05, 3.0, tvMat)         // テレビ筐体
    box(0.06, 0.58, 0.7, SX - 1.04, FY + 1.05, 3.0, screenMat)     // 画面（部屋側=-xを向く）
    box(0.04, 0.46, 0.56, SX - 1.06, FY + 1.05, 3.0, mk(C(0x9ab4c0, 0x33414a))) // 画面のほのかな映り
    for (const dz of [-0.18, 0.18]) cyl(0.05, 0.05, 0.05, SX - 1.02, FY + 0.78, 3.0 + dz, woodDk, 8) // つまみ
    for (const a of [-0.5, 0.5]) { const ant = box(0.02, 0.66, 0.02, SX - 0.5, FY + 1.7, 3.0, blackMat); ant.rotation.z = a } // V字アンテナ
    box(0.34, 0.16, 0.26, SX - 0.5, FY + 1.52, 3.1, mk(C(0x8a6a5a, 0x47393e))) // テレビ上の小物
    // 昭和の振り子柱時計（右壁。振り子が静かに時を刻む）
    const clkCase = mk(C(0x6a4f34, 0x382a1c)), clkBrass = new THREE.MeshBasicMaterial({ color: C(0xc2a85e, 0x6e5e34), fog: false }); winRoomMats.push(clkBrass) // 振り子は手動メッシュ＝頂点色なしの素直な材で（黒落ち回避）
    const cwx = SX - 0.22 // 壁から室内側へ十分出す基準x（壁に埋まらないように）
    box(0.13, 0.92, 0.42, cwx, 1.5, 2.4, clkCase)                               // 時計の箱（濃い飴色）
    const cf = cyl(0.15, 0.15, 0.04, cwx - 0.085, 1.78, 2.4, creamMat, 20); cf.rotation.z = Math.PI / 2 // 文字盤（-x向き）
    box(0.02, 0.11, 0.022, cwx - 0.11, 1.81, 2.4, blackMat); box(0.02, 0.022, 0.12, cwx - 0.11, 1.78, 2.42, blackMat) // 針（短・長）
    box(0.012, 0.46, 0.32, cwx - 0.075, 1.36, 2.4, mk(C(0x241f1a, 0x120f0c)))   // 振り子室の暗がり
    const pend = new THREE.Group(); pend.position.set(cwx - 0.12, 1.6, 2.4); winRoom.add(pend) // 振り子（上端を軸に揺れる）
    const prod = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.34, 0.016), clkBrass); prod.position.y = -0.17; pend.add(prod) // 棹
    const pbob = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16), clkBrass); pbob.rotation.z = Math.PI / 2; pbob.position.y = -0.36; pend.add(pbob) // 錘（真鍮の円盤）
    winPendulum = pend
    box(0.04, 0.7, 0.5, SX - 0.06, 0.9, 4.3, mk(0xffffff, calTex)) // カレンダー
    // ── 左壁＝暮らしの壁: 整理ダンス＋壁の額（家族写真）、奥に茶箪笥（食器棚）。団地の居間らしく。 ──
    const brass = mk(C(0xc0a060, 0x4a4030))
    box(1.3, 1.7, 0.55, -SX + 0.32, FY + 0.85, 2.6, woodMat)      // 整理ダンス（衣装箪笥）
    for (let r = 0; r < 4; r++) { box(1.18, 0.05, 0.05, -SX + 0.6, FY + 0.32 + r * 0.42, 2.6, woodDk); box(0.18, 0.05, 0.07, -SX + 0.62, FY + 0.52 + r * 0.42, 2.6, brass) } // 引き出しの段＋取っ手
    box(0.46, 0.36, 0.16, -SX + 0.42, FY + 1.95, 2.6, woodDk); box(0.38, 0.28, 0.04, -SX + 0.38, FY + 1.95, 2.6, creamMat) // ダンス上の写真立て
    box(0.6, 0.46, 0.05, -SX + 0.06, 1.7, 1.6, woodDk); box(0.5, 0.36, 0.03, -SX + 0.1, 1.7, 1.6, scrollMat) // 壁の額（家族写真）
    box(1.4, 1.4, 0.56, -SX + 0.33, FY + 0.7, 4.7, woodMat); box(1.1, 1.0, 0.06, -SX + 0.62, FY + 0.78, 4.7, screenMat) // 茶箪笥＋ガラス戸
    for (const dz of [-0.3, 0.0, 0.3]) box(0.16, 0.18, 0.16, -SX + 0.33, FY + 1.5, 4.7 + dz, ceramMat) // 箪笥上の器
    // ── 暮らしの小物（生活感）: 招き猫＋観葉植物 ──
    const white = mk(C(0xf1ebe0, 0xccc4b8)), redCol = mk(C(0xbe4030, 0x6e2a26)), potMat = mk(C(0xb37a52, 0x5a4030)), leaf = mk(C(0x6f8f5a, 0x3a5340))
    { const mx = SX - 1.06, mz = 2.62, my = FY + 0.66 // 招き猫（テレビ台の上）
      box(0.2, 0.05, 0.16, mx, my + 0.02, mz, redCol)                          // 赤い座布団
      box(0.17, 0.2, 0.14, mx, my + 0.13, mz, white)                           // 胴
      const mh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), white); mh.position.set(mx, my + 0.3, mz); grad(mh); mh.renderOrder = 2; winRoom.add(mh) // 頭
      for (const ex of [-0.06, 0.06]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.07, 8), white); ear.position.set(mx + ex, my + 0.39, mz); grad(ear); ear.renderOrder = 2; winRoom.add(ear) } // 耳
      box(0.05, 0.12, 0.05, mx + 0.09, my + 0.18, mz - 0.02, white)            // 招く前足
      box(0.16, 0.04, 0.02, mx, my + 0.22, mz + 0.07, redCol)                  // 首輪
      cyl(0.045, 0.045, 0.02, mx, my + 0.15, mz + 0.08, brass, 10)             // 小判
    }
    { const px = 1.9, pz = 0.9 // 観葉植物（窓辺の床）
      cyl(0.19, 0.14, 0.34, px, FY + 0.17, pz, potMat, 14)                     // 鉢
      for (const [dx, dy, dz, s] of [[0, 0.42, 0, 0.24], [-0.13, 0.34, 0.06, 0.18], [0.12, 0.36, -0.05, 0.19], [0.02, 0.54, -0.02, 0.16]]) { const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), leaf); lf.position.set(px + dx, FY + 0.34 + dy, pz + dz); grad(lf); lf.renderOrder = 2; winRoom.add(lf) } // 葉群
    }
    // ── 奥壁（振り返ると）: 襖（薄墨の山水）＋神棚＋黒電話 ──
    // 襖絵: 鳥の子紙に薄墨の遠山と草＝静かな山水。乗り出さず眺める奥の上質。
    const fusumaTex = cv(128, 192, (x) => {
      x.fillStyle = '#e7ddc4'; x.fillRect(0, 0, 128, 192) // 鳥の子紙
      for (const [cx, cy, w, h, a] of [[34, 96, 86, 30, 0.1], [86, 90, 96, 42, 0.15], [60, 84, 70, 54, 0.1]]) { x.fillStyle = `rgba(84,94,108,${a})`; x.beginPath(); x.moveTo(cx - w / 2, cy); x.quadraticCurveTo(cx - w * 0.18, cy - h, cx, cy - h * 0.7); x.quadraticCurveTo(cx + w * 0.2, cy - h * 1.05, cx + w / 2, cy); x.closePath(); x.fill() } // 薄墨の遠山（重なり・目線の高さ）
      x.fillStyle = 'rgba(150,160,172,0.16)'; x.beginPath(); x.arc(98, 46, 13, 0, 6.28); x.fill() // 淡い月
      x.strokeStyle = 'rgba(68,80,52,0.3)'; x.lineWidth = 1.2; for (let i = 0; i < 22; i++) { const gx = R() * 128; x.beginPath(); x.moveTo(gx, 132); x.quadraticCurveTo(gx + (R() - 0.5) * 8, 116, gx + (R() - 0.5) * 16, 100); x.stroke() } // 草（山裾）
    })
    const fusumaMat = mk(C(0xffffff, 0x7a7060), fusumaTex)
    for (let i = 0; i < 4; i++) { const fx = -3.0 + i * 2.0; box(1.94, 3.0, 0.06, fx, 0.6, BZ - 0.1, fusumaMat); box(0.08, 3.0, 0.09, fx - 0.98, 0.6, BZ - 0.12, woodMat); box(0.16, 0.24, 0.05, fx + 0.7, 0.6, BZ - 0.16, woodDk) } // 4枚の襖（襖絵）＋框＋引手
    const bclk = cyl(0.26, 0.26, 0.05, 2.0, 2.4, BZ - 0.14, creamMat, 18); bclk.rotation.x = Math.PI / 2 // 壁掛け時計（奥壁）
    box(0.02, 0.16, 0.02, 2.0, 2.45, BZ - 0.17, blackMat); box(0.13, 0.02, 0.02, 2.06, 2.4, BZ - 0.17, blackMat) // 時計の針
    box(0.5, 0.72, 0.03, -0.6, 1.4, BZ - 0.13, creamMat) // 奥壁のカレンダー/ポスター
    box(0.5, 0.7, 0.42, -2.6, FY + 0.35, BZ - 0.36, woodMat)     // 電話台
    box(0.36, 0.18, 0.3, -2.6, FY + 0.79, BZ - 0.36, blackMat); cyl(0.11, 0.11, 0.05, -2.6, FY + 0.9, BZ - 0.36, blackMat); box(0.34, 0.1, 0.12, -2.6, FY + 0.94, BZ - 0.36, blackMat) // 黒電話（台＋ダイヤル＋受話器）
    // ── 畳に座る暮らし: ちゃぶ台（丸）＋座布団＋急須・湯呑み・みかん・新聞。季節で扇風機/こたつ ──
    const tcx = 1.25, tcz = 3.7
    cyl(0.88, 0.88, 0.1, tcx, FY + 0.45, tcz, woodMat, 22)        // ちゃぶ台の天板（丸）
    for (const [dx, dz] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) box(0.08, 0.45, 0.08, tcx + dx, FY + 0.22, tcz + dz, woodDk) // 脚
    for (const [dx, dz, m] of [[0, -1.05, fabMat], [-1.05, 0.2, fab2], [0.7, 0.95, fabMat]]) box(0.74, 0.09, 0.74, tcx + dx, FY + 0.05, tcz + dz, m) // 座布団×3
    cyl(0.14, 0.17, 0.2, tcx - 0.25, FY + 0.6, tcz - 0.1, ceramMat); box(0.18, 0.05, 0.05, tcx - 0.42, FY + 0.66, tcz - 0.1, ceramMat) // 急須＋注ぎ口
    for (const dx of [0.2, 0.42]) cyl(0.07, 0.06, 0.1, tcx + dx, FY + 0.55, tcz + 0.2, ceramMat) // 湯呑み×2
    { const stTex = cv(48, 48, (x) => { const g = x.createRadialGradient(24, 24, 1, 24, 24, 24); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.32)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 48, 48) })
      for (let i = 0; i < 3; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: stTex, transparent: true, opacity: 0, depthWrite: false, fog: false })); sp.position.set(tcx - 0.2, FY + 0.7, tcz - 0.1); sp.userData = { x0: tcx - 0.2, y0: FY + 0.7, ph: i / 3 }; sp.renderOrder = 7; winRoom.add(sp); teaSteam.push(sp); winRoomMats.push(sp.material) } } // 急須から立ちのぼる湯気
    cyl(0.2, 0.18, 0.12, tcx + 0.1, FY + 0.56, tcz - 0.35, woodMat); for (let i = 0; i < 3; i++) { const mk2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), mikanMat); mk2.position.set(tcx + 0.1 + (R() - 0.5) * 0.16, FY + 0.66, tcz - 0.35 + (R() - 0.5) * 0.16); grad(mk2); mk2.renderOrder = 2; winRoom.add(mk2) } // みかん籠
    box(0.34, 0.03, 0.46, tcx - 0.5, FY + 0.06, tcz + 0.7, creamMat) // たたんだ新聞
    if (season === 'winter') { box(1.95, 0.5, 1.95, tcx, FY + 0.28, tcz, fabMat) } // こたつの布団
    else if (season === 'summer') { cyl(0.04, 0.04, 1.0, -3.0, FY + 0.5, 5.2, blackMat); const fan = cyl(0.32, 0.32, 0.1, -3.0, FY + 1.0, 5.2, ceramMat, 16); fan.rotation.z = Math.PI / 2; box(0.5, 0.1, 0.5, -3.0, FY + 0.05, 5.2, blackMat) } // 扇風機（夏）
    // ── 窓辺のカーテン（ひだのある布。窓の左右。明暗の縦ひだで“ギャザーの寄った布”に） ──
    const curtMat = mk(C(0xd8cbb0, 0x4a4450)) // 上飾り（grad付きの平面）
    const ctC = (h) => { const c = new THREE.Color(h); if (roomWarm) c.multiply(roomWarm); const m = new THREE.MeshBasicMaterial({ color: c, fog: false }); winRoomMats.push(m); return m } // 子群ローカル＝素のMeshBasic（grad黒落ち回避）
    const curtLight = ctC(C(0xe0d4ba, 0x4e4a5a)), curtDark = ctC(C(0xc2b69c, 0x383442))
    for (const cs of [-1, 1]) { const cg = new THREE.Group(); cg.position.set(cs * (owW / 2 + 0.18), WINCY, 0.42) // ひだの束
      const folds = 5, fw = 0.072
      for (let f = 0; f < folds; f++) { const fold = new THREE.Mesh(new THREE.CylinderGeometry(fw * 0.62, fw * 0.62, owH + 0.34, 8), f % 2 ? curtDark : curtLight); fold.position.x = (f - (folds - 1) / 2) * fw; fold.renderOrder = 2; cg.add(fold) }
      cg.userData.cs = cs; cg.userData.x0 = cs * (owW / 2 + 0.18); winCurtains.push(cg); winRoom.add(cg) }
    box(owW + 0.7, 0.3, 0.07, 0, oT + 0.12, 0.44, curtMat) // 上飾り（バランス）
    // ── 夏＝窓辺の風鈴（吊り紐＋硝子の釣鐘＋舌＋短冊。窓をあけると外気でそっと揺れる） ──
    if (season === 'summer') {
      const wc = new THREE.Group(); wc.position.set(owW * 0.34, oT + 0.02, 0.42); winRoom.add(wc); windChime = wc
      const cordMat = mk(C(0x7a6a4e, 0x3a342a))
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.46, 5), cordMat); cord.position.y = -0.23; cord.renderOrder = 3; wc.add(cord)
      const glass = new THREE.MeshBasicMaterial({ color: isNight ? 0x86a6ae : 0xbfe2e8, transparent: true, opacity: 0.72, fog: false }); winRoomMats.push(glass)
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), glass); bell.position.y = -0.5; bell.renderOrder = 3; wc.add(bell)
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.012, 6, 14), cordMat); rim.rotation.x = Math.PI / 2; rim.position.y = -0.55; rim.renderOrder = 3; wc.add(rim)
      const tongue = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 5), cordMat); tongue.position.y = -0.6; tongue.renderOrder = 3; wc.add(tongue)
      const tanzaku = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.13), curtMat); tanzaku.position.y = -0.72; tanzaku.renderOrder = 3; wc.add(tanzaku)
    }
    // ── 窓辺の座布団＝“自分の席”。ここに座って街を眺める、家の安心の居場所。──
    { const zabuMat = mk(C(0x8f9cab, 0x353d48), clothTex), tieMat = mk(C(0x73808e, 0x2a313a)) // 落ち着いた藍鼠（布の織り）
      box(0.84, 0.12, 0.84, 0.1, FY + 0.05, 2.5, zabuMat)          // 座布団本体
      box(0.07, 0.05, 0.07, 0.1, FY + 0.12, 2.5, tieMat)          // 中央の綴じ
      for (const [dx, dz] of [[0.34, 0.34], [-0.34, 0.34], [0.34, -0.34], [-0.34, -0.34]]) box(0.05, 0.04, 0.05, 0.1 + dx, FY + 0.115, 2.5 + dz, tieMat) // 四隅の房
      const blanMat = mk(C(0xcdb48e, 0x4a4036), clothTex) // たたんだ膝掛け（生成りの暖色）＝ここで暖まれる安心
      for (let i = 0; i < 3; i++) box(0.46, 0.038, 0.5 - i * 0.05, -0.62 + i * 0.012, FY + 0.045 + i * 0.036, 2.46, blanMat) // 少しずつずらした層
      floorShadow(-0.6, 2.46, 0.62, 0.62) } // 膝掛けの接地影
    // ── 窓辺の読みかけの本（くつろぎの時間の気配。少しずれて積む） ──
    { const bx = 0.82, bz = 2.46, cols = [mk(C(0x6a7a86, 0x2c343c)), mk(C(0xb0705a, 0x42302a)), mk(C(0xcabfa2, 0x4a4438))]
      let by = FY + 0.04
      for (let i = 0; i < 3; i++) { const bk = box(0.32 - i * 0.02, 0.04, 0.23 - i * 0.015, bx + (R() - 0.5) * 0.05, by + 0.02, bz, cols[i]); bk.rotation.y = (R() - 0.5) * 0.35; by += 0.046 }
      floorShadow(bx, bz, 0.44, 0.36) }
    // ── 主な床置き家具の接地影（畳との間に柔らかい影＝浮きを消し、見下ろしで床が締まる） ──
    floorShadow(0.1, 2.5, 1.05, 1.05)       // 窓辺の座布団
    floorShadow(SX - 0.42, 3.0, 2.1, 1.4)   // テレビ台
    floorShadow(-SX + 0.4, 2.6, 1.85, 1.05) // 整理ダンス
    floorShadow(-SX + 0.4, 4.7, 1.95, 1.15) // 茶箪笥
    floorShadow(-2.6, BZ - 0.4, 1.1, 0.95)  // 電話台
    floorShadow(tcx, tcz, 2.5, 2.5)         // ちゃぶ台＋座布団
    floorShadow(1.9, 0.9, 0.8, 0.8)         // 観葉植物
    // ── 窓から差し込む光（昼）＝畳に落ちる暖かな採光。最も多く眺める“座っている景色”に光の差す向きを与える。──
    if (!isNight) {
      // 畳に落ちる窓明かり（夕ほど暖色で濃い。夜の灯りだまりの昼版）。窓桟の影を抜いて“この窓から差す光”に。
      const ltTex = cv(128, 128, (x) => {
        const g = x.createRadialGradient(64, 52, 4, 64, 64, 66); g.addColorStop(0, 'rgba(255,247,224,0.96)'); g.addColorStop(0.5, 'rgba(255,239,202,0.34)'); g.addColorStop(1, 'rgba(255,239,202,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128)
        x.globalCompositeOperation = 'destination-out'; x.filter = 'blur(2.5px)'; x.fillStyle = 'rgba(0,0,0,0.55)' // 桟の影＝光を抜く（やわらかい縞）
        for (const bx of [30, 64, 98]) x.fillRect(bx - 3.5, 0, 7, 128)  // 縦桟（左右の障子＋召し合わせ）の影
        x.fillRect(0, 56, 128, 6)                                       // 横桟（窓台）の影
        x.filter = 'none'; x.globalCompositeOperation = 'source-over'
      })
      const patchMat = new THREE.MeshBasicMaterial({ map: ltTex, color: new THREE.Color(0xfff1cc).lerp(sunCol, 0.5), transparent: true, opacity: 0.17 + duskAmt * 0.24, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }); winRoomMats.push(patchMat)
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(owW + 1.6, 2.7), patchMat); patch.rotation.x = -Math.PI / 2; patch.rotation.z = 0.1; patch.position.set(-0.2, FY + 0.05, 1.75); patch.renderOrder = 4; winRoom.add(patch) // 窓から斜めに差す向き
    }
    // ── 光に舞うほこり（窓辺の空間にゆっくり漂う微粒。昼は窓明かり・夜は灯りに浮かぶ。小さく淡く＝雪に見せない）──
    {
      const N = 46, dp = new Float32Array(N * 3), base = []
      for (let i = 0; i < N; i++) { const x0 = (R() - 0.5) * 3.1, y0 = FY + 0.45 + R() * (oT - FY - 0.3), z0 = 0.5 + R() * 2.7; dp[i * 3] = x0; dp[i * 3 + 1] = y0; dp[i * 3 + 2] = z0; base.push({ x0, y0, z0, ph: R() * 6.28, sp: 0.25 + R() * 0.4, amp: 0.05 + R() * 0.07 }) }
      const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dp, 3))
      const dCol = isNight ? new THREE.Color(0xffe0a8) : new THREE.Color(0xffeccb).lerp(sunCol, 0.5) // 夜は灯り色の微粒
      const dmat = new THREE.PointsMaterial({ color: dCol, size: 0.026, transparent: true, opacity: isNight ? 0.14 : (0.22 + duskAmt * 0.16), depthWrite: false, fog: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }); winRoomMats.push(dmat)
      const dust = new THREE.Points(dgeo, dmat); dust.frustumCulled = false; dust.renderOrder = 6; winRoom.add(dust)
      winDust = { geo: dgeo, arr: dp, base }
    }
    // ── 窓辺の日だまりで丸くなる猫（“居る部屋”の主役。顔まで作り込む）。子群ローカルは素のMeshBasic（grad黒落ち回避）。──
    {
      const tint = (h) => { const c = new THREE.Color(h); if (roomWarm) c.multiply(roomWarm); return c }
      const M = (h) => { const m = new THREE.MeshBasicMaterial({ color: tint(h), fog: false }); winRoomMats.push(m); return m }
      // 毛色のバリエーション（読み込みごとに違う猫＝キジトラ/茶トラ/サバトラ/黒/白/灰/三毛）。夜は沈める。
      const COATS = [
        { f: 0x9c8f7c, d: 0x6e6150, l: 0xb6a98f, w: 0xeae0cf, n: false }, // キジトラ
        { f: 0xc78a4c, d: 0x9a5a2c, l: 0xe2aa66, w: 0xf2e6cf, n: false }, // 茶トラ
        { f: 0x8e8c82, d: 0x585650, l: 0xa8a698, w: 0xe8e4d8, n: false }, // サバトラ
        { f: 0x3c3631, d: 0x282420, l: 0x544a40, w: 0x463f39, n: false }, // 黒猫（白少なめ）
        { f: 0xe7e1d4, d: 0xcdc5b4, l: 0xf3eee3, w: 0xf6f2ea, n: false }, // 白猫
        { f: 0x8a8a85, d: 0x605f59, l: 0xa6a69e, w: 0xe6e4dc, n: false }, // 灰
        { f: 0xeae2d2, d: 0xc88a4c, l: 0x3c3631, w: 0xf2ece0, n: true },  // 三毛（白地に茶と黒のブチ）
      ]
      const coat = COATS[(Math.random() * COATS.length) | 0], dk = (h) => new THREE.Color(h).multiplyScalar(0.7).getHex() // 読み込みごとに違う毛色（Math.randomで毎回変える＝シード固定のRと別に）
      const fur = M(isNight ? dk(coat.f) : coat.f)   // 地色
      const furD = M(isNight ? dk(coat.d) : coat.d)  // 縞・陰
      const furL = M(isNight ? dk(coat.l) : coat.l)  // 背の明るみ
      const white = M(isNight ? dk(coat.w) : coat.w) // 胸・口先・足先
      const pink = M(isNight ? 0x7e615d : 0xd69a90)  // 鼻・耳の内
      const dark = M(isNight ? 0x231e19 : 0x3b332b)  // 閉じた目・口
      const whisk = M(isNight ? 0x9a9384 : 0xeee7d6) // ひげ
      const SP = (r, w, h) => new THREE.SphereGeometry(r, w || 16, h || 13)
      const CO = (r, h, s) => new THREE.ConeGeometry(r, h, s || 9)
      const CY = (r, h, s) => new THREE.CylinderGeometry(r, r, h, s || 6)
      const cat = new THREE.Group(); cat.position.set(0.5, FY + 0.02, 1.62); cat.rotation.y = 0.38 // 採光だまり・顔をこちらへ
      const add = (geo, mat, x, y, z, rx, ry, rz, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); m.scale.set(sx || 1, sy || 1, sz || 1); m.renderOrder = 2; cat.add(m); return m }
      // ── 胴（丸くなって伏せる。お尻が高く、手前に前足。香箱に近い）──
      const body = add(SP(0.22, 20, 16), fur, 0, 0.15, -0.04, 0, 0, 0, 1.5, 0.78, 1.22)        // 胴
      add(SP(0.18), fur, -0.2, 0.17, -0.06, 0, 0, 0, 1.0, 0.95, 1.0)                            // お尻のふくらみ
      add(SP(0.19), white, 0.08, 0.085, 0.16, 0, 0, 0, 1.2, 0.5, 0.9)                           // 胸〜お腹の白
      for (const px of [-0.08, 0.08]) add(SP(0.05), white, 0.12 + 0, 0.045, 0.3 + 0, 0, 0, 0, 1.3, 0.8, 1.5).position.set(0.16 + px * 0.55, 0.05, 0.27) // 前足（白い足先）
      // 背の薄墨の縞（茶トラ）。胴に沿って弧を伏せる。
      for (const sx2 of [-0.16, -0.06, 0.04, 0.14]) add(new THREE.TorusGeometry(0.16, 0.016, 6, 14, Math.PI * 0.62), furD, sx2, 0.18, -0.02, 0, 0, Math.PI, 1.1, 1, 1.5)
      add(SP(0.2), furL, 0, 0.27, -0.04, 0, 0, 0, 1.3, 0.4, 1.0) // 背の明るみ
      // 尻尾（胴の手前へ巻き、先が淡い）
      const tail = add(new THREE.TorusGeometry(0.15, 0.038, 8, 20, Math.PI * 1.3), fur, 0.04, 0.08, 0.2, Math.PI / 2, 0, 0.4)
      add(SP(0.045), white, 0.2, 0.08, 0.28) // 尻尾の先（淡色）
      // ── 頭（顔をこちらへ。子群＝寝返り/呼吸でいっしょに動く）──
      const headG = new THREE.Group(); headG.position.set(0.1, 0.33, 0.22); headG.rotation.set(-0.46, 0.0, 0); cat.add(headG) // 顔をこちらへ上げて（見下ろす視点でも顔が見える・正面）
      const hAdd = (geo, mat, x, y, z, rx, ry, rz, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); m.scale.set(sx || 1, sy || 1, sz || 1); m.renderOrder = 3; headG.add(m); return m }
      hAdd(SP(0.125, 18, 15), fur, 0, 0, 0, 0, 0, 0, 1.05, 0.96, 0.96)              // 頭
      for (const s of [-1, 1]) hAdd(SP(0.07), fur, s * 0.085, -0.035, 0.05, 0, 0, 0, 0.95, 0.95, 0.95) // 頬のふくらみ
      hAdd(SP(0.062), white, 0, -0.055, 0.09, 0, 0, 0, 1.25, 0.92, 0.92)            // 口先（白マズル）
      hAdd(CO(0.02, 0.022, 3), pink, 0, -0.028, 0.135, Math.PI, 0, 0)               // 鼻（ピンクの逆三角）
      hAdd(CY(0.004, 0.028), dark, 0, -0.058, 0.125)                                // 口の縦線
      for (const s of [-1, 1]) hAdd(new THREE.TorusGeometry(0.018, 0.004, 5, 9, Math.PI), dark, s * 0.02, -0.072, 0.12, 0, 0, s > 0 ? Math.PI * 0.5 : Math.PI * 1.5) // ωの口
      // 閉じた目（やさしい弧＝うとうと。眠っている間）
      const eyesClosed = []; for (const s of [-1, 1]) eyesClosed.push(hAdd(new THREE.TorusGeometry(0.03, 0.006, 6, 14, Math.PI), dark, s * 0.052, 0.016, 0.112, 0, 0, Math.PI))
      // 開いた目（目を覚ます/撫でられるとこちらを見る。初期は隠す）。黒目＋緑の虹彩＋縦瞳孔＋キャッチライト。
      const iris = M(isNight ? 0x70794a : 0xa0ae66)
      const eyesOpen = []; for (const s of [-1, 1]) { const eg = new THREE.Group(); eg.position.set(s * 0.052, 0.02, 0.108); eg.visible = false; headG.add(eg)
        const ball = new THREE.Mesh(SP(0.025, 12, 10), dark); ball.scale.set(0.95, 1.3, 0.6); ball.renderOrder = 3; eg.add(ball)
        const ir = new THREE.Mesh(SP(0.017, 10, 8), iris); ir.position.z = 0.012; ir.scale.set(0.92, 1.12, 0.6); ir.renderOrder = 3; eg.add(ir)
        const pup = new THREE.Mesh(CY(0.0032, 0.028, 5), dark); pup.position.z = 0.02; pup.renderOrder = 3; eg.add(pup)
        const cl = new THREE.Mesh(SP(0.006, 8, 6), white); cl.position.set(s * 0.008, 0.014, 0.026); cl.renderOrder = 3; eg.add(cl)
        eyesOpen.push(eg) }
      const hit = new THREE.Mesh(SP(0.42, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(0, 0.22, 0.06); cat.add(hit) // 撫でる判定の当たり（不可視・大きめ）
      // 耳（外＝毛色／内＝ピンク。先を少し外へ）
      const ears = [], ears0 = []; for (const s of [-1, 1]) { ears.push(hAdd(CO(0.052, 0.092, 12), fur, s * 0.075, 0.115, -0.005, 0.12, 0, s * -0.2)); ears0.push(0.12); hAdd(CO(0.03, 0.055, 10), pink, s * 0.073, 0.108, 0.01, 0.12, 0, s * -0.2) }
      // 額のМ字縞（茶トラの印）
      for (const s of [-0.035, 0, 0.035]) hAdd(CY(0.005, 0.055), furD, s, 0.085, 0.05, 0.55, 0, 0)
      // ひげ（左右3本ずつ・細く）
      for (const s of [-1, 1]) for (const dy of [-0.018, 0, 0.018]) { const w = hAdd(CY(0.0018, 0.14, 4), whisk, s * 0.12, -0.03 + dy, 0.1); w.rotation.z = s * 1.45; w.rotation.y = -s * (0.2 + dy * 6) }
      const catShadow = floorShadow(0.5, 1.62, 0.78, 0.6) // 猫の接地影（移動について回る）
      winRoom.add(cat); winCat = { g: cat, body, tail, ears, ears0, headG, eyesClosed, eyesOpen, hit, catShadow, y0: 0.78, headX0: -0.46, headY0: 0.33, baseY: FY + 0.02, homeX: 0.5, homeZ: 1.62, tailT: 3 + R() * 5, flickT: 0, earT: 5 + R() * 6, earK: 0, settleT: 22 + R() * 30, settleP: 1, headT: 16 + R() * 24, headP: 1, alert: 0, alertTarget: 0, petAmt: 0, petActive: 0, wakeT: 26 + R() * 40, wakeHold: 0, purr: 0, relocT: 38 + R() * 50, relocP: 1, x0: 0.5, z0: 1.62, rot0: 0.38, x1: 0.5, z1: 1.62, rot1: 0.38 }
    }
    winRoom.position.set(0, eye.y - 1.5, eye.z - dWall)
    scene.add(winRoom)
  }

  active = {
    renderer, scene, camera, stage, raf: 0,
    yaw: 0, pitch: 0, yawTarget: 0, pitchTarget: 0,
    winOpen: 0, winOpenTarget: 0, // 窓をあける（ガラスが横にすべって外気が澄む）。winOpen=ease済みの実値
    winOpenP: 0,                  // 窓あけの線形進行(0..1)。これに ease-in-out をかけて winOpen にする
    lean: 0, leanTarget: 0,        // 身を乗り出す（枠を越えて前へ＝視界が広がる）。lean=ease済みの実値
    leanP: 0,                     // 乗り出しの線形進行(0..1)
    fovCur: 62,
    // ── 浮遊（空を飛ぶ）＆散策（歩く）モードの状態 ──
    flyEnabled: true,             // 立体の街・谷戸いずれも飛べる/歩ける（谷戸は谷筋に沿う狭めの箱）
    mode: 'window',               // 'window'（窓辺）| 'fly'（空を飛ぶ）| 'walk'（地上を歩く）
    flyTarget: 0,                 // 窓の外にいたい(1)/窓へ戻りたい(0)。fly/walk のどちらでも 1
    flyP: 0,                      // 窓⇄外の混ざり具合 0=窓 / 1=外（これをイージングして滑らかに出入り）
    flyPos: new THREE.Vector3(),  // 移動の中心点（“自分”）。引いたカメラはこの後ろ上から望む
    flyYaw: 0, flyPitch: 0, flyYawTarget: 0, flyPitchTarget: 0, // flyYaw=進路の向き（左スティックで旋回）／flyPitch=高さ角（右ドラッグ上下）
    cinema: 0, lastInputT: 0,      // オートシネマ: 無操作で最寄り名所をゆっくりオービット（操作で即復帰）
    arrivalSlow: 1,                // 目的地で自動減速する係数（霞の帯/城下でゆっくり）
    lookYawOff: 0, lookYawOffTarget: 0, lookDragging: false, // 見回しの横オフセット（右ドラッグ。進路は変えず、離すと0へ戻る）
    turnSmooth: 0,                // 旋回入力のスムージング値（手ブレを均し、急旋回を抑える＝快適な曲がり）
    vel: new THREE.Vector3(),     // 慣性つきの速度（離すと惰性で減速＝ホバリング）
    moveX: 0, moveY: 0,           // スティック入力(-1..1)。左で動かす（横=旋回・縦=前後）。離すと0
    climb: 0,                     // （旧）上昇/下降入力。スキームAでは未使用
    cruise: true,                 // スキームA: 自動巡航中か（とまる/すすむトグル）。とまる=その場でホバリング
    zoom: 1.56,                   // カメラの引き具合（ピンチ/ズームボタンで0.4=寄り〜3.0=引き）。初期値は「縮小ボタン2回ぶん」引いた値＝窓辺の既定を少し引き気味に
    zoomTarget: 1.56,             // ズームの目標値（ボタン/ピンチで設定→zoomがこれへ滑らかに追従＝確実で酔わない寄り引き）
    speedMul: 0.55,               // 飛行速度の倍率（既定はゆっくりめ。速く/遅くボタンで0.35〜1.7に調整）
    wide: false,                  // 視界を広げるモード（広角＋カメラを引いて高くから広い思案で操作）
    climb: 0,                     // 上昇/下降ボタン（+1=上昇 / -1=下降 / 0=なし。向きを変えず高さだけ変える）
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
  // 水際（海・川）は歩いて踏み込まない＝汀で止まる。歩行のみで使う。
  const wetAt = (x, z) => kind !== 'yato' && ((x > SEA.coast && heightAt(x, z) < SEA.level + 0.4) || Math.abs(x - RIVER.x) < RIVER.halfW)
  const tryWalk = (pos, dx, dz) => {
    const b = bound
    const nx = Math.max(-b.x, Math.min(b.xMax || b.x, pos.x + dx))
    const nz = Math.max(b.zMin, Math.min(b.zMax, pos.z + dz))
    if (!blockedAt(nx, pos.z) && !wetAt(nx, pos.z)) pos.x = nx // x方向だけ先に試す（壁/水際に沿って横へ滑る）
    if (!blockedAt(pos.x, nz) && !wetAt(pos.x, nz)) pos.z = nz // z方向だけ試す
  }
  // 着地地点が建物/樹冠の中なら、空いた近くの地点へそっと退避する（建物や木に埋もれて立たない）。
  const spawnBad = (x, z) => {
    const b = bound
    if (x < -b.x || x > (b.xMax || b.x) || z < b.zMin || z > b.zMax) return true // 箱の外には降りない
    if (kind !== 'yato') {
      if (x > SEA.coast && heightAt(x, z) < SEA.level + 0.6) return true // 海・汀には降りない（水没を防ぐ）
      if (Math.abs(x - RIVER.x) < RIVER.halfW + 1.3) return true // 川には降りない
    }
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
  const paper2 = document.createElement('div'); paper2.className = 'town3d-paper2'; stage.appendChild(paper2) // 紙目2層め（粗いにじみ）
  const bleed = document.createElement('div'); bleed.className = 'town3d-bleed'; stage.appendChild(bleed) // 縁のにじみ（一枚の絵として縁取る）
  const glass = document.createElement('div'); glass.className = 'town3d-glass'; stage.appendChild(glass)
  const cross = document.createElement('div'); cross.className = 'town3d-cross'; stage.appendChild(cross)
  const sill = document.createElement('div'); sill.className = 'town3d-sill'; stage.appendChild(sill)
  const frame2 = document.createElement('div')
  frame2.className = 'town3d-frame'
  stage.appendChild(frame2)
  // 室内の薄暗がり（周辺減光）。巨大box-shadowブラーは毎フレームの合成が重い→静的なradial-gradientの
  // 不透明度だけを動かす（合成が軽い＝端末が重くならない）。部屋の中ほど濃く、窓を開け/乗り出すと晴れる。
  const roomVig = document.createElement('div'); roomVig.className = 'town3d-roomvig'; stage.appendChild(roomVig)
  let clarityCur = -1
  let roomDarkCur = -1 // 室内の周辺減光の現在値（変化時だけ box-shadow を書き換える）
  let roomMatCur = -1  // 3Dの室内窓枠の不透明度の現在値（変化時だけマテリアルへ反映）
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
    qCap = cap; prFly = false
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

  // ── 天候・催しの発生中心（アンカー）。窓辺では原点＝従来どおり。飛行/歩行中は“自分”の位置と向きを中心に。
  //    これで雨や鳥・気球・花火などが、home だけでなく移動できる範囲のどこでも自分の周りで起きる。──
  const EYEY = eye.y
  const evAnchor = () => (active && active.mode !== 'window' && (active.flyP || 0) > 0.2)
    ? { x: active.flyPos.x, y: active.flyPos.y, z: active.flyPos.z, yaw: active.flyYaw || 0, fly: true }
    : { x: 0, y: 0, z: 0, yaw: 0, fly: false }
  // ローカル(右+x・上+y・前-z)を、アンカーの位置と向きへ回してワールド座標に。飛行中は高さを自分基準へ寄せる。
  const evPos = (lx, ly, lz, a) => { const c = Math.cos(a.yaw), s = Math.sin(a.yaw); return [a.x + lx * c - lz * s, (a.fly ? a.y - EYEY : 0) + ly, a.z + lx * s + lz * c] }

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
    // ax/ay/az＝雨の塊の中心。飛行中は“自分”を中心に追従し、海でも他時代の上空でも雨に包まれる。
    const writeSeg = (ax, ay, az) => { for (let i = 0; i < N; i++) { const h = i * 3, p = i * 6; pos[p] = head[h] + ax; pos[p + 1] = head[h + 1] + ay; pos[p + 2] = head[h + 2] + az; pos[p + 3] = head[h] + ax + 0.6; pos[p + 4] = head[h + 1] + ay - len; pos[p + 5] = head[h + 2] + az } }
    const fogFar0 = scene.fog.far
    let rbDone = false
    addFx({
      update: (age, dt) => {
        const k = Math.min(1, age / 5) * Math.min(1, Math.max(0, (dur - age) / 8)) // 立ち上がり5s・終い8s
        mat.opacity = 0.6 * k
        scene.fog.far = fogFar0 * (1 - 0.16 * k) // 雨で奥がけむる
        for (let i = 0; i < N; i++) { head[i * 3 + 1] -= spd[i] * dt; head[i * 3] += 4 * dt; if (head[i * 3 + 1] < -14) { head[i * 3 + 1] = 82 + R() * 16; head[i * 3] = (R() - 0.5) * 210 } }
        const a = evAnchor(); writeSeg(a.x, a.fly ? a.y - 47 : 0, a.z); geo.attributes.position.needsUpdate = true
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
    const a = evAnchor(); const [gx, gy, gz] = evPos(0, -16, eye.z - 195, a); grp.position.set(gx, gy, gz); grp.rotation.y = -a.yaw // 街の奥・地平から立ち上がる大アーチ（飛行中は進む先の正面へ。手前に建物があれば下部が隠れる。fog:false）
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
    const a = evAnchor(); g.rotation.y = -a.yaw // 飛行中は進む先を横切らせる
    let lx = dir > 0 ? -46 : 46; const ly = 46 + R() * 18, lz = -38 - R() * 26 // 空を背に飛ばす（山に紛れず映える）
    const setPos = (bob) => { const [wx, wy, wz] = evPos(lx, ly + bob, lz, a); g.position.set(wx, wy, wz) }
    setPos(0); scene.add(g)
    addFx({
      update: (age, dt) => { lx += dir * 10 * dt; setPos(Math.sin(age * 0.5) * 0.7); for (const b of sub) { const f = Math.sin(age * 9 + b.userData.ph) * 0.5; b.children.forEach((w) => { w.rotation.z = w.userData.side * f }) } return Math.abs(lx) < 50 },
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
    const a = evAnchor(); g.rotation.y = -a.yaw // 飛行中は進む先を横切らせる
    let lx = dir > 0 ? -44 : 44, ly = 26 + R() * 16; const lz = -48 - R() * 22
    const setP = () => { const [wx, wy, wz] = evPos(lx, ly, lz, a); g.position.set(wx, wy, wz) }
    setP(); scene.add(g)
    addFx({
      update: (age, dt) => { lx += dir * 5 * dt; ly += 0.22 * dt; setP(); g.rotation.z = Math.sin(age * 0.5) * 0.05; return Math.abs(lx) < 48 },
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
    const a = evAnchor(); g.rotation.y = -a.yaw // 飛行中は自分の上空に流す
    let lx = 40 + R() * 40, ly = 72 + R() * 18; const lz = -90 - R() * 30
    const setP = () => { const [wx, wy, wz] = evPos(lx, ly, lz, a); g.position.set(wx, wy, wz) }
    setP(); scene.add(g)
    const vx = -33 - R() * 12, vy = -16 - R() * 7, dur = 2.4 // ゆったり長く流れて見逃さない
    addFx({
      update: (age, dt) => { lx += vx * dt; ly += vy * dt; setP(); const o = Math.min(1, age / 0.25) * Math.max(0, 1 - age / dur); headMat.opacity = o; trailMat.opacity = o * 0.85; return age < dur },
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
      const a = evAnchor(); const [cx, cy, cz] = evPos((R() - 0.5) * 60, 56 + R() * 18, -70 - R() * 30, a) // 飛行中は自分の上空に開く
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
    g.add(new THREE.Line(tgeo, tmat))
    const a = evAnchor(); g.position.set(a.x, a.fly ? a.y - EYEY : 0, a.z); g.rotation.y = -a.yaw; scene.add(g) // 飛行中は自分の上空を横切る（飛行機雲も自分に追従）
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
        const a = evAnchor(), ax = a.x, ay = a.fly ? a.y - 47 : 0, az = a.z // 飛行中は“自分”を中心に雨が追従
        for (let i = 0; i < N; i++) { const h = i * 3, p = i * 6; pos[p] = head[h] + ax; pos[p + 1] = head[h + 1] + ay; pos[p + 2] = head[h + 2] + az; pos[p + 3] = head[h] + ax + 0.6; pos[p + 4] = head[h + 1] + ay - len; pos[p + 5] = head[h + 2] + az }
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
    const m = new THREE.Mesh(geo, mat); const a = evAnchor(); const [mx, my, mz] = evPos(0, 74, eye.z - 205, a); m.position.set(mx, my, mz); m.rotation.y = -a.yaw; m.frustumCulled = false; scene.add(m) // 飛行中は自分の進む先の空に懸かる
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
  veilEl = document.createElement('div'); veilEl.className = 'town3d-veil'; stage.appendChild(veilEl) // 霞の帯をくぐる白いベール
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

  // ── 操作トレイ（左下＝左親指の一角に飛行の補助操作を集約。バラけたボタンを一塊に） ──
  const pad = document.createElement('div'); pad.className = 'town3d-pad'; stage.appendChild(pad)
  // ── 操作レベルのゲージ（iPhoneの音量表示のように、今どのくらいの位置かを縦バーで示す）。
  // ボタンを押すと現れ、少し経つと静かに消える。淡い帯＝心地よく眺められる「おすすめ範囲」。
  // band=[下端,上端]（0..1）。set(v)で塗りの高さを更新、show()で表示してから自動で消す。
  const mkGauge = (wrap, band) => {
    const g = document.createElement('div'); g.className = 'town3d-gauge'
    const bd = document.createElement('div'); bd.className = 'town3d-gauge__band'
    bd.style.bottom = (band[0] * 100).toFixed(1) + '%'; bd.style.height = ((band[1] - band[0]) * 100).toFixed(1) + '%'
    const fill = document.createElement('div'); fill.className = 'town3d-gauge__fill'
    g.appendChild(bd); g.appendChild(fill); wrap.appendChild(g)
    let hideT = null, cur = -1
    return {
      set(v) { v = Math.max(0, Math.min(1, v)); if (Math.abs(v - cur) < 0.004) return; cur = v; fill.style.transform = 'scaleY(' + v.toFixed(3) + ')' },
      show() { g.classList.add('gauge--show'); if (hideT) clearTimeout(hideT); hideT = setTimeout(() => g.classList.remove('gauge--show'), 1500) },
    }
  }
  // ── ズームボタン（＋寄る／−引く）。ピンチが効きにくい/不安なので、確実に効く明示ボタンを併置（地図/航空アプリ流儀）。
  // zoom は小さいほど寄り(0.4)・大きいほど引き(3.0)。＋で寄る＝zoomTargetを下げる、−で引く＝上げる。frameでzoomが滑らかに追従。
  const zoomWrap = document.createElement('div'); zoomWrap.className = 'town3d-zoom'
  const zoomIn = document.createElement('button'); zoomIn.className = 'town3d-zoom__btn'; zoomIn.textContent = '＋'; zoomIn.setAttribute('aria-label', '寄る')
  const zoomOut = document.createElement('button'); zoomOut.className = 'town3d-zoom__btn'; zoomOut.textContent = '−'; zoomOut.setAttribute('aria-label', '引く')
  zoomWrap.appendChild(zoomIn); zoomWrap.appendChild(zoomOut); pad.appendChild(zoomWrap)
  const zoomGauge = mkGauge(zoomWrap, [0.31, 0.73]) // ＋寄るで上がる。おすすめ＝寄り過ぎ/引き過ぎない中庸
  let zoomShown = false
  const nudgeZoom = (factor) => { if (!active) return; active.zoomTarget = Math.max(0.4, Math.min(3.0, active.zoomTarget * factor)); zoomGauge.show() }
  let zoomHold = null
  const stopZoomHold = () => { if (zoomHold) { clearInterval(zoomHold); zoomHold = null } }
  // ＋寄る／−引く。タップで一段、押しっぱなし(長押し)で連続ズーム、連打でも各タップが効く（確実な寄り引き）。
  for (const [btn, tap, hold] of [[zoomIn, 0.8, 0.955], [zoomOut, 1 / 0.8, 1 / 0.955]]) {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation()
      try { btn.setPointerCapture(e.pointerId) } catch { /* 無視 */ }
      nudgeZoom(tap)                                    // タップで一段
      stopZoomHold()
      zoomHold = setInterval(() => nudgeZoom(hold), 55) // 長押しで滑らかに連続ズーム
    })
    const end = (e) => { if (e) e.stopPropagation(); stopZoomHold() }
    btn.addEventListener('pointerup', end)
    btn.addEventListener('pointercancel', end)
    btn.addEventListener('pointerleave', end)
  }
  // ── 速度ボタン（速く／遅く＝飛行速度の調整。左下。タップで一段、長押しで連続。既定はゆっくり） ──
  const speedWrap = document.createElement('div'); speedWrap.className = 'town3d-speed'
  const spUp = document.createElement('button'); spUp.className = 'town3d-speed__btn'; spUp.textContent = '速く'; spUp.setAttribute('aria-label', '速く飛ぶ')
  const spDn = document.createElement('button'); spDn.className = 'town3d-speed__btn'; spDn.textContent = '遅く'; spDn.setAttribute('aria-label', 'ゆっくり飛ぶ')
  speedWrap.appendChild(spUp); speedWrap.appendChild(spDn); pad.appendChild(speedWrap)
  const speedGauge = mkGauge(speedWrap, [0.26, 0.74]) // 速くで上がる。おすすめ＝ゆったり〜小気味よい間
  let speedShown = false
  const nudgeSpeed = (d) => { if (active) { active.speedMul = Math.max(0.35, Math.min(1.7, active.speedMul + d)); speedGauge.show() } }
  let speedHold = null
  const stopSpeedHold = () => { if (speedHold) { clearInterval(speedHold); speedHold = null } }
  for (const [btn, step] of [[spUp, 0.12], [spDn, -0.12]]) {
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { btn.setPointerCapture(e.pointerId) } catch { /* 無視 */ } nudgeSpeed(step); stopSpeedHold(); speedHold = setInterval(() => nudgeSpeed(step * 0.5), 70) })
    const end = (e) => { if (e) e.stopPropagation(); stopSpeedHold() }
    btn.addEventListener('pointerup', end); btn.addEventListener('pointercancel', end); btn.addEventListener('pointerleave', end)
  }
  // 視界を広げるモード（広角＋引き＝広い思案で操る）。トグル式。
  const wideWrap = document.createElement('div'); wideWrap.className = 'town3d-wide'
  const wideBtn = document.createElement('button'); wideBtn.className = 'town3d-wide__btn'; wideBtn.textContent = '広く'; wideBtn.setAttribute('aria-label', '視界を広げる')
  wideWrap.appendChild(wideBtn); pad.appendChild(wideWrap)
  let wideShown = false
  wideBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (active) { active.wide = !active.wide; wideBtn.textContent = active.wide ? '標準' : '広く'; wideWrap.classList.toggle('wide--active', active.wide) } })
  // 上昇/下降（右・ズームの上）。向きを変えずに高さだけ＝毎回上を向かなくてよい。押している間だけ昇降。
  const climbWrap = document.createElement('div'); climbWrap.className = 'town3d-climb'
  const climbUp = document.createElement('button'); climbUp.className = 'town3d-climb__btn'; climbUp.textContent = '↑'; climbUp.setAttribute('aria-label', '上昇')
  const climbDn = document.createElement('button'); climbDn.className = 'town3d-climb__btn'; climbDn.textContent = '↓'; climbDn.setAttribute('aria-label', '下降')
  climbWrap.appendChild(climbUp); climbWrap.appendChild(climbDn); pad.appendChild(climbWrap)
  const altGauge = mkGauge(climbWrap, [0.12, 0.65]) // ↑上昇で上がる＝今の高さ。おすすめ＝街を見渡せる低〜中空
  let climbShown = false
  for (const [cbtn, dir] of [[climbUp, 1], [climbDn, -1]]) {
    const cstart = (e) => { e.preventDefault(); e.stopPropagation(); try { cbtn.setPointerCapture(e.pointerId) } catch { /* 無視 */ } if (active) active.climb = dir; altGauge.show() }
    const cend = (e) => { if (e) e.stopPropagation(); if (active) active.climb = 0 }
    cbtn.addEventListener('pointerdown', cstart); cbtn.addEventListener('pointerup', cend); cbtn.addEventListener('pointercancel', cend); cbtn.addEventListener('pointerleave', cend)
  }

  function frame() {
    if (!active) return
    active.raf = requestAnimationFrame(frame)
    if (document.hidden) return // 非アクティブ（タブ切替/画面ロック）時は描画も更新も止める＝発熱・電池配慮（CLAUDE.md）
    const t = (performance.now() - startT) / 1000
    // 約30fpsへ間引く（描画と影パスを半減＝発熱を抑える）。dtはクロックから取るので動きは滑らかなまま。
    // 休息中（窓辺で操作も飛行も無く4秒以上経過）は更に約22fpsへ落とす＝じっと眺める長い時間の電池/発熱を抑える。
    // 操作・飛行・イベント中は30fpsを保つので滑らかさは損なわない。
    const restIdle = active.mode === 'window' && (active.flyP || 0) < 0.05 && (performance.now() - (active.lastInputT || 0)) > 4000
    if (t - lastDraw < (restIdle ? 0.045 : 0.032)) return
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
      if (u.loiter) { // ランドマークの賑わい: 定位置の周りをゆっくり佇み歩き、体の向きを少しずつ変える
        const px = u.hx + Math.sin(t * u.sp + u.ph) * u.rad
        const pz = u.hz + Math.cos(t * u.sp * 0.8 + u.ph * 1.3) * u.rad
        p.position.set(px, heightAt(px, pz) + Math.abs(Math.sin(t * 2.4 + u.ph)) * 0.05, pz)
        p.rotation.y = u.face + Math.sin(t * 0.3 + u.ph) * 0.7
        continue
      }
      u.z += u.dir * u.speed * dt
      if (u.z > 20) u.z = -88
      if (u.z < -88) u.z = 20
      p.position.set(u.x, heightAt(u.x, u.z) + Math.abs(Math.sin(t * 5 + u.ph)) * 0.06, u.z)
      p.rotation.y = u.dir > 0 ? 0 : Math.PI
    }
    // 作り込んだ住人: エリア内をゆっくり行き交い（手足を振って歩く）、たまに佇んで見回す
    for (const r of residents) { const u = r.userData
      if (u.moving) {
        const dx = u.tx - r.position.x, dz = u.tz - r.position.z, d = Math.hypot(dx, dz)
        if (d < 0.28) { u.moving = false; u.pauseT = 1.5 + R() * 4 } // 着いた→ひと休み
        else {
          const step = Math.min(d, u.speed * dt), nx = r.position.x + dx / d * step, nz = r.position.z + dz / d * step
          const ph = t * u.speed * 5.2 + u.ph, sw = Math.sin(ph)
          r.position.set(nx, heightAt(nx, nz) + Math.abs(sw) * (u.legs.length ? 0.03 : 0.014), nz) // 歩のバウンド（着物は控えめ）
          u.face = Math.atan2(dx, dz)
          for (let i = 0; i < u.legs.length; i++) u.legs[i].rotation.x = (i ? -sw : sw) * 0.5 // 脚を交互に
          for (let i = 0; i < u.arms.length; i++) u.arms[i].rotation.x = (u.arms[i].userData.base || 0) + (i ? sw : -sw) * 0.34 // 腕は逆位相
          if (u.headG) u.headG.rotation.y = Math.sin(t * 0.3 + u.ph) * 0.2
        }
      } else {
        u.pauseT -= dt
        for (let i = 0; i < u.legs.length; i++) u.legs[i].rotation.x *= Math.max(0, 1 - dt * 5)
        for (let i = 0; i < u.arms.length; i++) u.arms[i].rotation.x = (u.arms[i].userData.base || 0) - 0.05 + Math.sin(t * 1.15 + u.ph + i * 3.1) * 0.05 // 非対称＋わずかに前へ休める
        if (u.headG) { u.headG.rotation.y = Math.sin(t * 0.22 + u.ph) * 0.5; u.headG.position.y = 1.6 + Math.sin(t * 1.5 + u.ph) * 0.004 }
        if (u.pauseT <= 0) { const a = R() * 6.28, rr = 1.5 + R() * u.rad, nx = u.ax + Math.cos(a) * rr, nz = u.az + Math.sin(a) * rr
          if (heightAt(nx, nz) > SEA.level + 0.6) { u.tx = nx; u.tz = nz; u.moving = true } else u.pauseT = 1 + R() * 2 }
      }
      let ddy = u.face - r.rotation.y; while (ddy > Math.PI) ddy -= 6.2832; while (ddy < -Math.PI) ddy += 6.2832
      r.rotation.y += ddy * Math.min(1, dt * 6) // 進行方向へなめらかに向き直る
    }
    // 2.5Dキャラ（板ポリ）はカメラの方を向きつつ、見る角度に応じて8方向に焼いた絵を出し分ける（紙人形＝Doom方式）
    for (const sp of animeSprites) {
      const toCam = Math.atan2(camera.position.x - sp.position.x, camera.position.z - sp.position.z)
      sp.rotation.y = toCam
      const ud = sp.userData, n = ud.views.length
      let rel = toCam - ud.facing; rel = Math.atan2(Math.sin(rel), Math.cos(rel)) // -π..π（カメラが人物の正面からどれだけ回り込んでいるか）
      let idx = Math.round(rel / (Math.PI * 2 / n)); idx = ((idx % n) + n) % n
      if (idx !== ud.cur) { ud.mat.map = ud.views[idx]; ud.mat.needsUpdate = true; ud.cur = idx }
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
    if (carousel) carousel.rotation.y += dt * 0.3 // メリーゴーラウンドがゆっくり回る
    if (teacups) { teacups.rotation.y += dt * 0.5; for (const cup of teacups.children) cup.rotation.y -= dt * 1.1 } // 台が回り、各カップは逆に回る
    for (const sp of steamPuffs) { const cy = (t * 0.5 + sp.ph) % 2.4, p = cy / 2.4; sp.mesh.position.y = sp.base + p * 1.7; sp.mesh.position.x = 0.4 + Math.sin(t * 1.3 + sp.ph) * 0.18; sp.mesh.material.opacity = 0.32 * Math.sin(p * Math.PI); sp.mesh.scale.setScalar(0.55 + p * 0.8) } // 屋台の湯気が立ちのぼる
    for (const k of koinobori) { k.grp.rotation.y = Math.sin(t * 1.1 + k.ph) * 0.32; k.grp.rotation.z = 0.05 + Math.sin(t * 0.85 + k.ph) * 0.12 } // 鯉のぼりが風になびく
    for (const sb of swanBoats) { const u = sb.userData, a = t * 0.25 + u.ph; sb.position.set(u.cx + Math.cos(a) * u.rad, sb.position.y, u.cz + Math.sin(a) * u.rad); sb.rotation.y = -a + Math.PI / 2 } // スワンボートが池を漂う
    for (const b of boats) { b.position.y = SEA.level + 0.15 + Math.sin(t * 0.8 + b.userData.ph) * 0.12; b.rotation.z = Math.sin(t * 0.7 + b.userData.ph) * 0.05 } // 小舟が波に揺れる
    if (seaTex) { seaTex.offset.y = (t * 0.012) % 1; seaTex.offset.x = Math.sin(t * 0.06) * 0.01 } // 海面のさざ波がゆっくり流れる
    if (seaUniforms) seaUniforms.uTime.value = t // 海面のうねり・きらめきの位相
    if (lightBeam) lightBeam.rotation.y = t * 0.5 // 灯台の光芒が回る
    for (const g of gulls) { const u = g.userData, a = t * u.sp + u.ph; g.position.set(u.cx + Math.cos(a) * u.rad, u.y + Math.sin(a * 2) * 0.7, u.cz + Math.sin(a) * u.rad); g.rotation.y = -a - (u.sp > 0 ? Math.PI / 2 : -Math.PI / 2); const fl = Math.sin(t * 7 + u.ph) * 0.5; g.children[1].rotation.x = fl; g.children[2].rotation.x = -fl } // 海鳥が旋回しはばたく
    for (const c of critters) { const a = t * 0.55 + c.ph // 蝶/蜻蛉がふわふわ舞う
      if (c.type === 'fly') { c.g.position.set(c.cx + Math.cos(a) * c.rad, c.cy + Math.sin(a * 1.7) * 0.7, c.cz + Math.sin(a * 0.8) * c.rad); c.g.rotation.y = a; const f = Math.sin(t * 9 + c.ph) * 1.2; c.g.children.forEach((w) => { w.rotation.y = w.userData.side * f }) }
      else { c.g.position.set(c.cx + Math.cos(a * 1.5) * c.rad, c.cy + Math.sin(a * 2.2) * 0.4, c.cz + Math.sin(a * 1.2) * c.rad); c.g.rotation.y = a * 1.5 + Math.PI / 2 } }
    if (crane) { // クレーンのトロリーが横行し、フックが上下する（荷役）
      const tx2 = 5.5 + Math.sin(t * 0.22) * 7, hy = 6.2 + Math.sin(t * 0.5) * 2.6
      crane.trolley.position.x = tx2
      crane.hook.position.set(tx2, hy, 0)
      crane.hcable.position.set(tx2, (12 + hy) / 2, 0); crane.hcable.scale.y = Math.max(0.2, 12 - hy)
    }
    if (tug) { // タグボートが湾をゆっくり巡る
      const u = tug.userData, a = t * 0.1
      const x = u.cx + Math.cos(a) * u.rad, z = u.cz + Math.sin(a) * u.rad * 0.6
      tug.position.set(x, SEA.level + 0.2 + Math.sin(t * 0.8) * 0.1, z)
      tug.rotation.y = -a + Math.PI / 2; tug.rotation.z = Math.sin(t * 0.7) * 0.04
    }
    for (const fj of fishJumps) { // 魚が放物線で跳ね、波紋が広がる
      const cy = (t - fj.t0) % fj.period
      if (cy < fj.jumpDur) { const p = cy / fj.jumpDur; fj.fish.visible = true; fj.fish.position.set(fj.x, SEA.level + Math.sin(p * Math.PI) * 2.2, fj.z); fj.fish.rotation.z = (p - 0.5) * 2.4 } else fj.fish.visible = false
      const rd = 2.2 // 波紋の寿命
      if (cy < rd) { fj.ripple.visible = true; const rp = cy / rd; fj.ripple.scale.setScalar(0.3 + rp * 3.0); fj.ripple.material.opacity = 0.45 * (1 - rp) } else fj.ripple.visible = false
    }
    for (const g of balloons) { // 熱気球が空をゆっくり漂う
      const u = g.userData, a = t * u.sp + u.ph
      g.position.set(u.cx + Math.cos(a) * u.rad, u.y + Math.sin(t * 0.25 + u.ph) * 1.6, u.cz + Math.sin(a) * u.rad * 0.7)
      g.rotation.y = a * 0.5; g.rotation.z = Math.sin(t * 0.35 + u.ph) * 0.045
    }
    if (ferry) { // 連絡船が湾を大きな楕円で渡る
      const u = ferry.userData, a = -t * 0.07 + 1.2 // タグと逆回りでゆっくり
      const x = u.cx + Math.cos(a) * u.rx, z = u.cz + Math.sin(a) * u.rz
      const x2 = u.cx + Math.cos(a + 0.02) * u.rx, z2 = u.cz + Math.sin(a + 0.02) * u.rz
      ferry.position.set(x, SEA.level + 0.2 + Math.sin(t * 0.6) * 0.08, z)
      ferry.rotation.y = Math.atan2(x2 - x, z2 - z); ferry.rotation.z = Math.sin(t * 0.5) * 0.025
    }
    for (const tr of [train, train2]) if (tr) { // 電車が線路を走る（端まで行くと反対端から再び現れる）
      const u = tr.userData
      // 各駅停車（train のみ）: 駅(x≈30)の手前で減速・停車し、しばらくして発車する
      let move = true
      if (u.stops) {
        const sX = 25 // 編成中央がホーム中央(x≈34)に来る停車位置（u.xは最後尾）
        if (!u.stopDone && u.x > sX - 7 && u.x < sX) { u.speed2 = Math.max(0, u.speed * (sX - u.x) / 7) } // 減速
        else u.speed2 = u.speed
        if (!u.stopDone && u.x >= sX - 0.3) { if (!u.stopUntil) u.stopUntil = t + 3.2; if (t < u.stopUntil) move = false; else { u.stopDone = true } } // 停車→発車
        if (u.stopDone && u.x > sX + 10) { u.stopDone = false; u.stopUntil = 0 } // 駅を出たら次の周回用にリセット
      }
      if (move) u.x += (u.stops ? (u.speed2 ?? u.speed) : u.speed) * dt
      if (u.x > RAIL.x1 + 2) { u.x = RAIL.x0 - u.len; u.stopDone = false; u.stopUntil = 0 }
      tr.position.set(u.x, 0, RAIL.z)
      for (const car of tr.children) car.position.y = heightAt(u.x + car.userData.ox, RAIL.z) + 0.05
    }
    if (crossing && train) { // 踏切: 電車が近づくと遮断機が下り、警報灯が交互に点滅
      const active = Math.abs(train.userData.x - crossing.cx) < 13
      for (const pv of crossing.gates) { const target = active ? 0 : pv.userData.barDir * 1.45; pv.rotation.z += (target - pv.rotation.z) * Math.min(1, dt * 3) }
      const blink = Math.sin(t * 7) > 0
      for (const pair of crossing.lamps) { pair[0].material.color.setHex(active && blink ? 0xff3020 : 0x4a1410); pair[1].material.color.setHex(active && !blink ? 0xff3020 : 0x4a1410) }
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
    if (seasonFall) { // 季節の降りもの（公園のあたりに舞う花びら/落ち葉。範囲内で循環）
      const f = seasonFall
      for (let i = 0; i < f.N; i++) {
        const k = i * 3
        f.pos[k + 1] -= f.spd[i] * dt
        f.pos[k] += Math.sin(t * 0.7 + f.phs[i]) * f.swirl * dt
        f.pos[k + 2] += Math.cos(t * 0.5 + f.phs[i]) * f.swirl * 0.4 * dt
        if (f.pos[k + 1] < f.floor) { f.pos[k + 1] = f.floor + 18 + Math.random() * 4; f.pos[k] = f.bx + (Math.random() - 0.5) * f.R0 * 2; f.pos[k + 2] = f.bz + (Math.random() - 0.5) * f.R0 * 2 }
      }
      f.pts.geometry.attributes.position.needsUpdate = true
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
    // 別世界感: 飛ぶほど霧を晴らして遠くの街を壮大に見せ、目的地に近いほどその時代の空気（色・露出）へ移す。
    if (flyAmt > 0.02) {
      active.fogTouched = true
      const fp = active.flyPos
      // リベール範囲を広げ(230)、近づくほど強く霧を晴らす(最大fog.far≈3.3倍)＝霞の向こうから街全体が早めに立ち上がる。
      // 拠点は現代から470/486・互いに618離れているので、この広い晴らしでも現代や別の時代と共視界に入らない。
      const edoP = flyAmt * Math.max(0, 1 - Math.hypot(fp.x - EDO.x, fp.z - EDO.z) / 255)
      const senP = flyAmt * Math.max(0, 1 - Math.hypot(fp.x - SENGOKU.x, fp.z - SENGOKU.z) / 255)
      const taiP = flyAmt * Math.max(0, 1 - Math.hypot(fp.x - TAISHO.x, fp.z - TAISHO.z) / 255)
      const clear = flyAmt * (0.55 + 1.9 * Math.max(edoP, senP, taiP)) // 飛ぶと少し晴れ(白いモヤの圧迫を緩める)、目的地に近いほど大きく晴れて街が広く見える
      // 霧の「始まり(near)」を大きく奥へ押し出す＝今飛んでいる近距離はくっきり見える（実機FB「飛行中に近くの海面まで白い」）。
      // far は据え置きで遠景(home/別の島)は隠したまま＝共視界は維持。near<far を保証。
      scene.fog.near = FOG.near * (1 + clear * 3.6); scene.fog.far = Math.max(scene.fog.near + 20, FOG.far * (1 + clear))
      TMP_FOGC.copy(baseFogCol)
      TMP_FOGC.lerp(FLIGHT_WARM, flyAmt * 0.4) // 渡りの霧を冷たい白から懐かしい琥珀色へ＝エモい/ノスタルジックに
      if (edoP > 0.001) TMP_FOGC.lerp(EDO_FOGC, edoP * 0.56) // 近づく霞を時代の色(金茶)へ＝白い空虚でなく空気のある遠景
      if (senP > 0.001) TMP_FOGC.lerp(SEN_FOGC, senP * 0.72) // 戦国は冷たく薄暗い別世界へ
      if (taiP > 0.001) TMP_FOGC.lerp(TAISHO_FOGC, taiP * 0.58) // 大正は暖かなセピア薔薇の港町の空気へ
      scene.fog.color.copy(TMP_FOGC)
      renderer.toneMappingExposure = baseExposure * (1 - edoP * 0.03 - senP * 0.14 + taiP * 0.03) // 戦国=暗い山城/江戸=明るい城下/大正=ほの明るい港町で差別化
      // 空ドームも飛行中は黄昏の暖色へ寄せる＝世界全体が懐かしい色になり、白いモヤの孤独感でなく心地よい郷愁に。
      // 時代に着いたらその色が勝つよう、純粋な「渡りの空」は近接していない時(街色 prox が低い時)ほど強く効かせる。
      const skyWarm = flyAmt * 0.5 * (1 - 0.6 * Math.max(edoP, senP, taiP))
      skyUniTop.value.copy(skyTop0).lerp(SKY_WARM_TOP, skyWarm)
      skyUniBot.value.copy(skyHor0).lerp(SKY_WARM_BOT, skyWarm)
    } else if (active.fogTouched) {
      active.fogTouched = false
      scene.fog.near = FOG.near; scene.fog.far = FOG.far; scene.fog.color.copy(baseFogCol); renderer.toneMappingExposure = baseExposure
      skyUniTop.value.copy(skyTop0); skyUniBot.value.copy(skyHor0) // 窓辺に戻ったら空の色を基準へ復元
    }
    // 別世界の気配: 時代の粒子（江戸=桜/蛍・戦国=火の粉）と霞の帯の白いベール（関門をくぐる瞬間に白む）
    if (flyAmt > 0.02) {
      const fp = active.flyPos, dEdo = Math.hypot(fp.x - EDO.x, fp.z - EDO.z), dSen = Math.hypot(fp.x - SENGOKU.x, fp.z - SENGOKU.z), dTai = Math.hypot(fp.x - TAISHO.x, fp.z - TAISHO.z)
      const updFx = (fx, prox, fall) => { if (!fx) return; const p = fx.g.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) + fall * dt * (1.2 + (i % 5) * 0.32); if (fall < 0 && y < fx.y0) y = fx.y0 + fx.yH; else if (fall > 0 && y > fx.y0 + fx.yH) y = fx.y0; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t * 0.45 + fx.ph[i]) * dt * 0.9) } p.needsUpdate = true; fx.m.opacity = Math.min(0.8, prox * 0.95) }
      updFx(edoFx, flyAmt * Math.max(0, 1 - dEdo / 130), isNight ? 0.38 : -0.95) // 夜の蛍はゆらり昇る/昼の桜はゆっくり散る
      updFx(senFx, flyAmt * Math.max(0, 1 - dSen / 130), 1.05) // 火の粉はゆっくり昇る
      updFx(taiFx, flyAmt * Math.max(0, 1 - dTai / 130), isNight ? 0.42 : -0.7) // 大正: 夜の灯の粉は昇る/昼の花びらは散る
      // 関門(霞の帯)を儀式のようにくぐる: 帯を広げて白に包まれる間を延ばし(pk幅0.22)、その間は自動で減速。
      const pk = (p) => Math.max(0, 1 - Math.abs(p - 0.44) / 0.22)
      const veilA = Math.max(pk(flyAmt * Math.max(0, 1 - dEdo / 230)), pk(flyAmt * Math.max(0, 1 - dSen / 230)), pk(flyAmt * Math.max(0, 1 - dTai / 230)))
      if (veilEl) veilEl.style.opacity = (veilA * 0.5).toFixed(3) // 関門の白ベールは控えめに（白い圧迫感を避け、くぐる気配だけ残す）
      // 目的地で自動減速: 近づくほど・霞の帯ほどゆっくり＝行き過ぎず、街にそっと着いて巡る
      const dMin = Math.min(dEdo, dSen, dTai)
      let slow = 1
      if (dMin < 200) { const approach = Math.max(0, Math.min(1, (200 - dMin) / 120)), band = Math.max(0, 1 - Math.abs(dMin - 129) / 52); slow = Math.max(0.36, 1 - approach * 0.4 - band * 0.22) }
      active.arrivalSlow = slow
      // 城下を行き交う人（近くの城下だけ動かす＝大通り/山道をゆっくり往復し、歩みに合わせて上下）
      for (const w of cityWalkers) {
        if (w.road) { // 街道を蛇行に沿って往復する旅人（戦国の谷）
          if (Math.hypot(fp.x - w.x0, fp.z - w.z0) > 150) continue
          const tt = (t * w.sp + w.ph) % 2, f = tt < 1 ? tt : 2 - tt, p = w.fn(f * w.len)
          w.g.position.set(p.x, p.y, p.z); w.g.rotation.y = tt < 1 ? 0 : Math.PI
          w.g.children[0].position.y = 0.4 + Math.abs(Math.sin(t * 5 + w.ph * 3)) * 0.06
          continue
        }
        if (Math.hypot(fp.x - w.cx, fp.z - w.cz) > 150) continue
        const tt = (t * w.sp + w.ph) % 2, f = tt < 1 ? tt : 2 - tt, r = w.r0 + (w.r1 - w.r0) * f
        const px = w.cx + Math.cos(w.ang) * r, pz = w.cz + Math.sin(w.ang) * r
        w.g.position.set(px, w.y0 + (w.y1 - w.y0) * f, pz); w.g.rotation.y = w.ang + (tt < 1 ? Math.PI : 0)
        w.g.children[0].position.y = 0.4 + Math.abs(Math.sin(t * 5 + w.ph * 3)) * 0.06
      }
      // 戦国の谷の霧がゆっくり横へ漂う（近くを飛ぶ時だけ更新＝軽量）
      if (senMist.length && Math.hypot(fp.x - SENGOKU.x, fp.z - SENGOKU.z) < 220) for (let i = 0; i < senMist.length; i++) { const m = senMist[i]; m.position.x += Math.sin(t * 0.12 + i * 1.7) * dt * 0.6 }
      // 大正の路面電車が大通りを往復（近くを飛ぶ時だけ更新）
      if (trams.length && Math.hypot(fp.x - TAISHO.x, fp.z - TAISHO.z) < 240) for (const tm of trams) { const span = tm.x1 - tm.x0, u = ((t * tm.sp + tm.ph) % (span * 2)), fwd = u < span, x = tm.x0 + (fwd ? u : span * 2 - u); tm.g.position.set(x, heightAt(x, tm.z) + 0.16, tm.z); tm.g.rotation.y = fwd ? Math.PI / 2 : -Math.PI / 2 }
      // ── 渡りの海の鳥: 海の上を飛んでいると時々、群れがカメラの近くを横切る（長い渡りの退屈しのぎ＋海らしさ）。鳴き声も。──
      if (active.mode !== 'walk' && flyAmt > 0.6 && heightAt(fp.x, fp.z) < SEA.level + 0.5) {
        crossT += dt
        if (crossT > crossNext) {
          if (!crossFlock) { crossFlock = new THREE.Group(); crossFlock.userData.wings = []
            const bm = new THREE.MeshBasicMaterial({ color: isNight ? 0x3a4452 : 0x4a4a44, fog: true })
            for (let i = 0; i < 6; i++) { const bird = new THREE.Group(); for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.32), bm); w.position.x = s * 0.5; w.userData.side = s; bird.add(w); crossFlock.userData.wings.push(w) } bird.position.set((R() - 0.5) * 6, (R() - 0.5) * 2.5, (i - 3) * 1.4); crossFlock.add(bird) }
            scene.add(crossFlock) }
          const ang = Math.atan2(active.vel.z || 0.5, active.vel.x || 0.5) + (R() < 0.5 ? 1 : -1) * 1.25 // 進行方向の斜め前から横切る
          crossFlock.position.set(fp.x + Math.cos(ang) * 42, fp.y + 3 + R() * 9, fp.z + Math.sin(ang) * 42)
          crossFlock.userData.vx = -Math.cos(ang) * 7.5; crossFlock.userData.vz = -Math.sin(ang) * 7.5
          crossFlock.rotation.y = Math.atan2(crossFlock.userData.vx, crossFlock.userData.vz)
          crossFlock.visible = true; onSeaBird(); crossT = 0; crossNext = 10 + R() * 13
        }
        if (crossFlock && crossFlock.visible) { crossFlock.position.x += crossFlock.userData.vx * dt; crossFlock.position.z += crossFlock.userData.vz * dt
          const flap = Math.sin(t * 9) * 0.55; for (const w of crossFlock.userData.wings) w.rotation.z = -w.userData.side * flap
          if (Math.hypot(crossFlock.position.x - fp.x, crossFlock.position.z - fp.z) > 75) crossFlock.visible = false }
      } else if (crossFlock) crossFlock.visible = false
      // 道中の小島の鳥: 近づくと一斉に舞い立ち、機が離れるとまた枝へ戻る
      for (const fl of islandFlocks) {
        const d = Math.hypot(fp.x - fl.cx, fp.z - fl.cz)
        if (fl.state === 'perched') {
          if (d < 34 && flyAmt > 0.5) { // 飛んで近づいた瞬間＝驚いて飛び立つ
            fl.state = 'flying'; fl.t = 0
            const aw = Math.atan2(fl.cz - fp.z, fl.cx - fp.x) // 機から島の向こう側へ逃げる
            for (const bd of fl.birds) { const a = aw + (R() - 0.5) * 1.7, sp = 7 + R() * 6; bd.vx = Math.cos(a) * sp; bd.vz = Math.sin(a) * sp; bd.vy = 4 + R() * 4 }
          }
        } else {
          fl.t += dt
          for (const bd of fl.birds) {
            bd.g.position.x += bd.vx * dt; bd.g.position.y += bd.vy * dt; bd.g.position.z += bd.vz * dt
            bd.vy = Math.max(2.0, bd.vy - 1.3 * dt) // 上昇のあと水平へ抜けて去る
            const fp2 = Math.sin(t * 12 + bd.g.userData.ph) * 0.6; bd.g.children.forEach((w) => { w.rotation.z = w.userData.side * fp2 }) // 羽ばたき
            bd.g.rotation.y = Math.atan2(bd.vx, bd.vz)
          }
          if (fl.t > 7 && d > 60) { for (const bd of fl.birds) { bd.g.position.set(bd.bx, bd.by, bd.bz); bd.vx = bd.vy = bd.vz = 0; bd.g.rotation.y = 0; bd.g.children.forEach((w) => { w.rotation.z = 0 }) } fl.state = 'perched' } // 機が去ったらまた枝で羽を休める
        }
      }
    } else if (veilEl && veilEl.style.opacity !== '0') { veilEl.style.opacity = '0'; if (edoFx) edoFx.m.opacity = 0; if (senFx) senFx.m.opacity = 0; if (taiFx) taiFx.m.opacity = 0; active.arrivalSlow = 1 }
    active.winOpen = wo; active.lean = lean // 外部参照（見回し幅の算出など）用に実値を保持
    active.zoom += (active.zoomTarget - active.zoom) * 0.16 // ズームを目標へ滑らかに追従（ボタン/ピンチ共通＝確実に効き、急変で酔わない）

    // 乗り出しを戻すと見上げの可動域も縮むので、目標ピッチも追従して下げる（上を向いたまま固まらない）
    const plim = pitchLimits(lean)
    active.pitchTarget = Math.max(-plim.dn, Math.min(plim.up, active.pitchTarget))
    // 見回しを目標へ滑らかに追従（イージング＝指を離しても余韻があるヌルヌルの見回し）
    active.yaw += (active.yawTarget - active.yaw) * 0.16
    active.pitch += (active.pitchTarget - active.pitch) * 0.16
    // 見回し（息づかいの微揺れ付き。細い桟/畳がチカチカするので微揺れは控えめに）
    const yaw = active.yaw + Math.sin(t * 0.2) * 0.004
    const pitch = active.pitch
    // 窓をあけると視界がふっと前へ開け(=控えめ)、乗り出すとさらに前へ・下へ寄って画角が広がる（枠を越えて街へ顔を出す）
    // 室内視差: 部屋の中（乗り出していない間）は、見回しに連れてカメラがわずかに平行移動する＝頭を動かして
    // 窓の外を覗き込む手応え（近い窓枠と遠い景色がずれて動く）。乗り出す(lean)と0になり、枠を越えて街へ顔を出す。
    const roomAmt = Math.max(0, 1 - lean)
    const ex = Math.sin(yaw) * CAM.roomParallaxX * roomAmt
    const ey = eye.y - wo * CAM.winDown - lean * CAM.leanDown + pitch * CAM.roomParallaxY * roomAmt
    const ez = eye.z - wo * CAM.winFwd - lean * CAM.leanFwd
    // 部屋の中でもズーム可（FOVで寄り引き。zoom 0.4=寄り→画角を狭めて窓の外を引き寄せる／3.0=引き）。
    const winFov = Math.max(26, Math.min(100, (CAM.fov0 + wo * CAM.winFov + lean * CAM.leanFov) * (0.55 + 0.45 * active.zoom)))
    const look = new THREE.Vector3(
      ex + Math.sin(yaw) * 18,
      ey - 10.5 - lean * CAM.leanLook + pitch * CAM.lookPitch + Math.sin(t * 0.5) * 0.014, // 既定は見下ろし（手前の木に落ち込み過ぎない程度に）／上スワイプで空・ビル上層も仰げる
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
        // オートシネマ: 無操作が続くと、最寄りの名所をゆっくりオービット（接線方向へ機首を正し低速で周回）。
        // ただ眺めるだけで街がゆっくり巡る＝「眺めて整う」。触れた瞬間に解除して操作へ戻る。
        const idleMs = performance.now() - (active.lastInputT || 0)
        let nearLM2 = 1e9; for (const lm of CINEMA_LM) { const d2 = (lm.x - active.flyPos.x) ** 2 + (lm.z - active.flyPos.z) ** 2; if (d2 < nearLM2) nearLM2 = d2 }
        // オートシネマは「とまって(ホバリング)名所の近くで眺めている時」だけ作動。巡航中(=移動・別エリアへの渡り)では出さない
        // ＝飛行中に勝手に視点が切り替わらない(実機FB: 渡りの最中に定期的に視点が真後ろ等へ回ってしまう不具合の修正)。
        const wantCinema = flyAmt > 0.9 && idleMs > 7000 && !active.cruise && nearLM2 < 175 * 175 ? 1 : 0
        active.cinema += (wantCinema - active.cinema) * Math.min(1, dt * (wantCinema ? 0.5 : 4)) // ゆっくり始まり・素早く解除
        let cineSpeed = 0
        if (active.cinema > 0.01) {
          let best = CINEMA_LM[0], bd = 1e9
          for (const lm of CINEMA_LM) { const d = (lm.x - active.flyPos.x) ** 2 + (lm.z - active.flyPos.z) ** 2; if (d < bd) { bd = d; best = lm } }
          active.cineLM = best
          const rx = active.flyPos.x - best.x, rz = active.flyPos.z - best.z, r = Math.max(28, Math.hypot(rx, rz))
          const tangYaw = Math.atan2(-rz / r, rx / r) // 名所を中心に反時計回りの接線へ機首を向ける
          let d = tangYaw - active.flyYawTarget; d = Math.atan2(Math.sin(d), Math.cos(d))
          active.flyYawTarget += d * Math.min(1, dt * 0.5) * active.cinema
          cineSpeed = FLY.cinemaSpeed * active.cinema
        }
        // 飛行＝スキームA: ドラッグで操った進路(flyYaw/flyPitch)へ機首が向き、自動でゆっくり前進（巡航）。
        // 機首の上下がそのまま上昇/下降。とまる中は前進0＝その場でホバリング。一本指・スティック/昇降ボタン無し。
        active.flyYaw += (active.flyYawTarget - active.flyYaw) * FLY.steerEase
        active.flyPitch += (active.flyPitchTarget - active.flyPitch) * FLY.steerEase
        active.lookYawOff = 0
        cpit = Math.cos(active.flyPitch); spit = Math.sin(active.flyPitch)
        camYaw = active.flyYaw
        const cruiseS = (active.cruise ? FLY.cruiseSpeed * active.speedMul * (active.arrivalSlow || 1) : 0) + cineSpeed // 速さは speedMul で可変＋目的地で自動減速＋シネマの周回
        // 進むのは水平方向だけ＝見下ろし/見上げの角度に関係なく一定速度で前進（見下ろしても降下しない）。
        dvX = Math.sin(active.flyYaw) * cruiseS
        dvY = (active.climb || 0) * FLY.climbSpeed // 高さは↑↓ボタンだけ。カメラの見る角度(flyPitch)は保持され移動には影響しない＝好きな角度で街を見下ろし続けられる
        dvZ = -Math.cos(active.flyYaw) * cruiseS
      }
      const yawV = (active.flyYaw - prevYaw) / Math.max(dt, 0.001) // 旋回角速度（バンクの素）
      const fwdX = Math.sin(camYaw) * cpit, fwdY = spit, fwdZ = -Math.cos(camYaw) * cpit // カメラの向き

      const k = 1 - Math.exp(-FLY.moveEase * dt) // 慣性：目標速度へ寄せる（とまる/離すと0へ）
      active.vel.x += (dvX - active.vel.x) * k
      active.vel.y += (dvY - active.vel.y) * k
      active.vel.z += (dvZ - active.vel.z) * k

      const b = bound
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
        active.flyPos.x = Math.max(-b.x, Math.min(b.xMax || b.x, active.flyPos.x))
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
      const back0 = (isWalk ? FLY.walkBack : FLY.camBack) * active.zoom * (active.wide && !isWalk ? 1.5 : 1) // 広角モードはさらに引く
      const upOff = (isWalk ? FLY.walkUp : FLY.camUp) * (0.5 + 0.5 * active.zoom) * (active.wide && !isWalk ? 1.35 : 1) // 引くほど少し高い位置から見渡す（広角は更に高く）
      const ahead = isWalk ? FLY.walkAhead : FLY.camAhead
      // 後方アンカーが建物にめり込む時だけ寄せる。ただし blockedAt は高さを見ない平面判定なので、上空を巡航中に
      // 後ろの建物列を跨ぐたびに寄せ判定がオンオフして“カメラが前後にドリー”＝酔いの原因になっていた。
      // 屋根より十分高い時は建物に当たらないので寄せ判定を切り、さらに寄せ距離自体をなめらかに追従させて前後酔いを断つ。
      // 飛行は当たりで寄せない＝後ろの建物列を跨ぐたびの前後ドリー(酔い)を根絶。歩行だけ寄せる（一人称で壁にめり込まぬよう）。
      const checkBlock = isWalk
      let backTgt = back0
      if (checkBlock) {
        let back = back0
        for (let tries = 0; tries < 5; tries++) {
          const tx = fp.x - fwdX * back, tz = fp.z - fwdZ * back
          if (!blockedAt(tx, tz)) break
          back *= 0.62
        }
        backTgt = back
      }
      // 寄せ距離をなめらかに追従（瞬間スナップを排す＝寄せ/戻りで前後にカクつかない）
      if (!active.camReady || active.camBackCur === undefined) active.camBackCur = backTgt
      else active.camBackCur += (backTgt - active.camBackCur) * 0.1
      const back = active.camBackCur
      let dcx = fp.x - fwdX * back, dcz = fp.z - fwdZ * back
      let dcy = fp.y - fwdY * back + upOff
      const camFloor = heightAt(dcx, dcz) + (isWalk ? 1.35 : 1.6) // 歩行は一人称寄り＝目線をやや低く許す
      if (dcy < camFloor) dcy = camFloor
      if (!active.camReady) { active.camPos.set(dcx, dcy, dcz); active.camReady = true } // 飛び立ち/着地直後はスナップ
      else { active.camPos.x += (dcx - active.camPos.x) * FLY.camLag; active.camPos.y += (dcy - active.camPos.y) * FLY.camLag; active.camPos.z += (dcz - active.camPos.z) * FLY.camLag }

      let aLookX = fp.x + fwdX * ahead, aLookY = fp.y + fwdY * ahead + Math.sin(t * 0.5) * 0.04, aLookZ = fp.z + fwdZ * ahead
      // オートシネマ: 接線に沿って機体は流れつつ、視線は名所の中心へ向ける＝名所を画面に保つオービット
      if (!isWalk && active.cinema > 0.01 && active.cineLM) {
        const cm = active.cinema * 0.92, lx = active.cineLM.x, lz = active.cineLM.z, ly = heightAt(lx, lz) + 15
        aLookX += (lx - aLookX) * cm; aLookY += (ly - aLookY) * cm; aLookZ += (lz - aLookZ) * cm
      }
      TMP_DIR.set(fwdX, fwdY, fwdZ); TMP_UP2.set(0, 1, 0).applyAxisAngle(TMP_DIR, active.bankCur) // バンクした上ベクトル

      camX = lerp(ex, active.camPos.x, flyAmt); camY = lerp(ey, active.camPos.y, flyAmt); camZ = lerp(ez, active.camPos.z, flyAmt)
      lookX = lerp(look.x, aLookX, flyAmt); lookY = lerp(look.y, aLookY, flyAmt); lookZ = lerp(look.z, aLookZ, flyAmt)
      upX = lerp(0, TMP_UP2.x, flyAmt); upY = lerp(1, TMP_UP2.y, flyAmt); upZ = lerp(0, TMP_UP2.z, flyAmt)
      const speedMag = Math.hypot(active.vel.x, active.vel.y, active.vel.z)
      const aloftFov = (isWalk ? FLY.walkFov : FLY.fov) + (isWalk ? 0 : Math.min(1, speedMag / FLY.speed) * FLY.fovSpeedGain) + (active.wide && !isWalk ? 26 : 0) // 広角モードで視界を広げる
      fov = lerp(winFov, aloftFov, flyAmt)
      if (!isWalk && active.cinema > 0.01) fov += Math.sin(t * 0.16) * 2.6 * active.cinema // オートシネマの呼吸する画角（ゆっくり広→狭）
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
      // 雲の芯のごく近く(9u以内)だけ軽く霞む。以前は半径15・濃さ0.82で“少し高く飛ぶと白飛び”していた→
      // 街全体を見渡せる開放感を優先し、雲に分け入った時だけ淡く霞ませる（軽い白飛びの雰囲気は残す）。
      const haze = isWalk ? 0 : Math.max(0, 1 - Math.sqrt(nearC) / 5.0) * flyAmt // 雲の芯のごく至近だけ・さらに控えめに（飛行中の白さの圧迫を緩める）
      if (Math.abs(haze - cloudHazeCur) > 0.02) { cloudHazeCur = haze; cloudHaze.style.opacity = (haze * 0.14).toFixed(2) }
      // 高度で空気が冷たく淡くなる（高く昇るほど淡い寒色を被せる）＋環境音をしぼる
      const altT = isWalk ? 0 : Math.max(0, Math.min(1, (active.flyPos.y - 34) / 46)) * flyAmt
      if (Math.abs(altT - altTintCur) > 0.02) { altTintCur = altT; altTint.style.opacity = (altT * 0.16).toFixed(2) }
      // 街の環境音(虫)をしぼる量 = 高度 ＋ 海の上 ＋ homeから離れた、の合成。海に出ると虫が消え、風と鳥だけになる（実機FB）。
      const overSeaT = isWalk ? 0 : (heightAt(active.flyPos.x, active.flyPos.z) < SEA.level + 0.5 ? 1 : 0) * flyAmt // 水面の上か
      const dHomeT = isWalk ? 0 : Math.min(1, Math.max(0, (Math.hypot(active.flyPos.x, active.flyPos.z) - 80) / 90)) * flyAmt // homeから離れたか
      altDuck01 = Math.max(altT, overSeaT, dHomeT)
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
    if (skyDome) skyDome.position.set(camX, camY, camZ) // 空ドームをカメラへ追従＝拡大世界のどこへ飛んでも空が常に周囲を覆う（黒い虚空を防ぐ）
    if (Math.abs(fov - active.fovCur) > 0.04) { active.fovCur = fov; camera.fov = fov; camera.updateProjectionMatrix() }
    camera.lookAt(lookX, lookY, lookZ)
    // とまる/すすむ ボタンは飛行のときだけ出す（歩行・窓辺では隠す）。出すときに現在の状態でラベルを合わせる。
    const showCruise = active.mode === 'fly' && active.flyP > 0.4
    if (showCruise !== cruiseShown) { cruiseShown = showCruise; cruiseBtn.classList.toggle('cruise--on', showCruise); if (showCruise) cruiseBtn.textContent = active.cruise ? 'とまる' : 'すすむ' }
    const showZoom = active.mode === 'window' || active.flyP > 0.4 // 部屋の中（窓辺）でも空/地上でもズームボタンを出す
    if (showZoom !== zoomShown) { zoomShown = showZoom; zoomWrap.classList.toggle('zoom--on', showZoom); if (!showZoom) stopZoomHold() }
    const showSpeed = active.mode === 'fly' && active.flyP > 0.4 // 速度ボタンは飛行のときだけ
    if (showSpeed !== speedShown) { speedShown = showSpeed; speedWrap.classList.toggle('speed--on', showSpeed); if (!showSpeed) stopSpeedHold() }
    if (showSpeed !== wideShown) { wideShown = showSpeed; wideWrap.classList.toggle('wide--on', showSpeed) }
    if (showSpeed !== climbShown) { climbShown = showSpeed; climbWrap.classList.toggle('climb--on', showSpeed); if (!showSpeed && active) active.climb = 0 }
    onSpeed(windSpeed01) // 風音を飛行速度で膨らませる（main→audio.setFlyWind）
    onAltitude(altDuck01) // 高空で街の環境音をしぼる（main→audio.setAltitudeDuck）
    // 操作ゲージの塗りを今の値で更新（＋寄る/速く/上昇で上がる向き）。高さは見渡せる実用域(汀〜90)で正規化。
    zoomGauge.set((3.0 - active.zoomTarget) / 2.6)
    speedGauge.set((active.speedMul - 0.35) / 1.35)
    altGauge.set((active.flyPos.y - bound.yFloor) / (90 - bound.yFloor))
    if (active.climb !== 0) altGauge.show() // 昇降ボタンを押している間はゲージを出し続ける
    // BGMの下地へ「場面」を伝える（部屋/窓/飛行/歩行・速度・高度・地形・各時代の近さ）。setMusicBed側で滑らかに移す。
    {
      const fp = active.flyPos
      const eP = flyAmt * Math.max(0, 1 - Math.hypot(fp.x - EDO.x, fp.z - EDO.z) / 255) // 江戸の近さ＝和の響きが満ちる
      const sP = flyAmt * Math.max(0, 1 - Math.hypot(fp.x - SENGOKU.x, fp.z - SENGOKU.z) / 255) // 戦国の近さ＝低く翳る
      const tP = flyAmt * Math.max(0, 1 - Math.hypot(fp.x - TAISHO.x, fp.z - TAISHO.z) / 255) // 大正の近さ＝港の郷愁
      let terrain = 'land'
      if (flyAmt > 0.3) { const gh = heightAt(fp.x, fp.z); if (gh < SEA.level - 2) terrain = 'sea'; else if (gh > 20) terrain = 'mountain' } // 海上＝開放/山上＝荘厳
      onScene({ mode: active.mode, flyAmt, speed: windSpeed01, terrain, edoP: eP, senP: sP, taiP: tP, night: isNight })
    }

    // ── 3Dの室内窓枠の見え隠れ。部屋の中（窓辺）で見え、乗り出すと素早く退いて街へ。空/地上では消す。
    // 世界固定の3D枠なので、カメラの室内視差(roomParallax)＋回転で「近い枠と遠い景色が視差で分離」して、
    // 部屋の中から窓越しに外を覗く手応えになる。CSSの中央桟・窓台は3D枠と二重になるので隠す。
    const roomAmtF = Math.max(0, 1 - lean)
    // 室内は不透明（街を遮蔽してfill節約・カクつき対策）。乗り出すとカメラが窓の開口を抜けて前へ出る＝室内は背後へ退く。
    // lean>0.16で非表示＝カメラがベランダの手すり/窓枠へ達する前に室内ごと消す（貫通して見えるのを防ぐ）。空/地上でも非表示。
    winRoom.visible = flyAmt < 0.6 && lean < 0.16
    if (winRoom.visible && winSashR) winSashR.position.x = winSashX0 + wo * (winSashX1 - winSashX0) // 窓をあけると右の障子が左へすべって開く
    if (winRoom.visible && winRefl) winRefl.mat.opacity = winRefl.base * (1 - wo) // 窓をあけると硝子の映り込みは消える（外気が澄む）
    if (winRoom.visible) for (const ct of winCurtains) { ct.position.x = ct.userData.x0 + Math.sin(t * 1.15 + ct.userData.cs) * 0.035 * wo; ct.position.z = 0.42 + (0.5 + 0.5 * Math.sin(t * 0.85 + ct.userData.cs * 1.7)) * 0.07 * wo } // 窓をあけると外気でカーテンがそっとそよぐ（閉=静止）
    if (winRoom.visible && windChime) windChime.rotation.z = Math.sin(t * 1.7) * (0.02 + 0.05 * wo) // 風鈴は窓をあけるとよく揺れる（閉=ごく僅か）
    if (winRoom.visible) for (const sp of teaSteam) { const p = (t * 0.16 + sp.userData.ph) % 1; sp.position.y = sp.userData.y0 + p * 0.5; sp.position.x = sp.userData.x0 + Math.sin(t * 0.7 + sp.userData.ph * 6.3) * 0.05 * p; sp.material.opacity = 0.16 * Math.sin(p * Math.PI); sp.scale.setScalar(0.1 + p * 0.16) } // 急須から湯気がゆらりと立ちのぼる
    if (winRoom.visible && winPendulum) winPendulum.rotation.x = Math.sin(t * 2.0) * 0.16 // 柱時計の振り子が静かに時を刻む
    if (winRoom.visible && winDust) { for (let i = 0; i < winDust.base.length; i++) { const b = winDust.base[i]; winDust.arr[i * 3] = b.x0 + Math.sin(t * b.sp + b.ph) * b.amp * 3; winDust.arr[i * 3 + 1] = b.y0 + Math.sin(t * b.sp * 0.7 + b.ph * 1.7) * b.amp * 4; winDust.arr[i * 3 + 2] = b.z0 + Math.cos(t * b.sp * 0.5 + b.ph) * b.amp * 3 } winDust.geo.attributes.position.needsUpdate = true } // 窓の光にほこりがゆらゆら舞う
    if (winRoom.visible && winCat) { const c = winCat // 猫: 眠る・たまに目を覚ます・撫でられると喜ぶ＝生きている気配
      // 覚醒度 alert（0=眠り/1=ぱっちり）。撫でている間=1、たまに自発的に目を覚ます。
      c.wakeT -= dt
      if (c.wakeT < 0 && c.wakeHold <= 0 && c.petActive < 1) { c.wakeT = 32 + R() * 52; c.wakeHold = 2.5 + R() * 3.5 } // たまにふと目を覚ます
      if (c.wakeHold > 0) c.wakeHold -= dt
      // たまに起き上がって伸びをし、日だまりの別の場所へ移って丸くなる（猫の現実的な“移動”）
      c.relocT -= dt
      if (c.relocT < 0 && c.relocP >= 1 && c.petActive < 1 && c.alert < 0.3) { c.relocT = 46 + R() * 60; c.relocP = 0
        c.x0 = c.g.position.x; c.z0 = c.g.position.z; c.rot0 = c.g.rotation.y; c.g.rotation.z = 0
        const ang = Math.random() * 6.28, d = 0.55 + Math.random() * 0.75
        c.x1 = Math.max(-0.35, Math.min(1.35, c.x0 + Math.cos(ang) * d)); c.z1 = Math.max(1.05, Math.min(2.35, c.z0 + Math.sin(ang) * d))
        c.rot1 = Math.atan2(c.x1 - c.x0, c.z1 - c.z0) }
      const reloc = c.relocP < 1
      c.alertTarget = (c.petActive >= 1 || c.wakeHold > 0 || reloc) ? 1 : 0
      c.alert += (c.alertTarget - c.alert) * Math.min(1, dt * 3.2)
      if (c.petActive >= 1) c.petAmt = Math.min(1, c.petAmt + dt * 0.5); else c.petAmt = Math.max(0, c.petAmt - dt * 0.5)
      // ゴロゴロ（撫でられているほど強い）。間引いて音側へ。
      const purrTarget = c.petActive >= 1 ? (0.45 + c.petAmt * 0.55) : 0
      c.purr += (purrTarget - c.purr) * Math.min(1, dt * 2.4)
      if (Math.abs(c.purr - (c.purrSent || 0)) > 0.04) { c.purrSent = c.purr; onPurr(c.purr) }
      // 目: alert>0.42 で開く（こちらを見る）／ふだんは閉じてうとうと
      const open = c.alert > 0.42; for (const e of c.eyesOpen) e.visible = open; for (const e of c.eyesClosed) e.visible = !open
      // 呼吸（撫でられると深く・ゴロゴロで微振動）
      c.body.scale.y = c.y0 * (1 + Math.sin(t * 1.5) * 0.05 + Math.sin(t * 26) * 0.006 * c.purr)
      // 頭: alertで持ち上げてこちらへ＋撫でられると気持ちよさげに首をかしげる
      c.headG.rotation.x = c.headX0 + c.alert * 0.34
      c.headG.position.y = c.headY0 + c.alert * 0.05
      c.headG.rotation.z = Math.sin(t * 1.1) * 0.05 * c.petAmt
      // 尻尾: 起きると立ち気味、撫でるとよく動く＋たまにピクッ
      c.tailT -= dt; if (c.tailT < 0) { c.tailT = (c.alert > 0.5 ? 2 : 5) + R() * 6; c.flickT = 0.7 }
      let flick = 0; if (c.flickT > 0) { c.flickT -= dt; flick = Math.sin((0.7 - c.flickT) * 16) * 0.4 * Math.max(0, c.flickT / 0.7) }
      c.tail.rotation.y = Math.sin(t * (0.55 + c.purr * 0.8)) * (0.07 + c.petAmt * 0.14) + flick
      c.tail.rotation.z = 0.4 - c.alert * 0.28
      // 耳: たまにピクッ（撫でると小刻み）
      c.earT -= dt; if (c.earT < 0) { c.earT = (c.petAmt > 0.3 ? 3 : 7) + R() * 9; c.earK = 0.45 }
      if (c.earK > 0) { c.earK -= dt; const e = Math.sin((0.45 - c.earK) * 26) * 0.22 * Math.max(0, c.earK / 0.45); c.ears[0].rotation.x = c.ears0[0] + e; c.ears[1].rotation.x = c.ears0[1] - e }
      // 寝返り（眠っている・移動していない時だけ）
      c.settleT -= dt; if (c.settleT < 0 && c.settleP >= 1 && c.alert < 0.2 && !reloc) { c.settleT = 30 + R() * 44; c.settleP = 0 }
      if (c.settleP < 1 && !reloc) { c.settleP = Math.min(1, c.settleP + dt / 3.6); c.g.rotation.z = Math.sin(c.settleP * Math.PI) * 0.12 }
      // 移動: 立ち上がり→ぐーっと伸び→とことこ歩く→新しい場所で伏せる。接地影も連れて動く。
      if (reloc) {
        c.relocP = Math.min(1, c.relocP + dt / 5.4)
        const p = c.relocP
        const mv = p < 0.24 ? 0 : p > 0.82 ? 1 : (p - 0.24) / 0.58, ease = mv * mv * (3 - 2 * mv)
        c.g.position.x = c.x0 + (c.x1 - c.x0) * ease
        c.g.position.z = c.z0 + (c.z1 - c.z0) * ease
        c.g.rotation.y = c.rot0 + (c.rot1 - c.rot0) * Math.min(1, p * 2.2)
        const stand = Math.sin(Math.min(1, p / 0.85) * Math.PI)                  // 立ち上がって着地で伏せる
        const step = (mv > 0 && mv < 1) ? Math.abs(Math.sin(p * 26)) * 0.018 : 0  // とことこ
        c.g.position.y = c.baseY + stand * 0.05 + step
        const st = Math.sin(Math.max(0, Math.min(1, (p - 0.04) / 0.18)) * Math.PI) // 最初のぐーっと伸び
        c.body.scale.x = 1.5 * (1 + st * 0.4 + (mv > 0 && mv < 1 ? 0.14 : 0))
        c.body.scale.z = 1.22 * (1 - st * 0.12)
        if (c.catShadow) { c.catShadow.position.x = c.g.position.x; c.catShadow.position.z = c.g.position.z }
      } else { c.body.scale.x = 1.5; c.body.scale.z = 1.22; if (Math.abs(c.g.position.y - c.baseY) > 0.0005) c.g.position.y = c.baseY } }
    // CSSの窓枠（外枠frame2・ガラスglass・中央桟cross・窓台sill）は、3Dの室内窓枠と二重像になる（窓に窓が
    // 重なるバグ）。3D枠が完全な窓を担うのでCSS窓枠は全て隠す。室内の薄暗がりroomVigと水彩オーバーレイは残す。
    glass.style.opacity = '0'
    cross.style.opacity = '0'
    frame2.style.opacity = '0'
    // 部屋の中ほど周辺を暗く（薄暗い室内から明るい窓を覗く明暗）。静的グラデの不透明度だけ動かす＝軽い。
    const roomDark = roomAmtF * (1 - wo * 0.4)
    if (Math.abs(roomDark - roomDarkCur) > 0.02) { roomDarkCur = roomDark; roomVig.style.opacity = roomDark.toFixed(2) }
    sill.style.opacity = '0'
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
    // 上空にいる間は描画解像度をひと段下げる：全世界＋海/霧のシェーダーが画面全面を覆い最も重い場面で、
    // 動きが速く粗さは目立たない。窓辺へ戻れば最高解像度に戻す＝じっくり眺める所の画質は一切落とさない。
    // 切替は flyP が 0.55 を跨ぐ離陸/着地の一瞬だけ＝毎フレームの再確保を避ける。
    const wantFly = active.mode !== 'window' && (active.flyP || 0) > 0.55
    if (wantFly !== prFly) {
      prFly = wantFly
      curPR = Math.min(window.devicePixelRatio || 1, wantFly ? qCap * 0.8 : qCap)
      renderer.setPixelRatio(curPR); renderer.setSize(stage.clientWidth, stage.clientHeight)
    }
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
    window.__town3dZoom = (v) => { if (active) { active.zoomTarget = Math.max(0.4, Math.min(3.0, v || 1)); active.zoom = active.zoomTarget } } // 検証用: ズーム(0.4寄り〜3.0引き)
    window.__town3dClouds = () => clouds.map((c) => [+c.position.x.toFixed(1), +c.position.y.toFixed(1), +c.position.z.toFixed(1)]) // 検証用: 雲の位置一覧
    window.__town3dDbg = () => active && ({ // 検証用: 自機の状態（モード・速度・バンク等）
      mode: active.mode, fly: +active.flyP.toFixed(2), x: +active.flyPos.x.toFixed(1), y: +active.flyPos.y.toFixed(1), z: +active.flyPos.z.toFixed(1),
      yaw: +active.flyYaw.toFixed(2), pitch: +active.flyPitch.toFixed(2),
      vel: +Math.hypot(active.vel.x, active.vel.y, active.vel.z).toFixed(2), mvX: +active.moveX.toFixed(2), mvY: +active.moveY.toFixed(2), bank: +active.bankCur.toFixed(2),
    })
    window.__town3dStats = () => { const r = renderer.info.render; let objs = 0; scene.traverse(() => objs++); return { calls: r.calls, tris: r.triangles, objs, pr: +curPR.toFixed(2) } } // 検証用: 描画コール/三角形/オブジェクト数
    window.__town3dResInfo = () => residents.map((r) => ({ x: +r.position.x.toFixed(1), y: +r.position.y.toFixed(1), z: +r.position.z.toFixed(1), face: +r.rotation.y.toFixed(2) })) // 検証用: 住人の位置・向き
    window.__town3dResFace = (i, ya) => { if (residents[i]) { const u = residents[i].userData; residents[i].rotation.y = ya; u.face = ya; u.moving = false; u.pauseT = 999; for (const a of u.arms) a.rotation.x = 0; for (const l of u.legs) l.rotation.x = 0 } } // 検証用: 住人を止めて向きを固定（顔の確認）
    window.__town3dCatReloc = () => { if (winCat) { winCat.relocT = -1; winCat.alert = 0; winCat.wakeHold = 0; winCat.petActive = 0 } } // 検証用: 猫の移動を今すぐ起こす
    window.__town3dCatState = () => winCat ? { x: +winCat.g.position.x.toFixed(2), z: +winCat.g.position.z.toFixed(2), relocP: +winCat.relocP.toFixed(2), alert: +winCat.alert.toFixed(2) } : null
    window.__town3dResTo = (i, x, z) => { if (residents[i]) { const u = residents[i].userData; residents[i].position.set(x, heightAt(x, z), z); u.ax = x; u.az = z; u.tx = x; u.tz = z; u.moving = false; u.pauseT = 999 } } // 検証用: 住人を開けた場所へ移動
    window.__town3dResFront = (i, dist = 9, lift = 0.9) => { const r = residents[i]; if (!r) return; const d = new THREE.Vector3(); camera.getWorldDirection(d); const t = camera.position.clone().addScaledVector(d, dist); r.position.set(t.x, t.y - lift, t.z); const u = r.userData; u.ax = t.x; u.az = t.z; u.tx = t.x; u.tz = t.z; u.moving = false; u.pauseT = 999 } // 検証用: 3D住人をカメラ正面の視線上に立たせる（窓の遮蔽回避）
    window.__town3dSpriteTo = (i, x, z) => { if (animeSprites[i]) animeSprites[i].position.set(x, heightAt(x, z), z) } // 検証用: 2Dスプライトを開けた場所へ
    window.__town3dSpriteFace = (i, rel) => { const sp = animeSprites[i]; if (!sp) return; const toCam = Math.atan2(camera.position.x - sp.position.x, camera.position.z - sp.position.z); sp.userData.facing = toCam - rel } // 検証用: カメラ基準でrel=0正面/±π/2横/π後ろ
    window.__town3dSpriteFront = (i, dist = 12, eyeLevel = false) => { const sp = animeSprites[i]; if (!sp) return; const d = new THREE.Vector3(); camera.getWorldDirection(d); if (eyeLevel) { const t = camera.position.clone().addScaledVector(d, dist); sp.position.set(t.x, t.y - 0.95, t.z); return } d.y = 0; d.normalize(); const x = camera.position.x + d.x * dist, z = camera.position.z + d.z * dist; sp.position.set(x, heightAt(x, z), z) } // 検証用: カメラ正面distだけ前に立たせる（eyeLevel=視線上に置いて窓中央に収める）
    window.__town3dSpriteTex = (i, d) => { const sp = animeSprites[i]; if (!sp) return null; const v = sp.userData.views; return v && v[d] && v[d].image ? v[d].image.toDataURL() : null } // 検証用: 焼いた8方向の絵そのものをPNGで取り出す
    window.__town3dSpriteDirs = (i) => { const sp = animeSprites[i]; return sp ? sp.userData.views.length : 0 }
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
  let pettingId = null                               // 窓辺の猫を撫でているポインタ（猫に触れて始まる）
  const petRay = new THREE.Raycaster(), petNDC = new THREE.Vector2()
  const hitCat = (clientX, clientY) => { // 画面の座標が窓辺の猫に当たっているか（撫でる判定）
    if (!winCat || !winRoom.visible || !active || active.mode !== 'window') return false
    const r = stage.getBoundingClientRect()
    petNDC.x = ((clientX - r.left) / r.width) * 2 - 1; petNDC.y = -((clientY - r.top) / r.height) * 2 + 1
    petRay.setFromCamera(petNDC, camera)
    return petRay.intersectObject(winCat.hit).length > 0
  }
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
    active.lastInputT = performance.now(); active.cinema = 0 // 触れたらオートシネマは即解除
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2) { // 2本指＝ピンチでズーム開始。単指の操舵/移動は解除する。
      const p = [...pointers.values()]
      pinchD0 = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1
      pinchZoom0 = active.zoomTarget
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
    } else if (pettingId === null && hitCat(e.clientX, e.clientY)) {
      pettingId = e.pointerId; winCat.petActive = 1 // 窓辺の猫に触れた＝撫でる（見回しでなく猫を構う）
    } else if (lookId === null) {
      lookId = e.pointerId; lookLX = e.clientX; lookLY = e.clientY // 歩行の右半分/窓辺＝見回し
      active.lookDragging = true
    }
  }
  const onMove = (e) => {
    if (!active) return
    if (pointers.has(e.pointerId)) { active.lastInputT = performance.now(); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }) }
    if (pointers.size >= 2) { // ピンチ＝ズーム（指を開く=寄り／閉じる=引き）。止まっても飛んでも自在に引ける。
      const p = [...pointers.values()]
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1
      active.zoomTarget = Math.max(0.4, Math.min(3.0, pinchZoom0 * (pinchD0 / d)))
      return
    }
    const w = stage.clientWidth || 1, h = stage.clientHeight || 1
    if (e.pointerId === steerId) {
      applyTown3dSteer((e.clientX - steerLX) / w, (e.clientY - steerLY) / h) // 飛行のドラッグ操舵
      steerLX = e.clientX; steerLY = e.clientY
    } else if (e.pointerId === stickId) setStick(e.clientX - stickOX, e.clientY - stickOY)
    else if (e.pointerId === pettingId && winCat) { winCat.petActive = 1; winCat.petAmt = Math.min(1, winCat.petAmt + 0.03) } // なでる手の動きでより喜ぶ
    else if (e.pointerId === lookId) {
      // 横は素直に（右ドラッグ＝右を向く＝マリオ等のゲームと同じ向き）。縦はそのまま（下ドラッグ＝見上げる＝景色を引き寄せる手触り・ユーザー好み）。
      applyTown3dLook((e.clientX - lookLX) / w * 1.0, (e.clientY - lookLY) / h * 1.0)
      lookLX = e.clientX; lookLY = e.clientY
    }
  }
  const onUp = (e) => {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinchD0 = 0 // ピンチ終了
    if (e.pointerId === steerId) steerId = null
    if (e.pointerId === stickId) { stickId = null; hideStick() }
    if (e.pointerId === pettingId) { pettingId = null; if (winCat) winCat.petActive = 0 } // 手を離す＝撫で終わり（余韻はゆっくり冷める）
    if (e.pointerId === lookId) { lookId = null; if (active) active.lookDragging = false }
  }
  // どんな操作（ボタンのタップ含む）でもオートシネマの無操作タイマーを更新（ボタンはstopPropagationするのでcaptureで拾う）
  const markInput = () => { if (active) { active.lastInputT = performance.now(); if (active.cinema > 0) active.cinema = 0 } }
  active.lastInputT = performance.now()
  dom.addEventListener('pointerdown', onDown)
  window.addEventListener('pointerdown', markInput, true)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  // dispose に後始末を足す
  const baseDispose = active.dispose
  active.dispose = () => {
    dom.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointerdown', markInput, true)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    window.removeEventListener('resize', resize)
    baseDispose()
  }
}
