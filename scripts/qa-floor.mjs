import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:480,height:760}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(300)
// 足元の地面を見下ろす（草地・道）
await p.evaluate(()=>window.__town3dFlyPose(6, 3, 0, Math.PI, -0.55)).catch(()=>{}); await p.waitForTimeout(1600)
await p.screenshot({ path:'floor-grass.png' }); console.log('grass')
await p.evaluate(()=>window.__town3dFlyPose(3, 3, -10, 0, -0.6)).catch(()=>{}); await p.waitForTimeout(1600)
await p.screenshot({ path:'floor-road.png' }); console.log('road')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
