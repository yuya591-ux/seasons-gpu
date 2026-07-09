import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 540 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m)=>{ if(m.type()==='error') errs.push(m.text()) })
await p.goto('http://localhost:4801/seasons-gpu/?dev=1', { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-night'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
// 江戸の西の参道（提灯の列）を低空で見る
await p.evaluate(()=>window.__town3dFlyPose(548, 12, -46, Math.PI/2, -0.02)); await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/sando-night.png' })
console.log(errs.length ? 'ERR '+errs.slice(0,3).join(' | ') : 'no errors')
await b.close()
