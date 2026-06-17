// 指/マウスのドラッグで景色を見回す。窓辺シリーズ（uPan を使うシェーダー）で効く。
// 他の情景では uPan が使われないので、操作しても見た目は変わらない（無害）。
// 指を離した後も、投げた勢いで少しだけ流れてゆっくり止まる（慣性）＝3Dの街と同じ手触りに統一。

export function attachLookAround(canvas, renderer, onActivity) {
  let dragging = false
  let lastX = 0
  let lastY = 0
  let vx = 0 // 投げの速度（addPan と同じ単位）
  let vy = 0
  let lastMoveT = 0
  let raf = 0

  const stopMomentum = () => { if (raf) { cancelAnimationFrame(raf); raf = 0 } }

  canvas.addEventListener('pointerdown', (e) => {
    stopMomentum() // 動いている最中に触れたら勢いを止めてつかむ
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
    vx = 0
    vy = 0
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
    const px = -dx * 2.4
    const py = dy * 1.4
    renderer.addPan(px, py)
    // 直近の動きで投げの速度を推定（急なスパイクは均す）
    vx = vx * 0.5 + px * 0.5
    vy = vy * 0.5 + py * 0.5
    lastMoveT = performance.now()
    if (onActivity) onActivity()
  })

  // 慣性: 離した勢いで少し流れ、摩擦でゆっくり止まる
  const momentum = () => {
    vx *= 0.86 // 摩擦をやや強めに＝0.5秒ほどで穏やかに止まる（飛び過ぎない癒しの所作）
    vy *= 0.86
    if (Math.abs(vx) < 0.0009 && Math.abs(vy) < 0.0009) { raf = 0; return }
    renderer.addPan(vx, vy) // addPan は可動域でクランプ＝端で自然に止まる
    if (onActivity) onActivity()
    raf = requestAnimationFrame(momentum)
  }

  const end = () => {
    if (!dragging) return
    dragging = false
    // 指を止めてから離した時は投げない（直前に動きが無ければ余韻なし＝狙った所で止められる）
    if (performance.now() - lastMoveT > 90) { vx = 0; vy = 0; return }
    // 速すぎる投げは穏やかに抑える（癒しの所作＝飛び過ぎない）
    const cap = 0.105
    vx = Math.max(-cap, Math.min(cap, vx))
    vy = Math.max(-cap, Math.min(cap, vy))
    if ((Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001) && !raf) raf = requestAnimationFrame(momentum)
  }
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', () => { dragging = false; vx = 0; vy = 0; stopMomentum() })
}
