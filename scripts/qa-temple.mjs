import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:520,height:620}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(3000)
const histo = await p.evaluate(()=>window.__town3dMeshHisto && window.__town3dMeshHisto())
const t = histo && histo.topChildren && histo.topChildren.find(c=>c.x===40 && c.z===-74)
console.log('temple meshes now:', t? t.n : '(not in top18)')
// 寺(40,-74)に飛んで五重塔・本堂の見た目を確認
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(300)
await p.evaluate(()=>window.__town3dFlyPose(40,12,-58,Math.PI,-0.06)).catch(()=>{}); await p.waitForTimeout(1700)
await p.screenshot({ path:'temple.png' }); console.log('shot')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
