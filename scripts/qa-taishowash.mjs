import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 920, height: 600 }, deviceScaleFactor: 1.7 })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dFlyPose(-640,55,40,0,-0.42)); await p.waitForTimeout(1200)
await p.screenshot({ path:'scripts/_shots/taishowash-air.png' })
// 運河を上から
await p.evaluate(()=>window.__town3dFlyPose(-655,30,-13,1.45,-0.6)); await p.waitForTimeout(1100)
await p.screenshot({ path:'scripts/_shots/taishowash-canal.png' })
await b.close()
