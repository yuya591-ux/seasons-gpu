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
    // 35°傾けたら端まで見回す
    const dx = (gx - base.gx) / 35
    const dy = (gy - base.gy) / 35
    renderer.setPanTarget(dx * 1.25, -dy * 0.28)
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
      renderer.setPanTarget(0, 0)
    },
  }
}
