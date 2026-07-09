import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:430,height:850}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
// 江戸の真上で低くホバリング（walker群が毎フレーム動く＝以前の throw 条件）
for(const [x,z] of [[640,-46],[140,-640],[-636,-30]]){
  await p.evaluate(([x,z])=>window.__town3dFlyPose(x,16,z,0,-0.1),[x,z]).catch(()=>{})
  await p.waitForTimeout(2500) // フライ継続のまま walker を動かし続ける
  // 着地もして walk 中の更新も通す
  await p.evaluate(()=>window.__town3dLand && window.__town3dLand(true)).catch(()=>{}); await p.waitForTimeout(1800)
  await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
}
console.log(errs.length?('ERR x'+errs.length+': '+errs.slice(0,2).join(' | ')):'no err (walker fix OK)')
await b.close()
