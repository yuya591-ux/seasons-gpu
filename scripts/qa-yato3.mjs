import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1.9 })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(()=>window.__applyScene('shishigaya-window-3d-autumn')); await p.waitForTimeout(2700)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
// 柿の木(-13,-15)を地上目線で
await p.evaluate(()=>window.__town3dFlyPose(-13,3,-6,0,-0.02)); await p.waitForTimeout(1200)
await p.screenshot({ path:'scripts/_shots/yato-kaki.png' })
// 竹林(東 18,-22)を地上目線で
await p.evaluate(()=>window.__town3dFlyPose(10,3,-20,1.4,-0.02)); await p.waitForTimeout(1200)
await p.screenshot({ path:'scripts/_shots/yato-bamboo.png' })
await b.close()
