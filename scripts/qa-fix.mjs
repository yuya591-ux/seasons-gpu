import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1.7 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
// 夜の雲
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-night')); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dFlyPose(-10,46,42,0,-0.34)); await p.waitForTimeout(1100)
await p.screenshot({ path:'scripts/_shots/fix-night-clouds.png' })
// 夕の雲
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset')); await p.waitForTimeout(2400)
await p.evaluate(()=>window.__town3dFlyPose(-10,46,42,0,-0.34)); await p.waitForTimeout(1100)
await p.screenshot({ path:'scripts/_shots/fix-sunset-clouds.png' })
// 谷戸の靄（秋）：窓＋俯瞰
await p.evaluate(()=>window.__applyScene('shishigaya-window-3d-autumn')); await p.waitForTimeout(2600)
await p.screenshot({ path:'scripts/_shots/fix-yato-window.png' })
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(500)
await p.evaluate(()=>window.__town3dFlyPose(2,18,18,0,-0.3)); await p.waitForTimeout(1100)
await p.screenshot({ path:'scripts/_shots/fix-yato-air.png' })
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
