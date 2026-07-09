// WebGL側の計測腕: 実アプリと同じ古典WebGLRenderer＋同じ省電力設定。
import * as THREE from 'three'
import { buildBenchScene } from './benchScene.js'

export async function create(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' })
  const built = buildBenchScene(THREE)
  return {
    renderer,
    ...built,
    backend: 'WebGL（いまの方式）',
    info: () => (renderer.info && renderer.info.render) || {},
  }
}
