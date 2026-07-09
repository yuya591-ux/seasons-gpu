import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1.8 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
for (const [scene,tag] of [['shishigaya-window-3d-autumn','autumn'],['shishigaya-window-3d','summer']]) {
  await p.evaluate(s=>window.__applyScene(s), scene); await p.waitForTimeout(2700)
  await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
  await p.evaluate(()=>window.__town3dFlyPose(2,18,18,0,-0.28)); await p.waitForTimeout(1200)
  await p.screenshot({ path:`scripts/_shots/yato2-${tag}.png` })
}
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
