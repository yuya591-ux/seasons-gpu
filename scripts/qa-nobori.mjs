import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:480,height:720}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(300)
// 戦国近くでホバリングしてアンカリング
await p.evaluate(()=>window.__town3dFlyPose(146,28,-600,Math.PI,-0.2)).catch(()=>{}); await p.waitForTimeout(3200)
// 街道(x≈146, z-619..-689)を南へ見下ろす
await p.evaluate(()=>window.__town3dFlyPose(146,9,-605,0,-0.14)).catch(()=>{}); await p.waitForTimeout(1600)
await p.screenshot({ path:'nobori-a.png' }); console.log('a')
await p.evaluate(()=>window.__town3dFlyPose(150,7,-640,-1.4,-0.06)).catch(()=>{}); await p.waitForTimeout(1500)
await p.screenshot({ path:'nobori-b.png' }); console.log('b')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
