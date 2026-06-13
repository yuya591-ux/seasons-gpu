// 指/マウスのドラッグで景色を見回す。窓辺シリーズ（uPan を使うシェーダー）で効く。
// 他の情景では uPan が使われないので、操作しても見た目は変わらない（無害）。

export function attachLookAround(canvas, renderer, onActivity) {
  let dragging = false
  let lastX = 0
  let lastY = 0

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      /* 無視 */
    }
  })

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    const dx = (e.clientX - lastX) / w
    const dy = (e.clientY - lastY) / h
    lastX = e.clientX
    lastY = e.clientY
    // 「世界をつかんで動かす」感覚: 右へドラッグ→左を覗き込む
    renderer.addPan(-dx * 2.4, dy * 1.4)
    if (onActivity) onActivity()
  })

  const end = () => {
    dragging = false
  }
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', end)
}
