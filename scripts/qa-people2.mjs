import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4931
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 844, height: 560 }, deviceScaleFactor: 2 })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {}); await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-spring')).catch(() => {}); await page.waitForTimeout(3200)
const save = (tag, dataUrl) => { if (!dataUrl) { console.log('NO ' + tag); return } writeFileSync(`${OUT}\\${tag}.png`, Buffer.from(dataUrl.split(',')[1], 'base64')); console.log(tag) }
const eras = [['edo', 640, -46], ['sengoku', 140, -640], ['taisho', -640, -30]]
for (const [tag, cx, cz] of eras) {
  const gy = await page.evaluate(([x, z]) => window.__town3dGroundAt(x, z), [cx, cz]).catch(() => 0)
  // 中心の眼の高さから、向きを変えて2枚（群衆を拾う）
  for (const [sfx, ang] of [['a', 0.6], ['b', 3.3]]) {
    const url = await page.evaluate(([x, y, z, a]) => window.__town3dShotAt(x, y + 1.7, z, x + Math.cos(a) * 20, y + 1.4, z + Math.sin(a) * 20, 62), [cx, gy, cz, ang]).catch(() => null)
    save(`ppl2-${tag}-${sfx}`, url)
  }
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'no err')
await browser.close()
