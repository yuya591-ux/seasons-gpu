import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:560,height:620}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
// 渚の小物の近く(x≈77)を、汀に沿って(z方向)低く見る
await p.evaluate(()=>window.__town3dFlyPose(74, 2.5, 30, Math.PI*0.05, -0.12)).catch(()=>{}); await p.waitForTimeout(1700)
await p.screenshot({ path:'drift-a.png' }); console.log('a')
await p.evaluate(()=>window.__town3dFlyPose(75, 2, -6, Math.PI*0.95, -0.1)).catch(()=>{}); await p.waitForTimeout(1700)
await p.screenshot({ path:'drift-b.png' }); console.log('b')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
