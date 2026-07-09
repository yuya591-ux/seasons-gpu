import { chromium } from 'playwright'
import fs from 'node:fs'
// 実際にユーザーが見る画面（CSS水彩グレード込み）をpage.screenshotで撮る。__town3dShotAtは生WebGLでグレードを通らない。
const PORT = process.env.PORT || 4920
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 460, height: 860 }, deviceScaleFactor: 2 })
const errs = []; page.on('pageerror', e => errs.push('PE:' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 100)) })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
// 各時間帯のhome窓辺ビュー（グレード込み・実画面）
for (const [tag, id] of Object.entries({ day: 'kitaterao-window-3d', dusk: 'kitaterao-window-3d-sunset', night: 'kitaterao-window-3d-night' })) {
  await page.evaluate(s => window.__applyScene(s), id).catch(() => {})
  await page.waitForTimeout(2800)
  await page.screenshot({ path: `${OUT}\\graded-win-${tag}.png` })
  console.log('saved graded-win-' + tag)
}
// home上空の飛行ビュー（グレード込み）
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {})
await page.waitForTimeout(2200)
await page.evaluate(() => window.__town3dFlyPose(0, 36, 60, Math.PI, -0.18)).catch(() => {})
await page.waitForTimeout(2200)
await page.screenshot({ path: `${OUT}\\graded-fly.png` }); console.log('saved graded-fly')
console.log(errs.length ? 'ERR' + JSON.stringify(errs.slice(0, 3)) : 'no console err')
await browser.close()
