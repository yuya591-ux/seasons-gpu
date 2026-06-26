import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:480,height:820}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
// 渚へ降りる（汀近くを要求）。openYawが海を正面に向けるか
for(const [tag,x,z] of [['b1',77,40],['b2',78,70],['b3',76,10]]){
  await p.evaluate(([x,z])=>window.__town3dFlyPose(x,9,z,0,-0.08),[x,z]).catch(()=>{}); await p.waitForTimeout(500)
  await p.evaluate(()=>window.__town3dLand && window.__town3dLand(true)).catch(()=>{}); await p.waitForTimeout(2400)
  await p.screenshot({ path:`beach-${tag}.png` }); console.log(tag)
  await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
}
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
