import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:480,height:760}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
// 汀すれすれ(x=79)から開けた海(東)を水平に見る
await p.evaluate(()=>window.__town3dFlyPose(79, 0.5, 40, 1.57, 0.0)).catch(()=>{}); await p.waitForTimeout(1700)
await p.screenshot({ path:'haze-a.png' }); console.log('a')
// 少し高い位置から
await p.evaluate(()=>window.__town3dFlyPose(82, 3, 40, 1.57, -0.03)).catch(()=>{}); await p.waitForTimeout(1500)
await p.screenshot({ path:'haze-b.png' }); console.log('b')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
