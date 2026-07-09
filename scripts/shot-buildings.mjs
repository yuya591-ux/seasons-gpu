// 建物・人の質感を通常の視線で評価する。乗り出さず・水平〜やや見上げ/見下ろしで撮影。
import { chromium } from 'playwright'
const port = process.env.PORT || '4855'
const id = process.env.SCENE || 'kitaterao-window-3d'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
await page.waitForTimeout(2000)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__town3dLean && window.__town3dLean(true))
await page.waitForTimeout(2000)
async function shot(yaw, pitch, name) {
  await page.evaluate(([y, p]) => window.__town3dSetView && window.__town3dSetView(y, p), [yaw, pitch])
  await page.waitForTimeout(900)
  await page.screenshot({ path: `scripts/_shots/bld-${id}-${name}.png` })
  console.log('shot', id, name)
}
await shot(0, 0.1, 'fwd')       // 正面・ほぼ水平＝通りの建物の壁/屋根
await shot(-0.9, -0.1, 'left')  // 左の建物
await shot(0.9, -0.1, 'right')  // 右の建物
await browser.close()
