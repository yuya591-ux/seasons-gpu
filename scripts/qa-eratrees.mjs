import { chromium } from 'playwright'
import fs from 'node:fs'
// 時代エリアの並木が det1 で丸くなったか、低空目線で確認（大正/江戸）。
const PORT = process.env.PORT || 4920
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 380 }, deviceScaleFactor: 1.5 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 120)) })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {})
await page.waitForTimeout(2600)
// 大正(-640,-30) / 江戸(640,-46) の上空へ飛んでエリアを出してから低めの目線で撮る
const spots = { taisho: [-640, -30], edo: [640, -46] }
for (const [tag, [ex, ez]] of Object.entries(spots)) {
  await page.evaluate(([x, z]) => window.__town3dFlyPose(x, 22, z + 30, Math.PI, -0.18), [ex, ez]).catch(() => {})
  await page.waitForTimeout(1800)
  const gy = await page.evaluate(([x, z]) => window.__town3dGroundAt(x, z), [ex, ez]).catch(() => 6)
  const cam = [ex + 6, (gy || 6) + 9, ez + 34, ex, (gy || 6) + 4, ez - 6, 60]
  const url = await page.evaluate((a) => window.__town3dShotAt(...a), cam)
  if (url && url.startsWith('data:image')) { fs.writeFileSync(`${OUT}\\eratrees-${tag}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log('saved', `eratrees-${tag}.png`, 'gy=' + gy) }
}
console.log(errs.length ? 'エラー:' + JSON.stringify(errs.slice(0, 4)) : 'コンソールエラー無し')
await browser.close()
