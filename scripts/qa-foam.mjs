import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:480,height:760}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
// 東(+x=海)を向いて汀(x≈80)を見下ろす
await p.evaluate(()=>window.__town3dFlyPose(68, 7, 40, 1.57, -0.32)).catch(()=>{}); await p.waitForTimeout(1500)
await p.screenshot({ path:'foam-a.png' }); console.log('a')
// 汀すれすれ・横から（z方向に渚の帯を見る）
await p.evaluate(()=>window.__town3dFlyPose(78, 0.5, 70, 3.0, -0.04)).catch(()=>{}); await p.waitForTimeout(1500)
await p.screenshot({ path:'foam-b.png' }); console.log('b')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
