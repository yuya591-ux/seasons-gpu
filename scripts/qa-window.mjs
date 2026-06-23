import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(3200)
await p.screenshot({ path:'scripts/_shots/window-view.png' })
// 窓から乗り出した状態（少し外）も
await p.evaluate(()=>window.__town3dFly&&window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dFlyPose&&window.__town3dFlyPose(0,16,2,0,-0.1)); await p.waitForTimeout(900)
await p.screenshot({ path:'scripts/_shots/window-lean.png' })
await b.close()
