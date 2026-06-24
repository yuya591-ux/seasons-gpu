import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1.6 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
// 戦国の夜（鳥のシーンは無いので night home scene→戦国へ飛ぶ。夜のグローを見る）
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-night')); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dFlyPose(140,18,-585,0,-0.12)); await p.waitForTimeout(1500)
await p.screenshot({ path:'scripts/_shots/sengoku-night.png' })
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
