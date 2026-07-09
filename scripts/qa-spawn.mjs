import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 920, height: 600 }, deviceScaleFactor: 1.8 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('shishigaya-window-3d')); await p.waitForTimeout(2700)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
// 屋敷の真ん前(0,-8)へ低空→着地（以前はめり込んだ）
await p.evaluate(()=>window.__town3dFlyPose(0,6,-8,0,-0.04)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dLand(true)); await p.waitForTimeout(4200)
await p.screenshot({ path:'scripts/_shots/spawn-yato.png' })
console.log('state:', JSON.stringify(await p.evaluate(()=>window.__town3dJumpState&&window.__town3dJumpState())))
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
