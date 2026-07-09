// 実写の窓を「窓あけ＋乗り出し」で全画面表示にして撮る（ユーザーが見た荒れ確認と同じ状態）。引数: 接尾辞
import { chromium } from 'playwright'
const port = process.env.PORT || '4803'
const suffix = process.argv[2] || 'sr'
const ids = ['photo-window-town', 'photo-window-dusk', 'photo-window-sea', 'photo-window-night']
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
for (const id of ids) {
  await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
  await page.waitForTimeout(1500)
  // 窓をあけて乗り出す＝枠が退き写真が全画面に（実機で荒く見えた状態を再現）
  await page.evaluate(() => { window.__renderer.setWindowOpen(true); window.__renderer.setLeanOut(true) })
  await page.waitForTimeout(1800)
  await page.addStyleTag({ content: '.ui{display:none !important}' })
  await page.waitForTimeout(150)
  await page.screenshot({ path: `scripts/_shots/pwopen-${id.replace('photo-window-', '')}-${suffix}.png` })
  await page.evaluate(() => { window.__renderer.setWindowOpen(false); window.__renderer.setLeanOut(false) })
  console.log('shot open', id, suffix)
}
await browser.close()
