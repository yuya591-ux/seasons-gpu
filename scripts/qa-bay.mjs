// 海・港の確認。海上から岸を見る／防波堤と灯台／汀(街と海の境)。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1200)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise(false))
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 海上空から岸（街）を見おろす（湾の水面・防波堤・街並み）
await page.evaluate(() => { window.__town3dZoom(1.2); window.__town3dFlyPose(96, 14, -30, -1.4, -0.34) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/bay-0-frombay.png' })

// 海岸の全景（丘→汀→湾→防波堤→灯台→沖を斜めに見通す）
await page.evaluate(() => { window.__town3dZoom(1.3); window.__town3dFlyPose(70, 30, -30, 1.05, -0.52) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/bay-1-lighthouse.png' })

// 水面を見おろす（青い海面・小舟・防波堤）
await page.evaluate(() => { window.__town3dZoom(1.0); window.__town3dFlyPose(88, 10, -34, 0.2, -0.7) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/bay-2-shore.png' })

await browser.close()
console.log('bay shots done')
