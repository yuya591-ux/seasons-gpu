import { chromium } from 'playwright'
import fs from 'node:fs'
// 夜・夕方・雪の雲海/入道雲の色と造形を点検（昼以外の時間帯の質）。
const PORT = process.env.PORT || 4920
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 420 }, deviceScaleFactor: 1.4 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 120)) })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
const scenes = { night: 'kitaterao-window-3d-night', dusk: 'kitaterao-window-3d-sunset', snow: 'kitaterao-window-3d-snow' }
for (const [tag, id] of Object.entries(scenes)) {
  await page.evaluate((s) => window.__applyScene(s), id).catch(() => {})
  await page.waitForTimeout(2600)
  await page.evaluate(() => window.__town3dFlyPose(-20, 100, -230, Math.PI, -0.12)).catch(() => {})
  await page.waitForTimeout(1500)
  const arch = await page.evaluate((a) => window.__town3dShotAt(...a), [70, 132, -170, -30, 100, -310, 60])
  if (arch && arch.startsWith('data:image')) { fs.writeFileSync(`${OUT}\\cloudtime-${tag}.png`, Buffer.from(arch.split(',')[1], 'base64')); console.log('saved', `cloudtime-${tag}.png`) }
}
console.log(errs.length ? 'エラー:' + JSON.stringify(errs.slice(0, 4)) : 'コンソールエラー無し')
await browser.close()
