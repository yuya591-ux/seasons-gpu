import { chromium } from 'playwright'
const PORT = process.env.PORT || 4931
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:430,height:850}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
const errs=[]; p.on('pageerror',e=>errs.push(e.stack||e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
const spots=[[-636,-8],[140,-628],[628,-46]]
for(const [x,z] of spots){
  await p.evaluate(([x,z])=>window.__town3dFlyPose(x,24,z,0,-0.06),[x,z]).catch(()=>{}); await p.waitForTimeout(600)
  await p.evaluate(()=>window.__town3dLand && window.__town3dLand(true)).catch(()=>{}); await p.waitForTimeout(2400)
  await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
  if(errs.length) break
}
console.log('=== stack ===')
console.log(errs.length?errs[0]:'no err')
await b.close()
