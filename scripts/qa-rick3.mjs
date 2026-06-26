import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:560,height:520}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
await p.evaluate(()=>window.__town3dFlyPose(-633, 4, -8, 0, 0)).catch(()=>{}); await p.waitForTimeout(800)
// 自由カメラで人力車(-633,?,-8)を間近に見る（側面）
await p.evaluate(()=>window.__town3dShotAt(-629, 1.1, -8, -633, 0.7, -8, 42)).catch(()=>{}); await p.waitForTimeout(500)
await p.screenshot({ path:'rick3-a.png' }); console.log('a')
// 斜め前から
await p.evaluate(()=>window.__town3dShotAt(-630.5, 1.6, -4.8, -633, 0.8, -8, 46)).catch(()=>{}); await p.waitForTimeout(500)
await p.screenshot({ path:'rick3-b.png' }); console.log('b')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
