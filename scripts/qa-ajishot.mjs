import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const OUT = 'C:\Users\yuya.satake\ClaudeCode\seasons\.qa-shots'
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:600,height:760} })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('shishigaya-window-3d')).catch(()=>{}); await p.waitForTimeout(3000)
// せせらぎ(x≈-9.5, z 5→-44)を斜め上から見下ろす
await p.evaluate(()=>window.__town3dShotAt(-4, 6, 2, -10, 1.5, -16, 52)).catch(()=>{}); await p.waitForTimeout(500)
await p.screenshot({ path: `${OUT}\aji-yato.png` }); console.log('shot aji-yato')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
