// 本物の3D（ガウシアン・スプラット）ビューアのラッパー。
// Three.js ベースの @mkkellogg/gaussian-splats-3d を遅延読み込みし、スプラット情景でのみ使う。
// iPhone 等で原因を特定できるよう、画面上に診断情報を表示する。

let viewer = null
let container = null
let errHandlers = null

// WebGL2 の対応状況を端末側で調べる（iOS で何が無いかを可視化）。
function webglCaps() {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    if (!gl) {
      const gl1 = c.getContext('webgl')
      return { webgl2: false, webgl1: !!gl1 }
    }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const has = (n) => !!gl.getExtension(n)
    return {
      webgl2: true,
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a',
      maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      colorBufFloat: has('EXT_color_buffer_float'),
      floatLinear: has('OES_texture_float_linear'),
      floatBlend: has('EXT_float_blend'),
    }
  } catch (e) {
    return { error: String(e) }
  }
}

export async function mountSplat(parent, url) {
  await unmountSplat()

  container = document.createElement('div')
  container.className = 'splat-stage'
  parent.appendChild(container)

  // 画面上の診断パネル
  const diag = document.createElement('pre')
  diag.className = 'splat-diag'
  container.appendChild(diag)
  const state = { caps: webglCaps(), steps: [], error: null, splats: null, lost: false, fetched: null }
  const render = () => {
    const c = state.caps
    diag.textContent =
      '【3D診断】 タップで閉じる\n' +
      `WebGL2: ${c.webgl2}` + (c.webgl1 != null ? ` (webgl1:${c.webgl1})` : '') + '\n' +
      `GPU: ${c.renderer || '-'}\n` +
      `maxTex: ${c.maxTex || '-'}  colBufFloat: ${c.colorBufFloat}  floatLinear: ${c.floatLinear}\n` +
      `fetch: ${state.fetched || '-'}\n` +
      `手順: ${state.steps.join(' > ') || '-'}\n` +
      `splats: ${state.splats == null ? '-' : state.splats}\n` +
      (state.lost ? 'WebGLコンテキスト喪失\n' : '') +
      (state.error ? 'ERROR: ' + state.error : '')
  }
  render()
  diag.addEventListener('click', () => {
    diag.style.display = 'none'
  })

  // 実エラー（ワーカー/WASM等）を画面に出す
  const onErr = (m) => {
    state.error = (state.error ? state.error + ' | ' : '') + m
    diag.style.display = 'block'
    render()
  }
  errHandlers = {
    err: (e) => onErr('err:' + (e.message || e.filename || '?')),
    rej: (e) => onErr('rej:' + (e.reason && e.reason.message ? e.reason.message : String(e.reason))),
  }
  window.addEventListener('error', errHandlers.err)
  window.addEventListener('unhandledrejection', errHandlers.rej)

  const withTimeout = (p, ms, label) =>
    Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timeout ' + ms + 'ms')), ms)),
    ])

  try {
    state.steps.push('import')
    render()
    const [GS, THREE] = await Promise.all([
      import('@mkkellogg/gaussian-splats-3d'),
      import('three'),
    ])

    state.steps.push('viewer')
    render()
    viewer = new GS.Viewer({
      rootElement: container,
      cameraUp: [0, -1, 0],
      initialCameraPosition: [0, 0, -6],
      initialCameraLookAt: [0, 0, 0],
      selfDrivenMode: true,
      useBuiltInControls: true,
      sharedMemoryForWorkers: false,
      // iOS では GPU ソート（float描画バッファ依存）が落ちやすいので CPU ソートにする
      gpuAcceleratedSort: false,
      integerBasedSort: false,
      halfPrecisionCovariancesOnGPU: false,
      antialiased: false,
    })

    // iOS ではライブラリ内蔵の取得(fetchWithProgress)が失敗するため、こちらで取得して渡す
    state.steps.push('fetch')
    render()
    const data = await withTimeout(
      fetch(url).then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status)
        return r.arrayBuffer()
      }),
      30000,
      'fetch',
    )
    state.fetched = (data.byteLength / 1e6).toFixed(1) + 'MB'

    state.steps.push('parse')
    render()
    const splatBuffer = await withTimeout(
      GS.SplatLoader.loadFromFileData(data, 1, 0, true),
      30000,
      'parse',
    )

    state.steps.push('add')
    render()
    await withTimeout(
      viewer.addSplatBuffers([splatBuffer], [{ splatAlphaRemovalThreshold: 1 }], true, false, false, false, false),
      30000,
      'add',
    )

    state.steps.push('start')
    render()
    viewer.start()

    // コンテキスト喪失を検知して画面に出す
    const cv = container.querySelector('canvas')
    if (cv) {
      cv.addEventListener('webglcontextlost', () => {
        state.lost = true
        diag.style.display = 'block'
        render()
      })
    }

    // オートフレーミング
    try {
      const mesh = viewer.getSplatMesh()
      state.splats = mesh.getSplatCount ? mesh.getSplatCount() : '?'
      const box = mesh.computeBoundingBox(true)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const radius = 0.5 * Math.max(size.x, size.y, size.z) || 1
      viewer.camera.position.set(center.x, center.y, center.z + radius * 2.2)
      viewer.camera.lookAt(center)
      if (viewer.controls) {
        viewer.controls.target.copy(center)
        viewer.controls.minDistance = Math.max(radius * 0.3, 0.4)
        viewer.controls.maxDistance = radius * 8 + 5
        viewer.controls.enablePan = false
        viewer.controls.autoRotate = true
        viewer.controls.autoRotateSpeed = 0.5
        viewer.controls.update()
      }
      state.steps.push('frame')
    } catch (e) {
      state.error = 'frame: ' + (e && e.message ? e.message : e)
    }

    state.steps.push('done')
    render()
  } catch (e) {
    state.error = (e && e.message ? e.message : String(e))
    diag.style.display = 'block'
    render()
  }
  return viewer
}

export async function unmountSplat() {
  if (errHandlers) {
    window.removeEventListener('error', errHandlers.err)
    window.removeEventListener('unhandledrejection', errHandlers.rej)
    errHandlers = null
  }
  if (viewer) {
    try {
      if (viewer.stop) viewer.stop()
      if (viewer.dispose) await viewer.dispose()
    } catch {
      /* 破棄時のエラーは無視 */
    }
    viewer = null
  }
  if (container && container.parentNode) container.parentNode.removeChild(container)
  container = null
}

export function isSplatActive() {
  return !!viewer
}
