import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 1000 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
// 河口側から谷を俯瞰（ユーザー画像に近い）
await p.evaluate(()=>window.__town3dFlyPose(150,55,-560,0,-0.75)); await p.waitForTimeout(1500)
await p.screenshot({ path:'scripts/_shots/senwater-mouth.png' })
await p.evaluate(()=>window.__town3dFlyPose(140,40,-600,0,-0.55)); await p.waitForTimeout(1500)
await p.screenshot({ path:'scripts/_shots/senwater-low.png' })
await b.close()
