// 配管確認用の最小シーン。
// 画面いっぱいの三角形にフラグメントシェーダーを当て、色だけがゆっくり移ろう。
// 雨粒・水面などの本格的な現象はまだ作らない（WebGL が動くことの確認が目的）。

import { vertexSource, fragmentSource } from './shaders/ambient.js'

const canvas = document.getElementById('scene')
const fallback = document.getElementById('fallback')

/** WebGL 非対応・初期化失敗時は静かにフォールバック表示へ。 */
function showFallback() {
  canvas.hidden = true
  if (fallback) fallback.hidden = false
}

const gl =
  canvas.getContext('webgl', { antialias: false, alpha: false }) ||
  canvas.getContext('experimental-webgl')

if (!gl) {
  showFallback()
} else {
  start(gl)
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('シェーダーのコンパイルに失敗:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(gl) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  if (!vs || !fs) return null
  const program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('プログラムのリンクに失敗:', gl.getProgramInfoLog(program))
    return null
  }
  return program
}

function start(gl) {
  const program = createProgram(gl)
  if (!program) {
    showFallback()
    return
  }

  // 画面全体を覆う 1 枚の三角形（フルスクリーン・トライアングル）。
  const positions = new Float32Array([-1, -1, 3, -1, -1, 3])
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

  const aPosition = gl.getAttribLocation(program, 'aPosition')
  const uResolution = gl.getUniformLocation(program, 'uResolution')
  const uTime = gl.getUniformLocation(program, 'uTime')

  gl.useProgram(program)
  gl.enableVertexAttribArray(aPosition)
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)

  // 高解像度端末は重くなりすぎないよう DPR を 2 で頭打ちにする。
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.floor(canvas.clientWidth * dpr)
    const h = Math.floor(canvas.clientHeight * dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    gl.viewport(0, 0, canvas.width, canvas.height)
  }
  window.addEventListener('resize', resize)
  resize()

  const startTime = performance.now()
  let rafId = 0

  function render(now) {
    resize()
    gl.uniform2f(uResolution, canvas.width, canvas.height)
    gl.uniform1f(uTime, (now - startTime) / 1000)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    rafId = requestAnimationFrame(render)
  }

  // バッテリー配慮: 非アクティブ時は描画を止める。
  function handleVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(rafId)
      rafId = 0
    } else if (!rafId) {
      rafId = requestAnimationFrame(render)
    }
  }
  document.addEventListener('visibilitychange', handleVisibility)

  rafId = requestAnimationFrame(render)
}
