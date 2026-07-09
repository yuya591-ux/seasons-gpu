import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 600 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
// 着地相当の歩行目線(地形高+1.65)。各エリア3カット。
const shots = [
  ['home-a', 2, -22, 0.1, 0.0], ['home-b', 8, -34, 1.4, 0.0], ['home-c', -10, -16, -1.3, 0.02],
  ['edo-a', 632, -46, 1.4, 0.0], ['edo-b', 648, -60, 0.3, 0.02], ['edo-c', 640, -30, 3.0, 0.0],
  ['sen-a', 144, -646, -0.4, 0.0], ['sen-b', 150, -652, 1.5, 0.0], ['sen-c', 138, -642, 2.6, 0.0],
  ['tai-a', -636, -34, -1.5, 0.0], ['tai-b', -622, -52, 0.3, 0.0], ['tai-c', -640, -28, 1.7, 0.02],
]
for (const [name,x,z,yaw,pit] of shots){
  const y = await p.evaluate(([x,z])=>window.__town3dHeights(x,z).heightAt + 1.65, [x,z])
  await p.evaluate(([x,y,z,yaw,pit])=>window.__town3dFlyPose(x,y,z,yaw,pit),[x,y,z,yaw,pit]); await p.waitForTimeout(700)
  await p.screenshot({ path:`scripts/_shots/walk-${name}.png` })
}
console.log('done')
await b.close()
