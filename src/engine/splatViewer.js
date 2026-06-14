// 本物の3D（ガウシアン・スプラット）ビューアのラッパー。
// Three.js ベースの @mkkellogg/gaussian-splats-3d を遅延読み込みし、スプラット情景でのみ使う。
// 情景の連打切替に耐えるよう、世代トークンで進行中の mount をキャンセル可能にしている。

let mountToken = 0
let viewer = null // 確定済みビューア
let container = null // 確定済みコンテナ

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
    }
  } catch (e) {
    return { error: String(e) }
  }
}

async function disposeViewer(v) {
  try {
    if (v) {
      if (v.stop) v.stop()
      if (v.dispose) await v.dispose()
    }
  } catch (e) {
    console.warn('スプラットビューアの破棄に失敗:', e)
  }
}

const withTimeout = (p, ms, label) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timeout ' + ms + 'ms')), ms)),
  ])

/** 確定済みのスプラット表示を片付ける（GPU/ワーカーを解放）。進行中の mount も無効化する。 */
export async function unmountSplat() {
  mountToken++
  const v = viewer
  const c = container
  viewer = null
  container = null
  await disposeViewer(v)
  if (c && c.parentNode) c.parentNode.removeChild(c)
}

/** スプラットを表示する。失敗時は例外を投げる（呼び出し側でフォールバックする）。 */
export async function mountSplat(parent, url) {
  const token = ++mountToken
  // 直前の確定済みを片付け（進行中の他 mount は token 差で自動的に無効化される）
  {
    const pv = viewer
    const pc = container
    viewer = null
    container = null
    await disposeViewer(pv)
    if (pc && pc.parentNode) pc.parentNode.removeChild(pc)
  }
  if (token !== mountToken) return

  const lc = document.createElement('div')
  lc.className = 'splat-stage'
  parent.appendChild(lc)

  const diag = document.createElement('pre')
  diag.className = 'splat-diag'
  lc.appendChild(diag)
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

  // 読み込み中の控えめな表示
  const loading = document.createElement('div')
  loading.className = 'splat-loading'
  loading.textContent = '本物の3Dを読み込み中…'
  lc.appendChild(loading)

  let lv = null
  // 自分の世代でなくなったら、作りかけを片付けて終了
  const bail = async () => {
    await disposeViewer(lv)
    if (lc.parentNode) lc.parentNode.removeChild(lc)
  }
  const current = () => token === mountToken

  try {
    state.steps.push('import')
    render()
    const [GS, THREE] = await Promise.all([
      import('@mkkellogg/gaussian-splats-3d'),
      import('three'),
    ])
    if (!current()) return bail()

    state.steps.push('viewer')
    render()
    lv = new GS.Viewer({
      rootElement: lc,
      cameraUp: [0, -1, 0],
      initialCameraPosition: [0, 0, -6],
      initialCameraLookAt: [0, 0, 0],
      selfDrivenMode: true,
      useBuiltInControls: true,
      sharedMemoryForWorkers: false,
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
    if (!current()) return bail()
    state.fetched = (data.byteLength / 1e6).toFixed(1) + 'MB'

    state.steps.push('parse')
    render()
    const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase()
    let parsePromise
    if (ext === 'ply') parsePromise = GS.PlyLoader.loadFromFileData(data, 1, 0, true, 0)
    else if (ext === 'ksplat') parsePromise = GS.KSplatLoader.loadFromFileData(data)
    else parsePromise = GS.SplatLoader.loadFromFileData(data, 1, 0, true)
    const splatBuffer = await withTimeout(parsePromise, 40000, 'parse')
    if (!current()) return bail()

    state.steps.push('add')
    render()
    await withTimeout(
      lv.addSplatBuffers([splatBuffer], [{ splatAlphaRemovalThreshold: 1 }], true, false, false, false, false),
      40000,
      'add',
    )
    if (!current()) return bail()

    state.steps.push('start')
    render()
    lv.start()

    // コンテキスト喪失の検知（preventDefault で復帰の余地を残す）
    const cv = lc.querySelector('canvas')
    if (cv) {
      cv.addEventListener('webglcontextlost', (e) => {
        e.preventDefault()
        state.lost = true
        diag.style.display = 'block'
        render()
      })
    }

    // オートフレーミング（浮遊splatを避け、四分位で被写体を捉える）
    try {
      const mesh = lv.getSplatMesh()
      const count = mesh.getSplatCount ? mesh.getSplatCount() : 0
      state.splats = count
      const N = Math.min(5000, count)
      const step = Math.max(1, Math.floor(count / N))
      const xs = [], ys = [], zs = []
      const tmp = new THREE.Vector3()
      for (let i = 0; i < count; i += step) {
        mesh.getSplatCenter(i, tmp, true)
        xs.push(tmp.x); ys.push(tmp.y); zs.push(tmp.z)
      }
      xs.sort((a, b) => a - b); ys.sort((a, b) => a - b); zs.sort((a, b) => a - b)
      const P = (arr, p) => arr[Math.floor((arr.length - 1) * p)] || 0
      const center = new THREE.Vector3(P(xs, 0.5), P(ys, 0.5), P(zs, 0.5))
      const ex = P(xs, 0.75) - P(xs, 0.25)
      const ey = P(ys, 0.75) - P(ys, 0.25)
      const ez = P(zs, 0.75) - P(zs, 0.25)
      const radius = 0.5 * Math.max(ex, ey, ez) || 1
      const dist = radius * 4.0
      const dir = new THREE.Vector3(0.3, -0.55, 0.9).normalize()
      lv.camera.position.copy(center).addScaledVector(dir, dist)
      lv.camera.near = Math.max(dist * 0.02, 0.01)
      lv.camera.far = dist * 12 + radius * 12
      lv.camera.updateProjectionMatrix()
      lv.camera.lookAt(center)
      if (lv.controls) {
        const ctl = lv.controls
        ctl.target.copy(center)
        ctl.minDistance = Math.max(radius * 0.2, 0.2)
        ctl.maxDistance = dist * 4
        ctl.enablePan = false
        ctl.autoRotate = true
        ctl.autoRotateSpeed = 0.35
        // 真下に潜って裏返らないよう、上下の見回しを制限
        ctl.minPolarAngle = 0.15 * Math.PI
        ctl.maxPolarAngle = 0.85 * Math.PI
        // 操作中は自動回転を止め、放したら数秒で再開
        let resumeTimer = 0
        ctl.addEventListener('start', () => {
          ctl.autoRotate = false
          clearTimeout(resumeTimer)
        })
        ctl.addEventListener('end', () => {
          resumeTimer = setTimeout(() => {
            if (token === mountToken) ctl.autoRotate = true
          }, 4000)
        })
        ctl.update()
      }
      state.steps.push('frame')
    } catch (e) {
      state.error = 'frame: ' + (e && e.message ? e.message : e)
    }

    if (!current()) return bail()

    // 窓枠（最前景のサッシ）
    const frame = document.createElement('div')
    frame.className = 'splat-frame'
    lc.appendChild(frame)

    // 確定（ここで初めてモジュール変数へ）
    viewer = lv
    container = lc
    lv = null

    loading.remove()
    state.steps.push('done')
    render()

    // 正常に出たら診断は数秒で自動的に隠す（エラー時は残す）
    setTimeout(() => {
      if (!state.error && token === mountToken) diag.style.display = 'none'
    }, 3500)
  } catch (e) {
    state.error = e && e.message ? e.message : String(e)
    if (loading.parentNode) loading.remove()
    diag.style.display = 'block'
    render()
    await disposeViewer(lv)
    // 失敗時は診断だけ残してコンテナは保持→呼び出し側がフォールバックし unmount する
    if (token === mountToken) {
      viewer = null
      container = lc
    } else if (lc.parentNode) {
      lc.parentNode.removeChild(lc)
    }
    throw e
  }
}

export function isSplatActive() {
  return !!viewer
}
