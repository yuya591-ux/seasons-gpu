import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 3 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await p.waitForTimeout(2600)
await p.waitForTimeout(5500)
console.log('眺め時:', (await p.evaluate(()=>window.__town3dStats())).pr)
// 実ポインタで触れる（onDown/onMove→lastInputT更新→復帰）
await p.mouse.move(400,300); await p.mouse.down(); await p.mouse.move(430,310); await p.mouse.move(450,320); await p.mouse.up()
await p.waitForTimeout(700)
console.log('操作復帰:', (await p.evaluate(()=>window.__town3dStats())).pr)
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
