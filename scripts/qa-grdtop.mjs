import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4878
const tag = process.argv[2] || 'after'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 760, height: 600 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// 広域を斜め上から（地面のムラ＝草地/土の帯が見えるか）
save(`grdT_${tag}_wide`, await page.evaluate(() => window.__town3dShotAt(20, 34, 30, 0, 0, -28, 55)))
// 公園(16,-27)を低く grazing（開けている）
let gy = await page.evaluate(() => window.__town3dGroundAt(14, -24))
save(`grdT_${tag}_park`, await page.evaluate(([gy]) => window.__town3dShotAt(14, gy+1.7, -10, 14, gy+0.7, -30, 58), [gy]))
// 中央の道沿いの開け(0,-30)
gy = await page.evaluate(() => window.__town3dGroundAt(0, -30))
save(`grdT_${tag}_road`, await page.evaluate(([gy]) => window.__town3dShotAt(6, gy+1.7, -22, 0, gy+0.7, -40, 58), [gy]))
console.log('done', tag)
await browser.close()
