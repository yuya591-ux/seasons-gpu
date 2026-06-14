// 端末の傾き（ジャイロ）で見回す。既定はオフ。iOS 13+ は許可が要る（ユーザー操作内で要求）。
// 有効化した瞬間の姿勢を基準にし、そこからの傾きを見回し量にする。

export function createTilt(renderer) {
  let enabled = false
  let base = null

  function handle(e) {
    if (!enabled) return
    const gx = e.gamma || 0 // 左右の傾き
    const gy = e.beta || 0 // 前後の傾き
    if (base === null) base = { gx, gy }
    // 基準姿勢からの傾きを -1..1 に。約25°で端。
    const nx = (gx - base.gx) / 25
    const ny = -(gy - base.gy) / 25
    renderer.applyTilt(nx, ny)
  }
  window.addEventListener('deviceorientation', handle)

  return {
    async enable() {
      const DOE = window.DeviceOrientationEvent
      if (DOE && typeof DOE.requestPermission === 'function') {
        try {
          const res = await DOE.requestPermission()
          if (res !== 'granted') return false
        } catch {
          return false
        }
      }
      base = null
      enabled = true
      return true
    },
    disable() {
      enabled = false
      renderer.clearTilt()
    },
  }
}
