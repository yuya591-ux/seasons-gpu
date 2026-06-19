// 着地して歩く動線の確認。商店街上空→着地→歩行、海の上に着地できない（水際で止まる）か。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(900)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1100)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(300)

// 海の上空へ移動して着地を試みる（resolveSpawnが陸へ寄せるはず）
await page.evaluate(() => { window.__town3dCruise(false); window.__town3dFlyPose(90, 12, -36, 0, -0.3) })
await page.waitForTimeout(500)
await page.evaluate(() => window.__town3dLand(true)); await page.waitForTimeout(1600)
let dbg = await page.evaluate(() => window.__town3dDbg && window.__town3dDbg())
console.log('海上で着地→', JSON.stringify(dbg))

// 商店街上空へ戻して着地→歩行
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => { window.__town3dCruise(false); window.__town3dFlyPose(0, 10, -26, 0, -0.2) })
await page.waitForTimeout(500)
await page.evaluate(() => window.__town3dLand(true)); await page.waitForTimeout(1600)
dbg = await page.evaluate(() => window.__town3dDbg && window.__town3dDbg())
console.log('商店街で着地→', JSON.stringify(dbg))
await page.evaluate(() => window.__town3dMove(0, 1)); await page.waitForTimeout(1400)
dbg = await page.evaluate(() => window.__town3dDbg && window.__town3dDbg())
console.log('歩行後→', JSON.stringify(dbg))
await page.evaluate(() => window.__town3dMove(0, 0))
await page.screenshot({ path: 'scripts/_shots/walk-shoten.png' })
await browser.close()
console.log('walkland done')
