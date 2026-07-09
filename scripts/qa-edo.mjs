import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1.6 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
for (const [tag,x,y,z,yaw,pit] of [['air',640,70,66,0,-0.5],['moat',640,12,30,0,-0.18]]) {
  await p.evaluate(([x,y,z,yaw,pit])=>window.__town3dFlyPose(x,y,z,yaw,pit), [x,y,z,yaw,pit])
  await p.waitForTimeout(1200)
  await p.screenshot({ path:`scripts/_shots/edo2-${tag}.png` })
  console.log(tag, 'draw:', JSON.stringify(await p.evaluate(()=>window.__town3dDraw&&window.__town3dDraw().calls)))
}
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
