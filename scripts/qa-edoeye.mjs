import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 920, height: 600 }, deviceScaleFactor: 1.9 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
// 江戸の町家の只中（城の周りの環状の町並み）に低空→着地
await p.evaluate(()=>window.__town3dFlyPose(680,8,-46,1.57,-0.04)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dLand(true)); await p.waitForTimeout(4200)
await p.screenshot({ path:'scripts/_shots/edoeye-1.png' })
await p.evaluate(()=>{ for(let i=0;i<12;i++) window.__town3dLook(28,0) }); await p.waitForTimeout(800)
await p.screenshot({ path:'scripts/_shots/edoeye-2.png' })
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
