import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4877
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 800 } })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1&fest=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(400)
const save = (name, durl) => { writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64')) }
// 改善した簡易peepを開けた道(0,-25 residentSpot)へ3体ピン→真横やや見下ろしで接写
for (let k = 0; k < 3; k++) await page.evaluate((k) => window.__town3dPeepPin(k, -1.4 + k * 1.4, -25, Math.PI * 0.7), k)
await page.waitForTimeout(700)
let gy = await page.evaluate(() => window.__town3dGroundAt(0, -25))
let d1 = await page.evaluate(([gy]) => window.__town3dShotAt(3.6, gy + 1.1, -21.5, 0, gy + 0.78, -25, 24), [gy]); save('cu_peep', d1); console.log('cu_peep gy', gy.toFixed(2))
// 盆踊り(0,6)を斜め前から
gy = await page.evaluate(() => window.__town3dGroundAt(0, 6))
let d2 = await page.evaluate(([gy]) => window.__town3dShotAt(7.5, gy + 2.6, 13.5, 0, gy + 1.6, 6, 40), [gy]); save('cu_bonodori', d2); console.log('cu_bonodori gy', gy.toFixed(2))
// やまゆりサマフェス(36,-37)の見物客を客席側(+z)から
gy = await page.evaluate(() => window.__town3dGroundAt(36, -32))
let d3 = await page.evaluate(([gy]) => window.__town3dShotAt(36, gy + 2.0, -24, 36, gy + 1.2, -37, 40), [gy]); save('cu_summerfes', d3); console.log('cu_summerfes gy', gy.toFixed(2))
await browser.close()
