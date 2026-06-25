import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4898
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1000, height: 520 } })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(600)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(300)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
let gy = await page.evaluate(() => window.__town3dGroundAt(31, -22))
// 駅前一帯を歩行目線で（夕＋ブルーム＋緑＋人）
await page.evaluate(([gy]) => window.__town3dFlyPose(31, gy+4, -14, 0, -0.12), [gy])
await page.waitForTimeout(2400)
await page.screenshot({ path: 'scripts/_shots/showcase_dusk.png' })
console.log('done')
await browser.close()
