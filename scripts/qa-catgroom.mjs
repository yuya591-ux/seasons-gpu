// 猫の毛づくろい(groom)＋自発仕草の確認。__town3dCatReact('groom')で発火し、舐める途中を捉える。エラー検知も。
import { chromium } from 'playwright'
const port = process.env.PORT || '5110'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 460, height: 760 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(3000)
// 猫を見下ろす視点へ寄せる
await page.evaluate(() => window.__town3dSetView(0.3, -0.5)); await page.waitForTimeout(900)
await page.evaluate(() => window.__town3dCatReact('groom'))
await page.waitForTimeout(700)  // 顔へ前足を上げ、舐めている途中
await page.screenshot({ path: 'scripts/_shots/catgroom-1.png' }); console.log('groom1 done')
await page.waitForTimeout(900)
await page.screenshot({ path: 'scripts/_shots/catgroom-2.png' }); console.log('groom2 done')
await browser.close()
console.log('check done')
