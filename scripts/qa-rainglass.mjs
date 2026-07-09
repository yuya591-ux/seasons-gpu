import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 880, height: 600 }, deviceScaleFactor: 2 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-rain')); await p.waitForTimeout(3000)
await p.screenshot({ path:'scripts/_shots/rainglass-1.png' })
// 夜の雨も
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-rain-night')); await p.waitForTimeout(3000)
await p.screenshot({ path:'scripts/_shots/rainglass-2.png' })
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
