// 展望塔の確認。遠望の全身／展望台に並んで／塔の上から街を見おろす。
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

// 遠望（塔 -7,-48 の全身を斜め前から）
await page.evaluate(() => window.__town3dFlyPose(8, 16, -28, -0.45, -0.12))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/tower-0-far.png' })

// 展望台の高さに並んで（塔の上部・展望室・屋根）
await page.evaluate(() => window.__town3dFlyPose(4, 26, -44, -1.4, -0.05))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/tower-1-deck.png' })

// 塔の天辺ごしに街を見おろす（高い目的地からの眺め）
await page.evaluate(() => window.__town3dFlyPose(-7, 34, -40, 3.0, -0.6))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/tower-2-top.png' })

await browser.close()
console.log('tower shots done')
