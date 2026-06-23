import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
// Edoとtaishoを街区が見える低い斜め俯瞰で
await p.evaluate(()=>window.__town3dFlyPose(640-38,16,-46-10,1.1,-0.28)); await p.waitForTimeout(800)
await p.screenshot({ path:'scripts/_shots/stall-edo.png' })
await p.evaluate(()=>window.__town3dFlyPose(-640+20,14,-30+18,-2.2,-0.25)); await p.waitForTimeout(800)
await p.screenshot({ path:'scripts/_shots/stall-tai.png' })
console.log('done')
await b.close()
