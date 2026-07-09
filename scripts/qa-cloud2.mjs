import { chromium } from 'playwright'
import fs from 'node:fs'
// 雲上の回遊群島（東屋・茶屋・温泉・樹冠）と雲海を撮る。高空へ飛んでcloudHi=trueにしてから撮影。
const PORT = process.env.PORT || 4920
const TAG = process.env.TAG || 'before'
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 420 }, deviceScaleFactor: 1.5 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 120)) })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {})
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFlyPose(-20, 130, -250, Math.PI, -0.2)).catch(() => {})
await page.waitForTimeout(2000)
const shots = {
  pavilion: [-20, 116, -262, -20, 109.5, -290, 50],
  archipelago: [70, 140, -180, -30, 106, -320, 62],
  sea: [120, 150, -40, 20, 92, -240, 64],
}
for (const [name, p] of Object.entries(shots)) {
  const url = await page.evaluate((a) => window.__town3dShotAt(...a), p)
  if (url && url.startsWith('data:image')) {
    fs.writeFileSync(`${OUT}\\cloud-${name}-${TAG}.png`, Buffer.from(url.split(',')[1], 'base64'))
    console.log('saved', `cloud-${name}-${TAG}.png`)
  } else console.log('NG', name, String(url).slice(0, 40))
}
console.log(errs.length ? 'エラー:' + JSON.stringify(errs.slice(0, 4)) : 'コンソールエラー無し')
await browser.close()
