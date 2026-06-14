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
  let scene = null
  let settings = { rain: 0.65, brightness: 1.0, quality: 'standard' }
  let rafId = 0
  const startTime = performance.now()

  // 見回し（uPan）。指の操作で目標値を動かし、毎フレームなめらかに追従させる。
  const panCur = { x: 0, y: 0 }
  const panTarget = { x: 0, y: 0 }
  const PAN_LIMIT = { x: 2.6, y: 0.3 }

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
      uGlass: gl.getUniformLocation(program, 'uGlass'),
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
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_BY_QUALITY[quality] || 1.5)
    const w = Math.floor(canvas.clientWidth * dpr)
    const h = Math.floor(canvas.clientHeight * dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  // 夕方→暮れ際を、ループ感の出ないゆっくりした揺れで行き来する。
  function driftFactor(seconds) {
    const period = (scene && scene.driftPeriod) || 300
    const w = (2 * Math.PI) / period
    // 2つの周期を混ぜて単調なループを避ける
    const v = 0.5 + 0.35 * Math.sin(w * seconds) + 0.15 * Math.sin(w * 2.3 * seconds + 1.0)
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
    resize()
    const seconds = (now - startTime) / 1000
    // 見回しをなめらかに追従
    panCur.x += (panTarget.x - panCur.x) * 0.12
    panCur.y += (panTarget.y - panCur.y) * 0.12
    gl.uniform2f(loc.uResolution, canvas.width, canvas.height)
    gl.uniform1f(loc.uTime, seconds)
    gl.uniform2f(loc.uPan, panCur.x, panCur.y)
    gl.uniform1f(loc.uGlass, glassMode)
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
      if (buildProgram(quality, shaderType)) {
        resize()
        play()
      }
    },
    false,
  )

  const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v))
  const glassOf = (s) => (s && s.glass === 'snow' ? 2 : s && s.glass === 'rain' ? 1 : 0)

  return {
    ok: true,
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
    setScene(s) {
      scene = s
      glassMode = glassOf(s)
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
      loadPano(initialScene)
      if (!buildProgram(initialSettings.quality, initialScene.render || 'rainGlass')) return false
      resize()
      play()
      return true
    },
  }
}
