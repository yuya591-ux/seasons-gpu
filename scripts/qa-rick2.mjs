import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:600,height:520}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(300)
// 人力車 (-633,-8) を南から側面に見る（カメラは引き11.5 → flyPos-12でカメラ-0.5付近、北を向く）
await p.evaluate(()=>window.__town3dFlyPose(-633, 1.6, -12, 0, 0.0)).catch(()=>{}); await p.waitForTimeout(1500)
await p.screenshot({ path:'rick2-a.png' }); console.log('a')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
