import { chromium } from 'playwright'
import fs from 'node:fs'
const PORT = process.env.PORT || 4920
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 520, height: 420 }, deviceScaleFactor: 1.6 })
const errs = []; page.on('pageerror', e => errs.push('PE:' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 100)) })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {})
await page.waitForTimeout(2600)
// 大正(-640,-30)・江戸(640,-46)へ飛んで近くから俯瞰（丘が見える角度）。__town3dShotAtで生ジオメトリ。
const shots = {
  taisho: { fly: [-600, 50, 30], cam: [-585, 44, 36, -660, 14, -44, 60] },
  edo: { fly: [600, 50, 10], cam: [600, 46, 30, 660, 16, -60, 60] },
}
for (const [tag, s] of Object.entries(shots)) {
  await page.evaluate(p => window.__town3dFlyPose(p[0], p[1], p[2], Math.PI, -0.2), s.fly).catch(() => {})
  await page.waitForTimeout(2000)
  const url = await page.evaluate(a => window.__town3dShotAt(...a), s.cam)
  if (url && url.startsWith('data:image')) { fs.writeFileSync(`${OUT}\\eraover-${tag}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log('saved eraover-' + tag) }
}
console.log(errs.length ? 'ERR' + JSON.stringify(errs.slice(0, 3)) : 'no console err')
await browser.close()
