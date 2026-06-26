import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:540,height:600}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(300)
// 人力車: (-633,-8),(-622,-18). 北(-z)を向いて見る
await p.evaluate(()=>window.__town3dFlyPose(-633, 2.6, 2, 0, -0.08)).catch(()=>{}); await p.waitForTimeout(1500)
await p.screenshot({ path:'rick-a.png' }); console.log('a')
await p.evaluate(()=>window.__town3dFlyPose(-618, 2.6, -8, Math.PI*0.5, -0.06)).catch(()=>{}); await p.waitForTimeout(1500)
await p.screenshot({ path:'rick-b.png' }); console.log('b')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
