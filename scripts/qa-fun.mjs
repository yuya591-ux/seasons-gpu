// 遊園地の確認。観覧車＋ゲート＋回転木馬の全景／ゲートと回転木馬に寄る。
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

// 遊園地(FUN -26,-66)の全景を手前(街側)斜め上から
await page.evaluate(() => window.__town3dFlyPose(-26, 14, -48, 0, -0.32))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/fun-0-far.png' })

// ゲートと回転木馬に寄る（観覧車の手前から）
await page.evaluate(() => { window.__town3dZoom(0.8); window.__town3dFlyPose(-12, 7, -52, -0.67, -0.16) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/fun-1-gate.png' })

await browser.close()
console.log('fun shots done')
