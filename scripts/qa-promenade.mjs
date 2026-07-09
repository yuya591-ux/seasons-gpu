// 川辺の遊歩道の確認。遊歩道・手すり・街灯・ベンチ・並木が護岸の上に続くか。
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
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1200)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise(false))
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 遊歩道を上空から見おろす（川沿いに帯が続く。RIVER x=-52、遊歩道 x≈-48）
await page.evaluate(() => { window.__town3dZoom(1.1); window.__town3dFlyPose(-44, 16, -10, -1.2, -0.5) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/promenade-0-above.png' })

// 遊歩道に沿って低く（手すり・街灯・ベンチ・並木）
await page.evaluate(() => { window.__town3dZoom(0.7); window.__town3dFlyPose(-46, 4, 6, 3.14, -0.05) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/promenade-1-along.png' })

await browser.close()
console.log('promenade shots done')
