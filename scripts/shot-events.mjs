// 3D街の定期イベントを dev フックで即時発火して撮る。引数なしで全イベントを撮影。
import { chromium } from 'playwright'
const port = process.env.PORT || '4804'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)

async function scene(id) {
  await page.evaluate((sid) => window.__applyScene(sid), id)
  await page.waitForTimeout(1800)
  await page.addStyleTag({ content: '.ui{display:none !important}' })
}
async function look(pitch) { await page.evaluate((p) => window.__town3dSetView && window.__town3dSetView(0, p), pitch); await page.waitForTimeout(500) }
async function fire(name, waitMs, out, pitch = 0) {
  await look(pitch)
  await page.evaluate((n) => window.__town3dEvent(n), name)
  await page.waitForTimeout(waitMs)
  await page.screenshot({ path: `scripts/_shots/ev-${out}.png` })
  console.log('shot', out)
  await page.waitForTimeout(300)
}

// 昼の坂の街
await scene('kitaterao-window-3d')
await fire('birds', 4200, 'birds', 0.2)
await look(0)
await fire('balloon', 6500, 'balloon', 0.25)
await look(0)
await look(0.35)
await fire('contrail', 8000, 'contrail', 0.35)
await look(0)
await fire('rain', 7000, 'rain', 0)
await fire('rainbow', 10000, 'rainbow', 0.4)

// 夜の坂の街
await scene('kitaterao-window-3d-night')
await fire('fireworks', 3600, 'fireworks', 0.4)
await look(0.45)
await fire('star', 450, 'star', 0.45)

await browser.close()
console.log('done events')
