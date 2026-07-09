import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 620 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dCruise(false))
// 地形高+目線で立つ正しいアングル
const spots = [
  ['eye-a', 146, -648, -0.5, 0.0],
  ['eye-b', 150, -652, 0.4, 0.0],
  ['eye-c', 138, -644, 1.8, 0.0],
  ['eye-d', 144, -640, 3.0, 0.0],
]
for (const [name,x,z,yaw,pit] of spots){
  const y = await p.evaluate(([x,z])=>window.__town3dHeights(x,z).heightAt + 2.4, [x,z])
  await p.evaluate(([x,y,z,yaw,pit])=>window.__town3dFlyPose(x,y,z,yaw,pit),[x,y,z,yaw,pit]); await p.waitForTimeout(800)
  await p.screenshot({ path:`scripts/_shots/coh-sen-${name}.png` })
}
console.log('done')
await b.close()
