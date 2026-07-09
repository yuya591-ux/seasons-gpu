import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 2 })
async function shot(scene, name, pose){
  await p.evaluate((s)=>window.__applyScene(s), scene); await p.waitForTimeout(2600)
  await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
  await p.evaluate(()=>window.__town3dCruise(false))
  await p.evaluate((pose)=>window.__town3dFlyPose(...pose), pose); await p.waitForTimeout(900)
  await p.screenshot({ path:`scripts/_shots/${name}.png` })
}
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await shot('kitaterao-window-3d-night','taiprops-night',[-640+18,14,-30+16,-2.2,-0.22])
await shot('kitaterao-window-3d-sunset','taiprops-day',[-640+18,14,-30+16,-2.2,-0.22])
console.log('done')
await b.close()
