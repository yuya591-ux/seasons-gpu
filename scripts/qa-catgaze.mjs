// 猫が窓の外を眺める(gaze)確認。__town3dCatReact('gaze')で発火、窓の方へ向き直り頭を上げるか。
import { chromium } from 'playwright'
const port = process.env.PORT || '5116'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 460, height: 760 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(3000)
await page.evaluate(() => window.__town3dSetView(0, -0.12)); await page.waitForTimeout(700) // 窓辺の通常視点
await page.evaluate(() => window.__town3dCatReact('gaze'))
// idle間引き回避にマウスを動かしつつ、向き直り→眺めを数枚
for (let i = 0; i < 5; i++) { for (let k = 0; k < 6; k++) { await page.mouse.move(230 + (k % 2) * 5, 360 + (k % 2) * 5); await page.waitForTimeout(120) }
  if (i === 2) await page.screenshot({ path: 'scripts/_shots/catgaze-mid.png' })
  if (i === 4) await page.screenshot({ path: 'scripts/_shots/catgaze-hold.png' }) }
const s = await page.evaluate(() => window.__town3dCatState2 ? window.__town3dCatState2() : null)
console.log('state', JSON.stringify(s))
await browser.close()
console.log('check done')
