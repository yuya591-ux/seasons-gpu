// 磯・岩場＋海鳥の確認。岩礁・白波・かもめが海辺にあるか。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1000)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1300)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise(false))
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 磯（南の海岸 z-14..-33、x76前後）を斜め上から
await page.evaluate(() => { window.__town3dZoom(1.1); window.__town3dFlyPose(86, 12, -24, -1.4, -0.4) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/iso-0.png' })

// 海鳥を狙って湾の上空
await page.evaluate(() => { window.__town3dZoom(1.3); window.__town3dFlyPose(92, 22, -42, -1.4, -0.2) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/iso-1-gulls.png' })

await browser.close()
console.log('iso shots done')
