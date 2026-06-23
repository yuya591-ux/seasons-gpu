import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 2 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')) // 昼=窓がよく見える
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dCruise(false))
await p.evaluate(()=>window.__town3dFlyPose(28,15,-50,Math.PI/2,0.05)); await p.waitForTimeout(1200)
await p.screenshot({ path:'scripts/_shots/windep.png' })
console.log(errs.length?'ERR '+errs.slice(0,3).join(' | '):'no errors')
await b.close()
