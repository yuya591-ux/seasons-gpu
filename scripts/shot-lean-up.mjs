// 乗り出し時の見上げ範囲拡張を確認する。乗り出し→上スワイプ相当で空・ビル上層が見えるか。
import { chromium } from 'playwright'
const port = process.env.PORT || '4802'
const id = 'kitaterao-window-3d'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
await page.waitForTimeout(1800)
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 乗り出してから視線を上/中央/下へ。乗り出しが効くまで待ってから（範囲が広がってから）pitchを与える。
await page.evaluate(() => window.__town3dLean(true))
await page.waitForTimeout(2200)
async function shot(pitch, name) {
  await page.evaluate((p) => window.__town3dSetView(0, p), pitch)
  await page.waitForTimeout(1100)
  await page.screenshot({ path: `scripts/_shots/lean-${name}.png` })
  console.log('shot lean', name, 'pitch=', pitch)
}
await shot(1.45, 'up')    // 見上げ（空・ビル上層）
await shot(0.0, 'mid')    // 既定（やや見下ろし）
await shot(-0.5, 'down')  // 見下ろし
await browser.close()
