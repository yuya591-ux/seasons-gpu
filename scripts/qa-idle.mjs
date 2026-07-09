// 飛行の操作ボタン(とまる/ズーム/速度)の表示＋無操作で消える＋タップで戻るを確認。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2300)
await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(400)
await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(900)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(500)
await page.evaluate(() => { window.__town3dCruise(false); window.__town3dFlyPose(10, 30, 24, -0.4, -0.25) })
await page.waitForTimeout(900)
const opac = () => page.evaluate(() => ({
  cruise: getComputedStyle(document.querySelector('.town3d-cruise')).opacity,
  zoom: getComputedStyle(document.querySelector('.town3d-zoom')).opacity,
  speed: getComputedStyle(document.querySelector('.town3d-speed')).opacity,
  speedBtns: document.querySelectorAll('.town3d-speed__btn').length,
}))
console.log('表示直後:', JSON.stringify(await opac()))
await page.screenshot({ path: 'scripts/_shots/idle-active.png' })
await page.waitForTimeout(4200) // 無操作で消える(3.5s)
console.log('無操作4.2秒後:', JSON.stringify(await opac()))
await page.screenshot({ path: 'scripts/_shots/idle-faded.png' })
await page.mouse.click(220, 450); await page.waitForTimeout(400) // タップで戻る
console.log('タップ後:', JSON.stringify(await opac()))
await browser.close()
