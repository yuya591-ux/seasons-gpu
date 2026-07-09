// Step3準備: 水彩グレードの各層の実効(computed)値を地の真実として吸い出す。paperの0.18/0.2問題・stage filter・各blend/opacity/背景を確定。
import { chromium } from 'playwright'
const port = process.env.PORT || '4917'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
const scene = process.env.SCENE || 'kitaterao-window-3d'
await page.evaluate((s) => window.__applyScene && window.__applyScene(s), scene)
await page.waitForTimeout(2600)
console.log('SCENE:', scene)
const dump = await page.evaluate(() => {
  const stage = document.querySelector('.town3d-stage')
  const cs = getComputedStyle(stage)
  const vars = ['--t3d-glow', '--t3d-shade', '--t3d-wash-a'].map((v) => `${v}=${cs.getPropertyValue(v).trim()}`)
  const layers = ['town3d-atmo', 'town3d-wash', 'town3d-paper', 'town3d-paper2', 'town3d-bleed'].map((cls) => {
    const el = document.querySelector('.' + cls); if (!el) return `${cls}: なし`
    const s = getComputedStyle(el)
    return { cls, blend: s.mixBlendMode, opacity: s.opacity, bgSize: s.backgroundSize, bgImg: s.backgroundImage.slice(0, 120) }
  })
  return { stageFilter: cs.filter, vars, layers }
})
console.log('stage filter:', dump.stageFilter)
console.log('vars:', dump.vars.join('  '))
for (const l of dump.layers) console.log(JSON.stringify(l))
await browser.close()
