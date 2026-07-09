import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 820, height: 640 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset')); await p.waitForTimeout(2700)
// 室内へ正対(約180度)＋床を見下ろす
await p.evaluate(()=>{ for(let i=0;i<13;i++) window.__town3dLook(28,0) }); await p.waitForTimeout(400)
await p.evaluate(()=>{ for(let i=0;i<8;i++) window.__town3dLook(0,-26) }); await p.waitForTimeout(900)
await p.screenshot({ path:'scripts/_shots/shaft-floor.png' })
await b.close()
