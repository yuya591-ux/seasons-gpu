import { chromium } from 'playwright'
import fs from 'node:fs'
// 主役の窓辺ビューを本物の見え方(page.screenshot=グレード込み)で全点検。既定の角部屋＝最初に見える画面を含む。
const PORT = process.env.PORT || 4920
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 460, height: 860 }, deviceScaleFactor: 2 })
const errs = []; page.on('pageerror', e => errs.push('PE:' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 100)) })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
const scenes = {
  corner: 'autumn-dusk-corner-room', // 既定＝最初に見える画面
  rain: 'kitaterao-window-3d-rain',
  snow: 'kitaterao-window-3d-snow',
  spring: 'kitaterao-window-3d-spring',
  autumn: 'kitaterao-window-3d-autumn',
  yato: 'shishigaya-window-3d',
}
for (const [tag, id] of Object.entries(scenes)) {
  await page.evaluate(s => window.__applyScene(s), id).catch(() => {})
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${OUT}\\win-${tag}.png` }); console.log('saved win-' + tag)
}
console.log(errs.length ? 'ERR' + JSON.stringify(errs.slice(0, 3)) : 'no console err')
await browser.close()
