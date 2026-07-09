import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4877
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 800 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(300)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// 上空Y=90に並べて空背景で接写。改善した簡易peep×3と住人×1を比較
const Y = 90
await page.evaluate((Y) => { window.__town3dPeepPin(0, -1.4, 0, 2.4, Y); window.__town3dPeepPin(5, 0, 0, 2.4, Y); window.__town3dPeepPin(10, 1.4, 0, 2.4, Y); window.__town3dResPin(0, 3.0, 0, 2.4, Y) }, Y)
await page.waitForTimeout(600)
// カメラを少し手前・同高で。peep群(x -1.4..1.4)＋住人(x3)を収める
let d = await page.evaluate((Y) => window.__town3dShotAt(0.8, Y + 0.1, 4.2, 0.8, Y + 0.0, 0, 30), Y); save('sky_compare', d)
// 簡易peep単体を大きく
d = await page.evaluate((Y) => window.__town3dShotAt(0, Y + 0.1, 2.4, 0, Y + 0.0, 0, 26), Y); save('sky_peep', d)
console.log('done Y', Y)
await browser.close()
