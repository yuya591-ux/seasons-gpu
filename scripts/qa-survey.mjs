import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 2 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())})
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dCruise(false))
// 各エリア: 俯瞰(全景)＋目線(散歩視点)
const areas = [['edo',640,-46],['sengoku',140,-640],['taisho',-640,-30],['home',0,-40]]
for (const [name,x,z] of areas) {
  await p.evaluate(([x,z])=>window.__town3dFlyPose(x,55,z+95,0.0,-0.42),[x,z]); await p.waitForTimeout(1100)
  await p.screenshot({ path:`scripts/_shots/survey-${name}-air.png` })
  await p.evaluate(([x,z])=>window.__town3dFlyPose(x,16,z+30,0.0,-0.05),[x,z]); await p.waitForTimeout(900)
  await p.screenshot({ path:`scripts/_shots/survey-${name}-eye.png` })
}
console.log(errs.length?'ERR '+errs.slice(0,3).join(' | '):'no errors')
await b.close()
