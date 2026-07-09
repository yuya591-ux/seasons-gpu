import { chromium } from 'playwright'
import fs from 'node:fs'
const PORT = process.env.PORT || 4920
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 520, height: 460 }, deviceScaleFactor: 1.6 })
const errs = []; page.on('pageerror', e => errs.push('PE:' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 100)) })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {})
await page.waitForTimeout(2600)
// 花畑のある辺りへ降りて歩行モードに（蝶は歩行時のみ表示）
await page.evaluate(() => window.__town3dFlyPose(10, 8, -30, Math.PI, -0.06)).catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__town3dLandToggle && window.__town3dLandToggle(true)).catch(() => {})
await page.waitForTimeout(2500)
// 蝶の位置を取得できないので、歩行カメラの周辺を __town3dShotAt で数方向見回す（mode=walkなので蝶は可視）
const gy = await page.evaluate(() => window.__town3dGroundAt(10, -30)).catch(() => 4)
let n = 0
for (const yaw of [0, 1.2, 2.4, 3.6, 4.8]) {
  const lx = 10 + Math.sin(yaw) * 14, lz = -30 - Math.cos(yaw) * 14
  const url = await page.evaluate(a => window.__town3dShotAt(...a), [10, (gy || 4) + 1.6, -30, lx, (gy || 4) + 1.4, lz, 64])
  if (url && url.startsWith('data:image')) { fs.writeFileSync(`${OUT}\\bfly-${n}.png`, Buffer.from(url.split(',')[1], 'base64')); n++ }
}
console.log('saved', n, 'shots, gy=' + gy)
console.log(errs.length ? 'ERR' + JSON.stringify(errs.slice(0, 3)) : 'no console err')
await browser.close()
