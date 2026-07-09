import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1.8 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
// 商店街(0,-28)地上目線
await p.evaluate(()=>window.__town3dFlyPose(0,4,-40,0,-0.02)); await p.waitForTimeout(1200)
await p.screenshot({ path:'scripts/_shots/signs-day.png' })
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
