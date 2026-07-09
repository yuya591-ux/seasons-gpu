// 近景の路傍（生垣・鉢・マンホール等）を見下ろして確認する汎用ショット。SCENE/YAW/PITCH可変。
import { chromium } from 'playwright'
const port = process.env.PORT || '4855'
const id = process.env.SCENE || 'kitaterao-window-3d'
const yaw = parseFloat(process.env.YAW || '0.5')
const pitch = parseFloat(process.env.PITCH || '-0.75')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
await page.waitForTimeout(2200)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__town3dLean && window.__town3dLean(true))
await page.waitForTimeout(2000)
await page.evaluate(([y, p]) => window.__town3dSetView && window.__town3dSetView(y, p), [yaw, pitch])
await page.waitForTimeout(900)
await page.screenshot({ path: `scripts/_shots/down-${id}.png` })
console.log('down', id, yaw, pitch)
await browser.close()
