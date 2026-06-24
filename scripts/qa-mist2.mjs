import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1.8 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await p.waitForTimeout(2700) // 昼=朝もや向き
await p.evaluate(()=>window.__town3dEvent('mist')); await p.waitForTimeout(14000)
await p.screenshot({ path:'scripts/_shots/ev-mist-window.png' })
// 低空でも
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dFlyPose(-8,12,30,0,-0.06)); await p.waitForTimeout(1500)
await p.screenshot({ path:'scripts/_shots/ev-mist-low.png' })
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
