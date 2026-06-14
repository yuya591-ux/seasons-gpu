// 一人称「部屋モード」操作。室内のある視点に立ち、指/傾きで首を振って見回す。
// 一本指=見回し（首振り）、二本指=前後に身を乗り出す（lean／“顔を覗かせる”）。
// （物を周回する OrbitControls とは別物。窓辺シリーズの本命＝“その部屋にいる”体験の土台）

export function createRoomControls(THREE, viewer, canvas, viewpoint, up, maxLean = 1) {
  const camera = viewer.camera
  const U = up.clone().normalize()
  const upQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), U)
  const pos = viewpoint.clone()

  let yaw = 0
  let pitch = 0.12 // やや前を見る（床を見下ろしすぎない自然な視線）
  let lean = 0 // 前後の身の乗り出し
  let lastInteract = 0
  let raf = 0
  const pointers = new Map()
  let prevPinch = 0
  const tmpFwd = new THREE.Vector3()
  const tmpTarget = new THREE.Vector3()
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

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
    if (performance.now() - lastInteract > 3500) yaw += 0.0009 // 無操作でゆっくり見回す
    apply()
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  function pinchDist() {
    const a = [...pointers.values()]
    return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)
  }
  const onDown = (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    lastInteract = performance.now()
    if (pointers.size === 2) prevPinch = pinchDist()
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      /* 無視 */
    }
  }
  const onMove = (e) => {
    const p = pointers.get(e.pointerId)
    if (!p) return
    if (pointers.size === 1) {
      yaw -= (e.clientX - p.x) * 0.004
      pitch = clamp(pitch + (e.clientY - p.y) * 0.004, -1.2, 1.2)
    }
    p.x = e.clientX
    p.y = e.clientY
    if (pointers.size === 2) {
      const d = pinchDist()
      if (prevPinch) lean = clamp(lean + (d - prevPinch) * 0.01, -maxLean, maxLean)
      prevPinch = d
    }
    lastInteract = performance.now()
  }
  const onUp = (e) => {
    pointers.delete(e.pointerId)
    prevPinch = 0
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)

  return {
    setLook(nx, ny) {
      yaw = -nx * 1.3
      pitch = clamp(ny * 0.8, -1.0, 1.0)
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
