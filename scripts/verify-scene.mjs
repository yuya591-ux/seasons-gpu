// 任意の情景を撮影する汎用検証スクリプト。
// 使い方: node scripts/verify-scene.mjs <sceneId> <out> [down]
import { chromium } from 'playwright'
const [, , sceneId, out = 'scene', down = ''] = process.argv
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 400, height: 850 } })
const errs = []
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto('http://localhost:4790/seasons-gpu/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(900)
// 起動時の「いま」の情景が落ち着いてから指定情景へ。確実に切り替わるよう二度当てる。
await page.evaluate((id) => window.__applyScene && window.__applyScene(id), sceneId)
await page.waitForTimeout(700)
await page.evaluate((id) => window.__applyScene && window.__applyScene(id), sceneId)
await page.waitForTimeout(2000)
await page.screenshot({ path: `scripts/_shots/${out}_front.png` })
if (down) {
  const box = await page.locator('#scene').boundingBox()
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45)
  await page.mouse.down()
  for (let i = 1; i <= 16; i++) { await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45 + (box.height * 0.42) * i / 16); await page.waitForTimeout(16) }
  await page.mouse.up()
  await page.waitForTimeout(1400)
  await page.screenshot({ path: `scripts/_shots/${out}_down.png` })
}
const hud = await page.evaluate(() => { const e = document.querySelector('.hud__scene'); return e ? e.textContent : '?' })
const shaderErr = errs.filter((e) => /shader|compile|GLSL|uniform|コンパイル|失敗/i.test(e))
console.log('hud:', hud, '| shader errors:', shaderErr.slice(0, 4).join(' | ') || 'none')
await browser.close()
