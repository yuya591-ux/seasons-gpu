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
await p.evaluate(()=>window.__town3dFlyPose(148,12,-636,-0.7,0.05)); await p.waitForTimeout(900)
const pts=[[0.40,0.08],[0.44,0.06],[0.66,0.15],[0.70,0.13]]
const out = await p.evaluate((pts)=>pts.map(([u,v])=>({u,v,hit:window.__town3dPick(u,v)})), pts)
console.log(JSON.stringify(out))
await b.close()
