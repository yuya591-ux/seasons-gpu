// 道中の小島の鳥が、飛んで近づくと一斉に舞い立つか確認（東の島 150,-20）。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2400)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(700)
await page.evaluate(() => { window.__town3dCruise(false) })
// 島の手前で停止して見る（d<34で鳥が飛び立つ）
await page.evaluate(() => window.__town3dFlyPose(122, 13, -20, Math.PI / 2, -0.16)); await page.waitForTimeout(400)
await page.screenshot({ path: 'scripts/_shots/island-0.png' }) // 飛び立つ直前/直後
await page.waitForTimeout(900)
await page.screenshot({ path: 'scripts/_shots/island-1.png' }) // 舞い立つ
await page.waitForTimeout(1100)
await page.screenshot({ path: 'scripts/_shots/island-2.png' }) // 去っていく
console.log('island shots done')
await browser.close()
