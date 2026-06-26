import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:430,height:850}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
// home(夏)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
const spots = [
  ['river', -50, -6, 0.4],   // 川辺(新・紫陽花)
  ['park', 14, -22, 1.4],    // 公園
  ['street', 6, 6, 3.1],     // 住宅街の路地
  ['canal', -636, -8, 1.2],  // 大正運河(新・紫陽花)
]
for (const [tag,x,z,yaw] of spots){
  await p.evaluate(([x,z,y])=>window.__town3dFlyPose(x,16,z,y,-0.08),[x,z,yaw]).catch(()=>{}); await p.waitForTimeout(500)
  await p.evaluate(()=>window.__town3dLand && window.__town3dLand(true)).catch(()=>{}); await p.waitForTimeout(2200)
  await p.screenshot({ path: `insp-${tag}.png` }); console.log('shot '+tag)
  await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
}
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
