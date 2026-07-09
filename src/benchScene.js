// 発熱ベンチ用の擬似「窓辺」負荷。実アプリの既定滞在ビュー（窓辺idle）と同じ規模＝
// 描画コール約2100・三角形約80万・一部だけ毎フレーム行列更新、を無地の球の群れで再現する。
// THREE名前空間を引数で受け取る＝'three'(WebGL) と 'three/webgpu' のクラスを絶対に混ぜないため
// （別モジュール実体のためinstanceof判定が壊れる）。
export function buildBenchScene(THREE) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x8fb4d8)

  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x59524a, 0.9))
  const sun = new THREE.DirectionalLight(0xfff2dc, 1.0)
  sun.position.set(60, 80, 40)
  scene.add(sun)

  // 実アプリと同じトゥーン用3段グラデ
  const grad = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat)
  grad.minFilter = THREE.NearestFilter
  grad.magFilter = THREE.NearestFilter
  grad.needsUpdate = true

  // 決定的な擬似乱数＝WebGL/WebGPUで完全同一の配置
  let s = 12345
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)

  const COUNT = 2100
  const geo = new THREE.SphereGeometry(0.5, 16, 12) // 384三角形 × 2100 ≈ 80万
  const mats = []
  for (let i = 0; i < 40; i++) {
    mats.push(new THREE.MeshToonMaterial({ color: new THREE.Color().setHSL(rnd(), 0.35, 0.5 + rnd() * 0.25), gradientMap: grad }))
  }

  const movers = []
  for (let i = 0; i < COUNT; i++) {
    const m = new THREE.Mesh(geo, mats[i % mats.length])
    m.position.set((rnd() - 0.5) * 90, rnd() * 14, (rnd() - 0.5) * 90)
    m.scale.setScalar(0.6 + rnd() * 1.2)
    m.frustumCulled = false // カリングでコール数が揺れないよう固定＝両方式の条件を厳密に揃える
    if (i % 10 === 0) {
      movers.push(m) // 1割は毎フレーム回転＝行列更新のCPU負荷も再現
    } else {
      m.updateMatrix()
      m.matrixAutoUpdate = false
    }
    scene.add(m)
  }

  const cam = new THREE.PerspectiveCamera(55, 1, 0.1, 400)
  const step = (t) => {
    cam.position.set(Math.cos(t * 0.05) * 55, 20, Math.sin(t * 0.05) * 55)
    cam.lookAt(0, 6, 0)
    for (let i = 0; i < movers.length; i++) {
      const mv = movers[i]
      mv.rotation.y = t + i
      mv.rotation.x = t * 0.7
    }
  }

  return { scene, cam, step, tris: COUNT * 384, calls: COUNT }
}
