// WebGPU側の計測腕: three/webgpu の WebGPURenderer（iOS 26 SafariではMetal直結）。
// WebGPUが使えない環境では three が自動でWebGL2の代替経路に落ちる＝その場合はHUDに明示する。
import * as THREE from 'three/webgpu'
import { buildBenchScene } from './benchScene.js'

export async function create(canvas) {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, powerPreference: 'low-power' })
  await renderer.init()
  const isGPU = !!(renderer.backend && renderer.backend.isWebGPUBackend)
  const built = buildBenchScene(THREE)
  return {
    renderer,
    ...built,
    backend: isGPU ? 'WebGPU（新しい方式）' : 'WebGL2 代替（この端末はWebGPU不可）',
    isGPU,
    info: () => (renderer.info && renderer.info.render) || {},
  }
}
