import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 3 }) // iPhone相当の3x
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await p.waitForTimeout(2600)
console.log('初期(上限):', JSON.stringify(await p.evaluate(()=>window.__town3dStats&&window.__town3dStats())))
await p.waitForTimeout(5500) // 静止＆無操作>3.5s＝眺めている状態へ
console.log('眺め時(idle DPR↓):', JSON.stringify(await p.evaluate(()=>window.__town3dStats&&window.__town3dStats())))
// 操作で復帰
await p.evaluate(()=>window.__town3dLook&&window.__town3dLook(20,0)); await p.waitForTimeout(900)
console.log('操作復帰:', JSON.stringify(await p.evaluate(()=>window.__town3dStats&&window.__town3dStats())))
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
