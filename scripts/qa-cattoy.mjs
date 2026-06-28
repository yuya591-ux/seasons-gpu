// 猫の毛糸玉バットの改善確認: ボールを猫の左/右に置くと、猫がボールの方へ向き直って前足を伸ばすか。
import { chromium } from 'playwright'
const port = process.env.PORT || '5112'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 760 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(3000)
await page.evaluate(() => window.__town3dSetView(0.0, -0.46)); await page.waitForTimeout(800) // 真上気味に猫を見下ろす
async function batAt(label, wx, wz) {
  const info = await page.evaluate(([x, z]) => window.__town3dBatToyAt(x, z), [wx, wz])
  console.log(label, 'bat ->', JSON.stringify(info))
  await page.waitForTimeout(750) // 向き直り＋打ち始め
  await page.screenshot({ path: `scripts/_shots/cattoy-${label}-a.png` })
  await page.waitForTimeout(550) // 打つ瞬間
  await page.screenshot({ path: `scripts/_shots/cattoy-${label}-b.png` })
  await page.waitForTimeout(2500) // 落ち着くまで待つ
  console.log(label, 'done')
}
await batAt('left', -0.35, 1.55)   // 猫(≈0.5,1.62)の左(-x)
await batAt('right', 1.35, 1.7)    // 右(+x)
await batAt('back', 0.6, 2.35)     // 奥(+z)
await browser.close()
console.log('check done')
