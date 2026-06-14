// 本物の3D（ガウシアン・スプラット）ビューアのラッパー。
// Three.js ベースの @mkkellogg/gaussian-splats-3d を遅延読み込みし、スプラット情景でのみ使う。
// 既存のシェーダー描画とは排他（スプラット表示中はシェーダーを止める）。

let viewer = null
let container = null

/** スプラットを表示する。parent にビューア用の要素を載せ、url の .splat/.ply を読み込む。 */
export async function mountSplat(parent, url) {
  await unmountSplat()
  const [GS, THREE] = await Promise.all([
    import('@mkkellogg/gaussian-splats-3d'),
    import('three'),
  ])

  container = document.createElement('div')
  container.className = 'splat-stage'
  parent.appendChild(container)

  viewer = new GS.Viewer({
    rootElement: container,
    // 3DGS のスプラットは Y が下向きのことが多い
    cameraUp: [0, -1, 0],
    initialCameraPosition: [0, 0, -6],
    initialCameraLookAt: [0, 0, 0],
    selfDrivenMode: true, // 自前の描画ループ
    useBuiltInControls: true, // ドラッグで見回し
    // GitHub Pages は COOP/COEP が無く SharedArrayBuffer が使えないため共有メモリを切る
    sharedMemoryForWorkers: false,
    gpuAcceleratedSort: true,
    antialiased: false,
  })

  // .splat は逐次読み込み非対応のため一括読み込み（読込中はローディング表示）
  await viewer.addSplatScene(url, { showLoadingUI: true, progressiveLoad: false })
  viewer.start()

  // オートフレーミング: 3Dの境界を計算し、カメラを必ず3Dへ向ける（真っ黒回避）
  try {
    const mesh = viewer.getSplatMesh()
    const box = mesh.computeBoundingBox(true)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const radius = 0.5 * Math.max(size.x, size.y, size.z)
    const dist = Math.max(radius * 2.2, 2)
    viewer.camera.position.set(center.x, center.y, center.z + dist)
    viewer.camera.lookAt(center)
    if (viewer.controls) {
      viewer.controls.target.copy(center)
      viewer.controls.minDistance = Math.max(radius * 0.3, 0.5)
      viewer.controls.maxDistance = radius * 6 + 5
      viewer.controls.update()
    }
  } catch (e) {
    console.warn('オートフレーミングに失敗（既定カメラで表示）:', e)
  }

  // 窓辺らしい、ゆるやかな見回し
  const c = viewer.controls
  if (c) {
    c.enablePan = false
    c.enableZoom = true
    c.autoRotate = true
    c.autoRotateSpeed = 0.5
    c.rotateSpeed = 0.5
    c.zoomSpeed = 0.6
  }
  return viewer
}

/** スプラット表示を片付ける（GPU/ワーカーを解放）。 */
export async function unmountSplat() {
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
