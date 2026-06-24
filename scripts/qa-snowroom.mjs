import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 880, height: 600 }, deviceScaleFactor: 1.9 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-snow')); await p.waitForTimeout(3200)
await p.screenshot({ path:'scripts/_shots/snowroom-1.png' })
// 室内を見回して床に雪が無いか
await p.evaluate(()=>{ for(let i=0;i<13;i++) window.__town3dLook(26,0); for(let i=0;i<5;i++) window.__town3dLook(0,-22) }); await p.waitForTimeout(900)
await p.screenshot({ path:'scripts/_shots/snowroom-2.png' })
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
