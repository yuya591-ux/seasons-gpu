import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1.9 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(()=>window.__applyScene('shishigaya-window-3d-autumn')); await p.waitForTimeout(2700)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
// 屋敷を正面〜斜めから（蔵/縁側/井戸/庭が見える角度）
await p.evaluate(()=>window.__town3dFlyPose(-11,9,-9,1.3,-0.42)); await p.waitForTimeout(1200)
await p.screenshot({ path:'scripts/_shots/manor.png' })
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
