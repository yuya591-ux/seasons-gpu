import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1.6 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
// もや（夕）：飛んで自分の周りに発生
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset')); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dFlyPose(-8,30,30,0,-0.12)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dEvent('mist')); await p.waitForTimeout(13000) // 立ち上がり後
await p.screenshot({ path:'scripts/_shots/ev-mist.png' })
// 花火大会（夜）
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-night')); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(500)
await p.evaluate(()=>window.__town3dFlyPose(-8,32,34,0,-0.15)); await p.waitForTimeout(500)
await p.evaluate(()=>window.__town3dEvent('fireworksFinale')); await p.waitForTimeout(2200)
await p.screenshot({ path:'scripts/_shots/ev-fwfinale.png' })
console.log(errs.length?'ERR '+errs.slice(0,3):'no errors')
await b.close()
