import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1.6 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
// 運河際(z=tz+17=-13)を低空で見る
await p.evaluate(()=>window.__town3dFlyPose(-664,5.5,-13,1.45,-0.06)); await p.waitForTimeout(1200)
await p.screenshot({ path:'scripts/_shots/canal-ground.png' })
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
