import { chromium } from 'playwright'
import fs from 'node:fs'
// 高度を上げる過程の雲海/島の「滲み出し」フェードを複数高度で撮る。booleanポップでなく滑らかに現れるか。
const PORT = process.env.PORT || 4920
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 460, height: 380 }, deviceScaleFactor: 1.4 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 120)) })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {})
await page.waitForTimeout(2600)
// 固定の外部カメラから群島を見ながら、自機の高度だけ変える
const cam = [95, 128, -150, -25, 102, -300, 60]
for (const y of [56, 66, 76, 86, 98]) {
  await page.evaluate((yy) => window.__town3dFlyPose(-20, yy, -250, Math.PI, -0.1), y).catch(() => {})
  await page.waitForTimeout(700)
  const url = await page.evaluate((a) => window.__town3dShotAt(...a), cam)
  if (url && url.startsWith('data:image')) { fs.writeFileSync(`${OUT}\\fade-y${y}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log('saved', `fade-y${y}.png`) }
}
console.log(errs.length ? 'エラー:' + JSON.stringify(errs.slice(0, 4)) : 'コンソールエラー無し')
await browser.close()
