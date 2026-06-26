import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:430,height:850}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
const errs=[]; p.on('pageerror',e=>errs.push(e.stack||e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
await p.evaluate(()=>window.__town3dFlyPose(628,24,-46,0,-0.06)).catch(()=>{}); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dLand && window.__town3dLand(true)).catch(()=>{}); await p.waitForTimeout(2600)
console.log('=== errors ===')
console.log(errs.length?errs.slice(0,2).join('\n---\n'):'no err')
await b.close()
