import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:430,height:840}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(300)
// 住宅街・公園際・駅前・川沿いの路地に降り、歩行目線(一人称寄り)で近景を見る
const spots=[['g1',6,8],['g2',16,-20],['g3',-8,-30],['g4',30,-10]]
for(const [tag,x,z] of spots){
  await p.evaluate(([x,z])=>window.__town3dFlyPose(x,7,z,Math.random()*6,-0.04),[x,z]).catch(()=>{}); await p.waitForTimeout(500)
  await p.evaluate(()=>window.__town3dLand && window.__town3dLand(true)).catch(()=>{}); await p.waitForTimeout(2400)
  await p.screenshot({ path:`grd-${tag}.png` }); console.log(tag)
  await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
}
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
