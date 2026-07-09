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
for (const [tag,x,z] of [['edo',640,-30],['sengoku',140,-624],['taisho',-640,-20]]) {
  await p.evaluate(([x,z])=>window.__town3dFlyPose(x,9,z,0,-0.05), [x,z]); await p.waitForTimeout(700)
  await p.evaluate(()=>window.__town3dLand(true)); await p.waitForTimeout(4200)
  // 目線で左右を見回して2枚
  await p.screenshot({ path:`scripts/_shots/eye-${tag}-a.png` })
  await p.evaluate(()=>{ for(let i=0;i<10;i++) window.__town3dLook(28,0) }); await p.waitForTimeout(900)
  await p.screenshot({ path:`scripts/_shots/eye-${tag}-b.png` })
  console.log(tag, JSON.stringify(await p.evaluate(()=>window.__town3dJumpState&&window.__town3dJumpState())))
}
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
