import { chromium } from 'playwright'
import fs from 'node:fs'
// 江戸中心の天守(640,-46)にカメラを向け、石垣の石積みテクスチャを確認。
const PORT = process.env.PORT || 4920
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 460 }, deviceScaleFactor: 1.5 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 120)) })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {})
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFlyPose(640, 30, -10, Math.PI, -0.2)).catch(() => {})
await page.waitForTimeout(1800)
const gy = await page.evaluate(() => window.__town3dGroundAt(640, -46)).catch(() => 5.5)
const cam = [640 + 26, (gy || 5.5) + 24, -46 + 30, 640, (gy || 5.5) + 14, -46, 52]
const url = await page.evaluate((a) => window.__town3dShotAt(...a), cam)
if (url && url.startsWith('data:image')) { fs.writeFileSync(`${OUT}\\edocastle.png`, Buffer.from(url.split(',')[1], 'base64')); console.log('saved edocastle.png gy=' + gy) }
else console.log('NG', String(url).slice(0, 40))
console.log(errs.length ? 'エラー:' + JSON.stringify(errs.slice(0, 4)) : 'コンソールエラー無し')
await browser.close()
