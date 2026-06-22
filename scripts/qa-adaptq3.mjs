import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(500)
await p.evaluate(() => window.__town3dCruise(true))
const log=[]
for (let i=0;i<8;i++){ await p.evaluate(() => window.__town3dSteer(0.04,0)); await p.waitForTimeout(1200); const s=await p.evaluate(()=>window.__town3dStats()); log.push(`pr${s.pr} ddt${s.ddt} low${s.low} ok${s.ok}`) }
console.log(log.join('\n'))
await b.close()
