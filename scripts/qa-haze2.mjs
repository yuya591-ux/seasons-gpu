import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:480,height:760}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
// 沖(x=130)から東の水平線を水平に見る（建物に遮られない開けた海）
await p.evaluate(()=>window.__town3dFlyPose(130, 3, 40, 1.57, -0.02)).catch(()=>{}); await p.waitForTimeout(1700)
await p.screenshot({ path:'haze2-a.png' }); console.log('a')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
