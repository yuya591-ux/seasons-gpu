import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:520,height:600}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(3000)
const attr = await p.evaluate(()=>window.__town3dAttribute && window.__town3dAttribute())
console.log('window base calls now:', attr && attr.base, '| ferris-area attr:', attr && attr.ferris)
// 観覧車を間近に撮って見た目が同一か確認（飛行で寄る）
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(300)
await p.evaluate(()=>window.__town3dFlyPose(-26,16,-40,0,-0.05)).catch(()=>{}); await p.waitForTimeout(1600)
await p.screenshot({ path:'ferris.png' }); console.log('shot')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
