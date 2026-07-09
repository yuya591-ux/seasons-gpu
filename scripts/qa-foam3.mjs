import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:600,height:600}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
// 汀(x≈80,z=40)を斜め上から見下ろす
await p.evaluate(()=>window.__town3dFlyPose(74, 11, 40, 1.57, -0.85)).catch(()=>{}); await p.waitForTimeout(1600)
await p.screenshot({ path:'foam3-a.png' }); console.log('a')
// foam の在処を診断: town配下で渚らしいメッシュの個数（x≈80帯の三角数）を概算は不可なので、代わりに draw 情報
const d = await p.evaluate(()=>window.__town3dDraw ? window.__town3dDraw() : null)
console.log('draw', JSON.stringify(d))
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
