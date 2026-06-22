import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 600, height: 280 }, deviceScaleFactor: 2 })
await p.goto('http://localhost:4801/seasons/?dev=1', { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2600)
await p.screenshot({ path: 'scripts/_shots/fallfix-window.png' }) // 窓辺＝滝が出ていないはず
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
await p.evaluate(()=>window.__town3dFlyPose(110, 100, -200, -1.5708, -0.18)); await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/fallfix-high.png' }) // 高所＝滝が見えるはず
await b.close()
