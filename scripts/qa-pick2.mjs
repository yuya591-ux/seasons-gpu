import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dCruise(false))
await p.evaluate(()=>window.__town3dFlyPose(140,12,-636,0,0)); await p.waitForTimeout(900)
await p.screenshot({ path:'scripts/_shots/pick-street.png' })
// 画像上の四角の位置を狙い撃ち
const pts = [[0.67,0.24],[0.82,0.43],[0.48,0.40],[0.51,0.47],[0.42,0.30],[0.60,0.33],[0.30,0.45],[0.72,0.30]]
const out = await p.evaluate((pts)=>pts.map(([u,v])=>({u,v,hit:window.__town3dPick(u,v)})), pts)
console.log(JSON.stringify(out,null,1))
await b.close()
