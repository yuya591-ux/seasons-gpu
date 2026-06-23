import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 1000 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
await p.evaluate(()=>window.__town3dFlyPose(140,40,-600,0,-0.55)); await p.waitForTimeout(1200)
// 画像の水色部分を狙う
const pts=[[0.5,0.55],[0.3,0.6],[0.6,0.45],[0.4,0.7],[0.5,0.4],[0.2,0.5]]
const out = await p.evaluate((pts)=>pts.map(([u,v])=>({uv:[u,v],hit:(window.__town3dPick(u,v)||[]).slice(0,2)})), pts)
console.log(JSON.stringify(out))
console.log('SEA', await p.evaluate(()=>window.__town3dHeights(140,-630).SEAlevel))
await b.close()
