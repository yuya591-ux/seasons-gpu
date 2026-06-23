import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 620 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
const shots = [
  ['edo-st',  640-30, -46, 1.4, 0.0, 1.9],
  ['edo-st2', 640-10, -70, 0.5, 0.0, 1.9],
  ['edo-comp',640-66, -30, 1.0, -0.05, 6.0],
  ['tai-st',  -640+20, -30, -1.6, 0.0, 1.9],
  ['tai-st2', -620, -50, 0.3, 0.0, 1.9],
  ['tai-comp',-640, -64, 0.0, -0.04, 7.0],
]
for (const [name,x,z,yaw,pit,eye] of shots){
  const y = await p.evaluate(([x,z,eye])=>window.__town3dHeights(x,z).heightAt + eye, [x,z,eye])
  await p.evaluate(([x,y,z,yaw,pit])=>window.__town3dFlyPose(x,y,z,yaw,pit),[x,y,z,yaw,pit]); await p.waitForTimeout(800)
  await p.screenshot({ path:`scripts/_shots/eraeval-${name}.png` })
}
console.log('done')
await b.close()
