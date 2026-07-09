import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:540,height:600}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(3000)
// 神社(-32,-18)に飛んで寄って見た目を確認（鳥居の朱・基壇・石段）
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(300)
await p.evaluate(()=>window.__town3dFlyPose(-32,7,-4,Math.PI,-0.06)).catch(()=>{}); await p.waitForTimeout(1700)
await p.screenshot({ path:'shrine.png' }); console.log('shot')
const histo = await p.evaluate(()=>window.__town3dMeshHisto && window.__town3dMeshHisto())
const sh = histo && histo.topChildren && histo.topChildren.find(c=>c.x===-32 && c.z===-18)
console.log('shrine meshes now:', sh ? sh.n : '(not in top18 — likely reduced)')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
