import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 880, height: 600 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset')); await p.waitForTimeout(2700)
// 左壁を見る（左へ振る）
await p.evaluate(()=>{ for(let i=0;i<13;i++) window.__town3dLook(-26,0) }); await p.waitForTimeout(900)
await p.screenshot({ path:'scripts/_shots/leftwall.png' })
await b.close()
