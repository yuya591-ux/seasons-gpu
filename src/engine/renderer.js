// WebGL レンダラ。フルスクリーン三角形に、情景ごとのシェーダーを当てて描く。
// 情景のパレットを時間でゆっくり移ろわせ、設定（強さ・明るさ・品質）を反映する。
// 情景の render 種別が変わったらシェーダー（プログラム）を組み直す。

import { getShader } from '../shaders/index.js'
import { hexToRgb, mixRgb } from '../util/color.js'

const BASE = import.meta.env.BASE_URL || '/'

// 解像度（端末のピクセル密度の上限）。レイマーチは画素数で重さが決まるため控えめに。
// 荒さは FXAA＋アンシャープで補う。重い端末は下の自動調整でさらに落とす。
const DPR_BY_QUALITY = { soft: 2.25, standard: 1.75, light: 1.4 }

// ── 後処理アンチエイリアス（FXAA）──
// 情景はフルスクリーン三角形に手続き的に描かれるため、輪郭（step境界）がジャギる。
// 一度オフスクリーンに描いてから FXAA で全輪郭をなめらかにし、画質の荒さを抑える。
const FXAA_VS = /* glsl */ `
  attribute vec2 aPosition;
  void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`
const FXAA_FS = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;
  uniform vec2 uResolution;
  void main() {
    vec2 inv = 1.0 / uResolution;
    vec2 uv = gl_FragCoord.xy * inv;
    vec3 rgbM  = texture2D(uTex, uv).rgb;
    vec3 rgbNW = texture2D(uTex, uv + vec2(-1.0, -1.0) * inv).rgb;
    vec3 rgbNE = texture2D(uTex, uv + vec2( 1.0, -1.0) * inv).rgb;
    vec3 rgbSW = texture2D(uTex, uv + vec2(-1.0,  1.0) * inv).rgb;
    vec3 rgbSE = texture2D(uTex, uv + vec2( 1.0,  1.0) * inv).rgb;
    vec3 luma = vec3(0.299, 0.587, 0.114);
    float lM = dot(rgbM, luma);
    float lNW = dot(rgbNW, luma), lNE = dot(rgbNE, luma);
    float lSW = dot(rgbSW, luma), lSE = dot(rgbSE, luma);
    float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
    float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
    // 平坦な領域は AA せず、ごく軽い先鋭化だけ（解像感を底上げ）
    vec3 blur4 = (rgbNW + rgbNE + rgbSW + rgbSE) * 0.25;
    if (lMax - lMin < 0.018) {
      gl_FragColor = vec4(clamp(rgbM + (rgbM - blur4) * 0.18, 0.0, 1.0), 1.0);
      return;
    }
    vec2 dir;
    dir.x = -((lNW + lNE) - (lSW + lSE));
    dir.y =  ((lNW + lSW) - (lNE + lSE));
    float reduce = max((lNW + lNE + lSW + lSE) * 0.25 * 0.125, 1.0 / 128.0);
    float rcpMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
    dir = clamp(dir * rcpMin, -8.0, 8.0) * inv;
    vec3 rA = 0.5 * (texture2D(uTex, uv + dir * (1.0 / 3.0 - 0.5)).rgb
                   + texture2D(uTex, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
    vec3 rB = rA * 0.5 + 0.25 * (texture2D(uTex, uv + dir * -0.5).rgb
                               + texture2D(uTex, uv + dir *  0.5).rgb);
    float lB = dot(rB, luma);
    vec3 aa = (lB < lMin || lB > lMax) ? rA : rB;
    // アンシャープマスク（FXAA とソフトな手続き描画で失われた解像感を取り戻す＝くっきり）
    aa += (aa - blur4) * 0.42;
    gl_FragColor = vec4(clamp(aa, 0.0, 1.0), 1.0);
  }
`

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

  // ── FXAA 用のオフスクリーン（FBO＋カラーテクスチャ）と仕上げプログラム ──
  let fxaaProgram = null
  let fxaaLoc = {}
  let fxaaAttrib = -1
  let sceneAttrib = -1
  let fbo = null
  let fboTex = null
  let fboW = 0
  let fboH = 0
  let aaEnabled = true // 品質 light では負荷を避けて素通し
  function buildFxaa() {
    const vs = compile(gl, gl.VERTEX_SHADER, FXAA_VS)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FXAA_FS)
    if (!vs || !fs) return false
    const p = gl.createProgram()
    gl.attachShader(p, vs)
    gl.attachShader(p, fs)
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('FXAAプログラムのリンクに失敗:', gl.getProgramInfoLog(p))
      return false
    }
    fxaaProgram = p
    fxaaAttrib = gl.getAttribLocation(p, 'aPosition')
    fxaaLoc = {
      uTex: gl.getUniformLocation(p, 'uTex'),
      uResolution: gl.getUniformLocation(p, 'uResolution'),
    }
    return true
  }
  buildFxaa()
  // オフスクリーンを画面サイズに合わせて確保（サイズ変化時のみ作り直す）
  function ensureFBO(w, h) {
    if (!fxaaProgram) return
    if (!fbo) fbo = gl.createFramebuffer()
    if (!fboTex || fboW !== w || fboH !== h) {
      if (!fboTex) fboTex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, fboTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      fboW = w
      fboH = h
    }
  }

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

  // 窓の外の背景画像（任意。Flux生成画像など）。情景が bg を持つときだけ読み込む。
  // 本番は保存済みPNGを表示するだけ＝実行時に外部APIを叩かない（外部AI生成の組み込み方針）。
  let bgTex = null
  let bgReady = 0
  let bgKey = null
  function loadBg(s) {
    const key = s && s.bg ? s.bg : null
    if (key === bgKey) return
    bgKey = key
    if (bgTex) gl.deleteTexture(bgTex) // 旧テクスチャを解放（GPUメモリの累積を防ぐ）
    bgTex = null
    bgReady = 0
    if (!key) return
    loadTexture(BASE + s.bg, (tex) => {
      bgTex = tex
      bgReady = tex ? 1 : 0
    })
  }

  let program = null
  let loc = {}
  let quality = 'standard'
  let shaderType = 'rainGlass'
  let glassMode = 0 // 窓辺シリーズのガラス現象 0=なし 1=雨 2=雪
  let foliageMode = 0 // 季節の舞い 0=なし 1=紅葉 2=花びら
  let seasonMode = 1 // 季節 0=春 1=夏 2=秋 3=冬（窓の状態＝網戸/結露の出し分け）
  let lowRiseMode = 0 // 0=通常の街 1=低層住宅地（北寺尾など坂の住宅地）
  let scene = null
  let settings = { rain: 0.65, brightness: 1.0, quality: 'standard' }
  let rafId = 0
  const startTime = performance.now()
  // 描画解像度の自動調整（重い端末ではフレーム時間を見て解像度を落とし、滑らかさを保つ）
  let renderScale = 1.0
  let frameEMA = 16.7
  let lastFrame = 0
  let lastRenderTime = 0 // 約30fpsへ間引くための前回描画時刻（GPU負荷と発熱を半減）
  let adaptCooldown = 60
  // 窓を開ける（0=閉じてガラス越し, 1=開いて素通し）。トグルでなめらかに開閉。
  let windowOpen = 0
  let windowOpenTarget = 0
  // 身を乗り出す（0=窓辺, 1=枠が消えて景色だけを180°見渡す）。開けた後の一段深いモード。
  let leanOut = 0
  let leanOutTarget = 0
  let basePanX = 2.6 // 情景ごとの基本可動域（lean-out で広げる）

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
    sceneAttrib = aPosition
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
      uLeanOut: gl.getUniformLocation(program, 'uLeanOut'),
      uSeason: gl.getUniformLocation(program, 'uSeason'),
      uLowRise: gl.getUniformLocation(program, 'uLowRise'),
      uGlass: gl.getUniformLocation(program, 'uGlass'),
      uFoliage: gl.getUniformLocation(program, 'uFoliage'),
      uFlash: gl.getUniformLocation(program, 'uFlash'),
      uPano: gl.getUniformLocation(program, 'uPano'),
      uHasPano: gl.getUniformLocation(program, 'uHasPano'),
      uBg: gl.getUniformLocation(program, 'uBg'),
      uHasBg: gl.getUniformLocation(program, 'uHasBg'),
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
    aaEnabled = q !== 'light' && !!fxaaProgram // 低品質端末では後処理を省いて軽く保つ
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
    // 次フレームを先に予約し、約30fpsに間引く（アンビエントに60fpsは不要＝GPU負荷と発熱を約半減）
    rafId = requestAnimationFrame(render)
    if (now - lastRenderTime < 30) return // ~33fps上限（描画をスキップしてGPUを休ませる）
    lastRenderTime = now
    // フレーム時間を測り、重い端末では描画解像度を自動調整（発熱を抑え滑らかさを保つ）
    if (lastFrame > 0) {
      const dt = now - lastFrame
      if (dt > 0 && dt < 300) frameEMA = frameEMA * 0.9 + dt * 0.1
    }
    lastFrame = now
    if (adaptCooldown > 0) {
      adaptCooldown--
    } else if (frameEMA > 42 && renderScale > 0.6) {
      renderScale = Math.max(0.6, renderScale - 0.1) // 24fps未満が続けば解像度を落として発熱/カクつきを抑える
      adaptCooldown = 60
    } else if (frameEMA < 26 && renderScale < 1.0) {
      renderScale = Math.min(1.0, renderScale + 0.06) // 余裕があればゆっくり戻す
      adaptCooldown = 120
    }
    resize()
    const seconds = (now - startTime) / 1000
    // 見回しをなめらかに追従。残差を「動きの視差」として使う（首を振ると手前が動く）
    const gapX = panTarget.x - panCur.x
    const gapY = panTarget.y - panCur.y
    panCur.x += gapX * 0.12
    panCur.y += gapY * 0.12
    const clampP = (v) => Math.max(-0.14, Math.min(0.14, v)) // 覗き込み視差の天井（身を乗り出す手応え・3D感）
    // 情景プログラムを現用に戻し（前フレームの仕上げで FXAA が現用のため）、頂点を結び直す
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(sceneAttrib)
    gl.vertexAttribPointer(sceneAttrib, 2, gl.FLOAT, false, 0, 0)
    // アンチエイリアス時は一旦オフスクリーンへ描く
    if (aaEnabled) {
      ensureFBO(canvas.width, canvas.height)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
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
        clampP(gapX * 0.09 + parallaxBias.x),
        clampP(gapY * 0.06 + parallaxBias.y),
      )
    }
    if (loc.uReduceMotion) gl.uniform1f(loc.uReduceMotion, reduceMotion ? 1 : 0)
    windowOpen += (windowOpenTarget - windowOpen) * 0.06 // なめらかに開閉（少しゆっくり＝開閉が分かる）
    leanOut += (leanOutTarget - leanOut) * 0.06
    if (loc.uWindowOpen) gl.uniform1f(loc.uWindowOpen, windowOpen)
    if (loc.uLeanOut) gl.uniform1f(loc.uLeanOut, leanOut)
    // 乗り出すと可動域を広げて景色を180°見渡せる
    PAN_LIMIT.x = basePanX + leanOut * Math.max(0, 3.14 - basePanX)
    if (loc.uSeason) gl.uniform1f(loc.uSeason, seasonMode)
    if (loc.uLowRise) gl.uniform1f(loc.uLowRise, lowRiseMode)
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
    // 窓の外の背景画像（あれば）をテクスチャユニット2に。屈折座標でサンプルするのはシェーダー側。
    if (loc.uBg) {
      gl.activeTexture(gl.TEXTURE2)
      gl.bindTexture(gl.TEXTURE_2D, bgTex)
      gl.uniform1i(loc.uBg, 2)
      gl.uniform1f(loc.uHasBg, bgReady)
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
    // 仕上げ: オフスクリーンを FXAA で画面へ（輪郭をなめらかに＝荒さ低減）
    if (aaEnabled) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.useProgram(fxaaProgram)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.enableVertexAttribArray(fxaaAttrib)
      gl.vertexAttribPointer(fxaaAttrib, 2, gl.FLOAT, false, 0, 0)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, fboTex)
      gl.uniform1i(fxaaLoc.uTex, 0)
      gl.uniform2f(fxaaLoc.uResolution, canvas.width, canvas.height)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    // 次フレームは関数冒頭で予約済み（二重予約を避ける）
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
      // 喪失でテクスチャ/FBOは無効化される。状態をリセットして作り直す。
      panoTex = null
      panoDepthTex = null
      panoReady = 0
      panoDepthReady = 0
      panoKey = null
      bgTex = null
      bgReady = 0
      bgKey = null
      fbo = null
      fboTex = null
      fboW = 0
      fboH = 0
      buildFxaa()
      if (buildProgram(quality, shaderType)) {
        if (scene) {
          loadPano(scene)
          loadBg(scene)
        }
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
      if (!b) leanOutTarget = 0 // 閉じると乗り出しも戻す
    },
    isWindowOpen() {
      return windowOpenTarget > 0.5
    },
    setLeanOut(b) {
      leanOutTarget = b ? 1 : 0
      if (b) windowOpenTarget = 1 // 乗り出すには開いている前提
    },
    isLeanOut() {
      return leanOutTarget > 0.5
    },
    setScene(s) {
      scene = s
      glassMode = glassOf(s)
      foliageMode = foliageOf(s)
      seasonMode = seasonOf(s)
      lowRiseMode = s && s.lowRise ? 1 : 0
      // 見回しの可動域（情景ごと）。屋上などは広げてほぼ360°見渡せる。
      basePanX = (s && s.panX) || 2.6
      loadPano(s)
      loadBg(s)
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
      lowRiseMode = initialScene && initialScene.lowRise ? 1 : 0
      basePanX = (initialScene && initialScene.panX) || 2.6
      loadPano(initialScene)
      loadBg(initialScene)
      if (!buildProgram(initialSettings.quality, initialScene.render || 'rainGlass')) return false
      resize()
      play()
      return true
    },
  }
}
