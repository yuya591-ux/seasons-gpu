import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 540 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m)=>{ if(m.type()==='error') errs.push(m.text()) })
await p.goto('http://localhost:4801/seasons/?dev=1', { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2400)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
// 江戸の東の汀を島の方(-x)へ見る
await p.evaluate(()=>window.__town3dFlyPose(792, 14, -46, -Math.PI/2, -0.04)); await p.waitForTimeout(1300)
await p.screenshot({ path: 'scripts/_shots/shore-edo.png' })
// 大正の東の汀を島の方(-x)へ見る
await p.evaluate(()=>window.__town3dFlyPose(-500, 14, -30, -Math.PI/2, -0.04)); await p.waitForTimeout(1100)
await p.screenshot({ path: 'scripts/_shots/shore-taisho.png' })
console.log(errs.length ? 'ERR '+errs.slice(0,3).join(' | ') : 'no errors')
await b.close()
