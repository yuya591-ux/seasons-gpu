import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:480,height:760}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(300)
// 建物の壁に寄って見上げ角で確認（住宅街の建物群）
await p.evaluate(()=>window.__town3dFlyPose(10, 4, -22, Math.PI*1.5, 0.05)).catch(()=>{}); await p.waitForTimeout(1600)
await p.screenshot({ path:'wall-a.png' }); console.log('a')
await p.evaluate(()=>window.__town3dFlyPose(-18, 5, -40, Math.PI*0.5, 0.08)).catch(()=>{}); await p.waitForTimeout(1600)
await p.screenshot({ path:'wall-b.png' }); console.log('b')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
