import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 540 }, deviceScaleFactor: 1.7 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
for (const [scene,tag] of [['shishigaya-window-3d-spring','spring'],['shishigaya-window-3d-snow','snow']]) {
  await p.evaluate(s=>window.__applyScene(s), scene); await p.waitForTimeout(2700)
  await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
  await p.evaluate(()=>window.__town3dFlyPose(2,16,16,0,-0.3)); await p.waitForTimeout(1100)
  await p.screenshot({ path:`scripts/_shots/yatos-${tag}.png` })
  console.log(tag,'draw:', JSON.stringify(await p.evaluate(()=>window.__town3dDraw&&window.__town3dDraw().calls)))
}
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
