import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1.7 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
// 江戸の島を海ごと俯瞰（海面の縞を見る）
await p.evaluate(()=>window.__town3dFlyPose(560,80,80,0.5,-0.5)); await p.waitForTimeout(1200)
await p.screenshot({ path:'scripts/_shots/sea-edo.png' })
// 東湾(home)の海も
await p.evaluate(()=>window.__town3dFlyPose(120,55,10,1.2,-0.5)); await p.waitForTimeout(1100)
await p.screenshot({ path:'scripts/_shots/sea-home.png' })
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
