import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:560,height:620}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
// 朝の home（もやが薄い）で渚を見るため spring(朝) を使う…がhomeは時間帯固定。既定(dusk)で over-water から
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
await p.evaluate(()=>window.__town3dFlyPose(90, 6, 12, -1.5, -0.4)).catch(()=>{}); await p.waitForTimeout(1700)
await p.screenshot({ path:'sand-a.png' }); console.log('a')
await p.evaluate(()=>window.__town3dFlyPose(92, 8, 50, -1.55, -0.5)).catch(()=>{}); await p.waitForTimeout(1700)
await p.screenshot({ path:'sand-b.png' }); console.log('b')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
