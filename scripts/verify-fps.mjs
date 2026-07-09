// FXAA 等の負荷確認: 指定情景でフレーム間隔を計測し平均FPSを出す（スマホ画角想定）。
// 使い方: node scripts/verify-fps.mjs <sceneId>
import { chromium } from 'playwright'
const [, , sceneId = 'summer-rain-evening-corner-room'] = process.argv
const port = process.env.PORT || '4790'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 400, height: 850 } })
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(800)
await page.evaluate((id) => window.__applyScene && window.__applyScene(id), sceneId)
await page.waitForTimeout(2500) // 自動解像度調整が落ち着くまで
const fps = await page.evaluate(() => new Promise((resolve) => {
  let n = 0, last = performance.now(), sum = 0, worst = 0
  function tick(now) {
    const dt = now - last; last = now
    if (n > 0) { sum += dt; worst = Math.max(worst, dt) }
    n++
    if (n < 150) requestAnimationFrame(tick)
    else resolve({ avg: 1000 / (sum / (n - 1)), worstMs: worst })
  }
  requestAnimationFrame(tick)
}))
console.log(`${sceneId}: 平均 ${fps.avg.toFixed(1)}fps / 最悪フレーム ${fps.worstMs.toFixed(1)}ms`)
await browser.close()
