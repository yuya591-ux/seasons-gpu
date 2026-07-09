import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:520,height:640}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(300)
for(const [tag,x,z,yaw] of [['a',-20,-30,0],['b',6,8,Math.PI]]){
  await p.evaluate(([x,z,y])=>window.__town3dFlyPose(x,4,z,y,0.06),[x,z,yaw]).catch(()=>{}); await p.waitForTimeout(1600)
  await p.screenshot({ path:`wall3-${tag}.png` }); console.log(tag)
}
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
