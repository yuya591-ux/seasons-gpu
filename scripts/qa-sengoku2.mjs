import { chromium } from 'playwright'
import fs from 'node:fs'
// 戦国エリア（霧の谷あいの城下町・山城）を地上〜低空目線で点検。SENGOKU(140,-640)、城は東尾根の中腹。
const PORT = process.env.PORT || 4920
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 420 }, deviceScaleFactor: 1.5 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 120)) })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {})
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFlyPose(140, 40, -560, Math.PI, -0.2)).catch(() => {})
await page.waitForTimeout(1800)
const gy = await page.evaluate(() => window.__town3dGroundAt(140, -600)).catch(() => 4)
const shots = {
  valley: [140, (gy || 4) + 16, -555, 150, (gy || 4) + 14, -650, 60],
  castle: [150, 24, -610, 168, 20, -648, 50],
}
for (const [name, p] of Object.entries(shots)) {
  const url = await page.evaluate((a) => window.__town3dShotAt(...a), p)
  if (url && url.startsWith('data:image')) { fs.writeFileSync(`${OUT}\\sengoku-${name}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log('saved', `sengoku-${name}.png`) }
}
console.log('gy=' + gy, errs.length ? 'エラー:' + JSON.stringify(errs.slice(0, 4)) : 'コンソールエラー無し')
await browser.close()
