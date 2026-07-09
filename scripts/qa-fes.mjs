import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4877
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 560, height: 620 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1&fest=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(300)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// 学校の校庭の盆踊り(54,-18 平坦)を斜め上から
let gy = await page.evaluate(() => window.__town3dGroundAt(54, -14))
save('fes_school', await page.evaluate(([gy]) => window.__town3dShotAt(54, gy + 7, 2, 54, gy + 2, -14, 40), [gy])); console.log('school gy', gy.toFixed(2))
// 目の前広場の盆踊り(0,6)
gy = await page.evaluate(() => window.__town3dGroundAt(0, 6))
save('fes_plaza2', await page.evaluate(([gy]) => window.__town3dShotAt(0, gy + 8, 22, 0, gy + 2.5, 6, 36), [gy])); console.log('plaza gy', gy.toFixed(2))
// やまゆりサマフェス(36,-37)
gy = await page.evaluate(() => window.__town3dGroundAt(36, -30))
save('fes_yama', await page.evaluate(([gy]) => window.__town3dShotAt(36, gy + 6, -18, 36, gy + 2, -36, 42), [gy])); console.log('yama gy', gy.toFixed(2))
await browser.close()
