// 一人称「部屋モード」操作。室内のある視点に立ち、指/傾きで首を振って見回す。
// （物を周回する OrbitControls とは別物。窓辺シリーズの本命＝“その部屋にいる”体験の土台）

export function createRoomControls(THREE, viewer, canvas, viewpoint, up) {
  const camera = viewer.camera
  const U = up.clone().normalize()
  const upQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), U)
  const pos = viewpoint.clone()

  let yaw = 0
  let pitch = 0
  let lean = 0 // 前後の身の乗り出し（控えめ）
  let dragging = false
  let lastX = 0
  let lastY = 0
  let lastInteract = 0
  let raf = 0
  const tmpFwd = new THREE.Vector3()
  const tmpTarget = new THREE.Vector3()

  function forward() {
    const cp = Math.cos(pitch)
    return tmpFwd
      .set(cp * Math.sin(yaw), Math.sin(pitch), cp * Math.cos(yaw))
      .applyQuaternion(upQ)
  }

  function apply() {
    const fwd = forward()
    camera.up.copy(U)
    camera.position.copy(pos).addScaledVector(fwd, lean)
    tmpTarget.copy(camera.position).add(fwd)
    camera.lookAt(tmpTarget)
  }

  function loop() {
    // しばらく操作が無ければ、ゆっくり首を振って“その場の気配”を出す
    if (performance.now() - lastInteract > 3500) yaw += 0.0009
    apply()
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  const onDown = (e) => {
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
    lastInteract = performance.now()
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      /* 無視 */
    }
  }
  const onMove = (e) => {
    if (!dragging) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    yaw -= dx * 0.004
    pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * 0.004))
    lastInteract = performance.now()
  }
  const onUp = () => {
    dragging = false
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)

  return {
    // 端末の傾き（-1..1）で見回す
    setLook(nx, ny) {
      yaw = -nx * 1.3
      pitch = Math.max(-1.0, Math.min(1.0, ny * 0.8))
      lastInteract = performance.now()
    },
    dispose() {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
    },
  }
}
