import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1.8 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-night')); await p.waitForTimeout(2800)
await p.screenshot({ path:'scripts/_shots/night-window.png' }) // 窓辺(デフォルト)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dFlyPose(-10,42,40,0,-0.32)); await p.waitForTimeout(1200)
await p.screenshot({ path:'scripts/_shots/night-air.png' }) // 俯瞰
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
