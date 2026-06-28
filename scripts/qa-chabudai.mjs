// 室内（昭和の茶の間）にちゃぶ台を追加した確認。窓辺ビュー＋見下ろし。
import { chromium } from 'playwright'
const port = process.env.PORT || '5104'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 460, height: 760 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(3000)
async function view(label, yaw, pitch) {
  await page.evaluate(([y, p]) => window.__town3dSetView(y, p), [yaw, pitch])
  await page.waitForTimeout(1300)
  await page.screenshot({ path: `scripts/_shots/chabudai-${label}.png` })
  console.log(label, 'done')
}
await view('front', 0, -0.04)
await view('left-down', -0.45, -0.5)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-night')); await page.waitForTimeout(2800)
await view('night-down', -0.4, -0.46)
await browser.close()
console.log('check done')
