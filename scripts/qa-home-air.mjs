// home(現代の街・出発地)と谷戸を上空から点検。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
p.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2400)
await p.evaluate(() => { window.__town3dFly(true) }); await p.waitForTimeout(700)
await p.evaluate(() => window.__town3dFlyPose(0, 60, 10, Math.PI, -0.5)); await p.waitForTimeout(800)
await p.screenshot({ path: 'scripts/_shots/home-air.png' })
await p.evaluate(() => window.__town3dFlyPose(20, 36, -30, Math.PI * 1.1, -0.2)); await p.waitForTimeout(800)
await p.screenshot({ path: 'scripts/_shots/home-mid.png' })
await b.close()
