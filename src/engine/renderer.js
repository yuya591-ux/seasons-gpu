// WebGL レンダラ。フルスクリーン三角形に、情景ごとのシェーダーを当てて描く。
// 情景のパレットを時間でゆっくり移ろわせ、設定（強さ・明るさ・品質）を反映する。
// 情景の render 種別が変わったらシェーダー（プログラム）を組み直す。

import { getShader } from '../shaders/index.js'
import { hexToRgb, mixRgb } from '../util/color.js'

const BASE = import.meta.env.BASE_URL || '/'

const DPR_BY_QUALITY = { soft: 2, standard: 1.5, light: 1 }

function compile(gl, type, src) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('シェーダーのコンパイルに失敗:', gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

export function createRenderer(canvas) {
  const gl =
    canvas.getContext('webgl', { antialias: false, alpha: false }) ||
    canvas.getContext('experimental-webgl')
  if (!gl) return null

  let buffer = null
  function setupBuffer() {
    buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  }
  setupBuffer()

  // パノラマ写真＋深度マップ（任意）。情景が pano を持つときだけ読み込む。
  let panoTex = null
  let panoReady = 0
  let panoDepthTex = null
  let panoDepthReady = 0
  let panoKey = null
  function loadTexture(url, onReady) {
    const img = new Image()
    let tex = null
    img.onload = () => {
      tex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false) // baseV=0 を画像上端に合わせる
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img)
      // NPOT のため CLAMP・mipmapなし（横ループはシェーダー側で fract 処理）
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      onReady(tex)
    }
    img.onerror = () => onReady(null)
    img.src = url
  }
  function loadPano(s) {
    const key = s && s.pano ? s.pano : null
    if (key === panoKey) return
    panoKey = key
    // 旧テクスチャを解放（GPUメモリの累積を防ぐ）
    if (panoTex) gl.deleteTexture(panoTex)
    if (panoDepthTex) gl.deleteTexture(panoDepthTex)
    panoTex = null
    panoDepthTex = null
    panoReady = 0
    panoDepthReady = 0
    if (!key) return
    loadTexture(BASE + s.pano, (tex) => {
      panoTex = tex
      panoReady = tex ? 1 : 0
    })
    if (s.panoDepth) {
      loadTexture(BASE + s.panoDepth, (tex) => {
        panoDepthTex = tex
        panoDepthReady = tex ? 1 : 0
      })
    }
  }

  let program = null
  let loc = {}
  let quality = 'standard'
  let shaderType = 'rainGlass'
  let glassMode = 0 // 窓辺シリーズのガラス現象 0=なし 1=雨 2=雪
  let foliageMode = 0 // 季節の舞い 0=なし 1=紅葉 2=花びら
  let seasonMode = 1 // 季節 0=春 1=夏 2=秋 3=冬（窓の状態＝網戸/結露の出し分け）
  let scene = null
  let settings = { rain: 0.65, brightness: 1.0, quality: 'standard' }
  let rafId = 0
  const startTime = performance.now()
  // 描画解像度の自動調整（重い端末ではフレーム時間を見て解像度を落とし、滑らかさを保つ）
  let renderScale = 1.0
  let frameEMA = 16.7
  let lastFrame = 0
  let adaptCooldown = 60
  // 窓を開ける（0=閉じてガラス越し, 1=開いて素通し）。トグルでなめらかに開閉。
  let windowOpen = 0
  let windowOpenTarget = 0

  // 見回し（uPan）。指の操作で目標値を動かし、毎フレームなめらかに追従させる。
  const panCur = { x: 0, y: 0 }
  const panTarget = { x: 0, y: 0 }
  const PAN_LIMIT = { x: 2.6, y: 0.46 } // 見上げ/見下ろしの可動域（上空・道路を見渡せるよう拡大）
  // 端末を傾けた時の視差バイアス（窓の効果。パノラマでのみ使用）
  const parallaxBias = { x: 0, y: 0 }
  // 遠雷フラッシュ。雷鳴に合わせて立ち上げ、毎フレーム減衰させる
  let flashLevel = 0
  // モーション過敏への配慮: 真のときは“息づかい”の揺れを止める（OS設定/設定で切替）
  let reduceMotion = false

  function buildProgram(q, type) {
    const shader = getShader(type)
    const vs = compile(gl, gl.VERTEX_SHADER, shader.vertexSource)
    const fs = compile(gl, gl.FRAGMENT_SHADER, shader.buildFragment(q))
    if (!vs || !fs) return false
    const p = gl.createProgram()
    gl.attachShader(p, vs)
    gl.attachShader(p, fs)
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('プログラムのリンクに失敗:', gl.getProgramInfoLog(p))
      return false
    }
    if (program) gl.deleteProgram(program)
    program = p
    gl.useProgram(program)
    const aPosition = gl.getAttribLocation(program, 'aPosition')
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(aPosition)
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)
    loc = {
      uResolution: gl.getUniformLocation(program, 'uResolution'),
      uTime: gl.getUniformLocation(program, 'uTime'),
      uPan: gl.getUniformLocation(program, 'uPan'),
      uParallax: gl.getUniformLocation(program, 'uParallax'),
      uReduceMotion: gl.getUniformLocation(program, 'uReduceMotion'),
      uWindowOpen: gl.getUniformLocation(program, 'uWindowOpen'),
      uSeason: gl.getUniformLocation(program, 'uSeason'),
      uGlass: gl.getUniformLocation(program, 'uGlass'),
      uFoliage: gl.getUniformLocation(program, 'uFoliage'),
      uFlash: gl.getUniformLocation(program, 'uFlash'),
      uPano: gl.getUniformLocation(program, 'uPano'),
      uHasPano: gl.getUniformLocation(program, 'uHasPano'),
      uDepth: gl.getUniformLocation(program, 'uDepth'),
      uHasDepth: gl.getUniformLocation(program, 'uHasDepth'),
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
      uBright: gl.getUniformLocation(program, 'uBright'),
      uSkyTop: gl.getUniformLocation(program, 'uSkyTop'),
      uSkyMid: gl.getUniformLocation(program, 'uSkyMid'),
      uHorizon: gl.getUniformLocation(program, 'uHorizon'),
      uSunGlow: gl.getUniformLocation(program, 'uSunGlow'),
      uDropTint: gl.getUniformLocation(program, 'uDropTint'),
    }
    quality = q
    shaderType = type
    return true
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_BY_QUALITY[quality] || 1.5) * renderScale
    const w = Math.floor(canvas.clientWidth * dpr)
    const h = Math.floor(canvas.clientHeight * dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  // 時間帯の移ろい（early↔late）を、眺めているうちに感じられる速さで行き来する。
  function driftFactor(seconds) {
    // 情景の driftPeriod を半分に詰め、振幅をフルスイングに（色の変化を体感できるように）
    const period = ((scene && scene.driftPeriod) || 300) * 0.5
    const w = (2 * Math.PI) / period
    // 2つの周期を混ぜて単調なループを避けつつ、early↔late をしっかり往復する
    const v = 0.5 + 0.42 * Math.sin(w * seconds) + 0.08 * Math.sin(w * 2.3 * seconds + 1.0)
    return Math.min(1, Math.max(0, v))
  }

  function currentColors(seconds) {
    const pal = scene.palette
    const k = driftFactor(seconds)
    const lerp = (key) => mixRgb(hexToRgb(pal.early[key]), hexToRgb(pal.late[key]), k)
    return {
      skyTop: lerp('skyTop'),
      skyMid: lerp('skyMid'),
      horizon: lerp('horizon'),
      sunGlow: lerp('sunGlow'),
      dropTint: lerp('dropTint'),
    }
  }

  function render(now) {
    // フレーム時間を測り、重い端末では描画解像度を自動調整（滑らかさ優先・回復したら戻す）
    if (lastFrame > 0) {
      const dt = now - lastFrame
      if (dt > 0 && dt < 200) frameEMA = frameEMA * 0.9 + dt * 0.1
    }
    lastFrame = now
    if (adaptCooldown > 0) {
      adaptCooldown--
    } else if (frameEMA > 22 && renderScale > 0.6) {
      renderScale = Math.max(0.6, renderScale - 0.1) // 45fps未満が続けば解像度を落とす
      adaptCooldown = 90
    } else if (frameEMA < 14 && renderScale < 1.0) {
      renderScale = Math.min(1.0, renderScale + 0.1) // 70fps超で余裕があれば戻す
      adaptCooldown = 150
    }
    resize()
    const seconds = (now - startTime) / 1000
    // 見回しをなめらかに追従。残差を「動きの視差」として使う（首を振ると手前が動く）
    const gapX = panTarget.x - panCur.x
    const gapY = panTarget.y - panCur.y
    panCur.x += gapX * 0.12
    panCur.y += gapY * 0.12
    const clampP = (v) => Math.max(-0.11, Math.min(0.11, v)) // 覗き込み視差の天井（身を乗り出す手応え）
    gl.uniform2f(loc.uResolution, canvas.width, canvas.height)
    gl.uniform1f(loc.uTime, seconds)
    // ごく弱い“息づかい”の揺れ。静止画ではなく、その場に居る気配を出す（窓辺シリーズで効く）。
    // モーション過敏配慮時は止める。
    const sm = reduceMotion ? 0 : 1
    const swayX = (Math.sin(seconds * 0.09) * 0.012 + Math.sin(seconds * 0.043 + 1.3) * 0.006) * sm
    const swayY = Math.sin(seconds * 0.06 + 0.7) * 0.006 * sm
    gl.uniform2f(loc.uPan, panCur.x + swayX, panCur.y + swayY)
    if (loc.uParallax) {
      gl.uniform2f(
        loc.uParallax,
        clampP(gapX * 0.06 + parallaxBias.x),
        clampP(gapY * 0.04 + parallaxBias.y),
      )
    }
    if (loc.uReduceMotion) gl.uniform1f(loc.uReduceMotion, reduceMotion ? 1 : 0)
    windowOpen += (windowOpenTarget - windowOpen) * 0.08 // なめらかに開閉
    if (loc.uWindowOpen) gl.uniform1f(loc.uWindowOpen, windowOpen)
    if (loc.uSeason) gl.uniform1f(loc.uSeason, seasonMode)
    gl.uniform1f(loc.uGlass, glassMode)
    if (loc.uFoliage) gl.uniform1f(loc.uFoliage, foliageMode)
    if (loc.uFlash) gl.uniform1f(loc.uFlash, flashLevel)
    // フラッシュは素早く立ち、ゆっくり減衰（遠雷のほのかな閃光）
    if (flashLevel > 0.001) flashLevel *= 0.92
    else flashLevel = 0
    gl.uniform1f(loc.uIntensity, settings.rain)
    // パノラマ写真（あれば）をテクスチャユニット0、深度マップを1に
    if (loc.uPano) {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, panoTex)
      gl.uniform1i(loc.uPano, 0)
      gl.uniform1f(loc.uHasPano, panoReady)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, panoDepthTex)
      gl.uniform1i(loc.uDepth, 1)
      gl.uniform1f(loc.uHasDepth, panoDepthReady)
    }
    gl.uniform1f(loc.uBright, settings.brightness)
    if (scene) {
      const c = currentColors(seconds)
      gl.uniform3fv(loc.uSkyTop, c.skyTop)
      gl.uniform3fv(loc.uSkyMid, c.skyMid)
      gl.uniform3fv(loc.uHorizon, c.horizon)
      gl.uniform3fv(loc.uSunGlow, c.sunGlow)
      gl.uniform3fv(loc.uDropTint, c.dropTint)
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    rafId = requestAnimationFrame(render)
  }

  function play() {
    if (!rafId) rafId = requestAnimationFrame(render)
  }
  function pause() {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }

  // バッテリー配慮: タブが隠れたら止める。
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause()
    else play()
  })
  window.addEventListener('resize', resize)

  // ドライバ都合などでコンテキストが失われても、復帰したら作り直して描画を続ける。
  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault()
      pause()
    },
    false,
  )
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      setupBuffer()
      // 喪失でテクスチャは無効化される。状態をリセットして現在の情景のパノラマを再ロード。
      panoTex = null
      panoDepthTex = null
      panoReady = 0
      panoDepthReady = 0
      panoKey = null
      if (buildProgram(quality, shaderType)) {
        if (scene) loadPano(scene)
        resize()
        play()
      }
    },
    false,
  )

  const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v))
  const glassOf = (s) => (s && s.glass === 'snow' ? 2 : s && s.glass === 'rain' ? 1 : 0)
  const foliageOf = (s) => (s && s.foliage === 'petals' ? 2 : s && s.foliage === 'leaves' ? 1 : 0)
  const seasonOf = (s) => {
    const id = (s && s.id) || ''
    return id.indexOf('spring') === 0 ? 0 : id.indexOf('autumn') === 0 ? 2 : id.indexOf('winter') === 0 ? 3 : 1
  }

  return {
    ok: true,
    // スプラット情景に切り替わる間など、シェーダー描画を一時停止／再開する
    pause() {
      pause()
    },
    resume() {
      play()
    },
    // 指スワイプなどから見回しの目標値を動かす（相対）
    addPan(dx, dy) {
      panTarget.x = clamp(panTarget.x + dx, PAN_LIMIT.x)
      panTarget.y = clamp(panTarget.y + dy, PAN_LIMIT.y)
    },
    // 端末の傾きなどから見回しの目標値を直接決める（絶対）
    setPanTarget(x, y) {
      panTarget.x = clamp(x, PAN_LIMIT.x)
      panTarget.y = clamp(y, PAN_LIMIT.y)
    },
    // 端末の傾き（nx,ny は -1..1）。パノラマでは視差（覗き込み）、それ以外は見回しに使う。
    applyTilt(nx, ny) {
      nx = Math.max(-1, Math.min(1, nx))
      ny = Math.max(-1, Math.min(1, ny))
      if (shaderType === 'windowPano') {
        parallaxBias.x = nx * 0.05
        parallaxBias.y = ny * 0.035
      } else {
        panTarget.x = clamp(nx * PAN_LIMIT.x, PAN_LIMIT.x)
        panTarget.y = clamp(ny * PAN_LIMIT.y, PAN_LIMIT.y)
      }
    },
    clearTilt() {
      parallaxBias.x = 0
      parallaxBias.y = 0
      panTarget.x = 0
      panTarget.y = 0
    },
    // 遠雷など。空をほのかに光らせる（雷鳴の少し前に呼ぶと自然）
    triggerFlash(strength) {
      flashLevel = Math.max(flashLevel, strength != null ? strength : 0.8)
    },
    // モーション過敏への配慮（OS設定 prefers-reduced-motion 等から）
    setReduceMotion(b) {
      reduceMotion = !!b
    },
    setWindowOpen(b) {
      windowOpenTarget = b ? 1 : 0
    },
    isWindowOpen() {
      return windowOpenTarget > 0.5
    },
    setScene(s) {
      scene = s
      glassMode = glassOf(s)
      foliageMode = foliageOf(s)
      seasonMode = seasonOf(s)
      // 見回しの可動域（情景ごと）。屋上などは広げてほぼ360°見渡せる。
      PAN_LIMIT.x = (s && s.panX) || 2.6
      loadPano(s)
      // 情景を変えたら見回しを正面へ戻す
      panTarget.x = 0
      panTarget.y = 0
      // 現象（描画タイプ）が変わったらシェーダーを組み直す
      const type = s.render || 'rainGlass'
      if (type !== shaderType) buildProgram(quality, type)
    },
    setSettings(s) {
      // 品質が変わったらシェーダーを組み直す
      if (s.quality !== quality) buildProgram(s.quality, shaderType)
      settings = s
      resize()
    },
    start(initialScene, initialSettings) {
      scene = initialScene
      settings = initialSettings
      glassMode = glassOf(initialScene)
      foliageMode = foliageOf(initialScene)
      seasonMode = seasonOf(initialScene)
      PAN_LIMIT.x = (initialScene && initialScene.panX) || 2.6
      loadPano(initialScene)
      if (!buildProgram(initialSettings.quality, initialScene.render || 'rainGlass')) return false
      resize()
      play()
      return true
    },
  }
}
