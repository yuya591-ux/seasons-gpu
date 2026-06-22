import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 540 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m)=>{ if(m.type()==='error') errs.push(m.text()) })
await p.goto('http://localhost:4801/seasons/?dev=1', { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-night'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
// 大正の運河沿いのガス灯を低空で（運河はz=tz+17=-13、港町中心 -640,-30）
await p.evaluate(()=>window.__town3dFlyPose(-560, 14, -13, -Math.PI/2, -0.05)); await p.waitForTimeout(1300)
await p.screenshot({ path: 'scripts/_shots/taisho-night.png' })
console.log(errs.length ? 'ERR '+errs.slice(0,3).join(' | ') : 'no errors')
await b.close()
