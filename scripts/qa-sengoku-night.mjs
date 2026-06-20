// 夜の戦国（ユーザーが「怖い」と感じた情景）を新しい谷の城下町で確認。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-night'))
await page.waitForTimeout(2600)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(700)
await page.evaluate(() => { window.__town3dCruise(false) })
const shoot = async (x, z, y, pit, yaw, name) => { await page.evaluate(([x, y, z, p, ya]) => window.__town3dFlyPose(x, y, z, ya, p), [x, y, z, pit, yaw]); await page.waitForTimeout(800); await page.screenshot({ path: `scripts/_shots/${name}.png` }) }
await shoot(120, -360, 46, -0.06, 0, 'sengoku-night-mid')
await shoot(120, -430, 40, -0.12, 0, 'sengoku-night-near')
await browser.close()
