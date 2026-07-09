import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:430,height:850}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
// 谷戸(夏) せせらぎ際に降りる
await p.evaluate(()=>window.__applyScene('shishigaya-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
await p.evaluate(()=>window.__town3dFlyPose(-8, 10, -8, 0.2, -0.12)).catch(()=>{}); await p.waitForTimeout(500)
await p.evaluate(()=>window.__town3dLand && window.__town3dLand(true)).catch(()=>{}); await p.waitForTimeout(2200)
await p.screenshot({ path: 'insp3-yato.png' }); console.log('shot yato')
// 江戸(home内の島) 地上
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
await p.evaluate(()=>window.__town3dFlyPose(640, 14, -46, 0.0, -0.08)).catch(()=>{}); await p.waitForTimeout(500)
await p.evaluate(()=>window.__town3dLand && window.__town3dLand(true)).catch(()=>{}); await p.waitForTimeout(2200)
await p.screenshot({ path: 'insp3-edo.png' }); console.log('shot edo')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
