import { chromium } from 'playwright'
const PORT = process.env.PORT || 4896
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 700, height: 500 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(800)
const frozen = await page.evaluate(() => window.__town3dFrozen ? window.__town3dFrozen() : 'NA')
const stats = await page.evaluate(() => window.__town3dStats())
// 動くものが本当に動いているか（住人の位置が時間で変わるか）
const a = await page.evaluate(() => { const r = window.__town3dResInfo(); return r.slice(0,3) })
await page.waitForTimeout(1200)
const b = await page.evaluate(() => { const r = window.__town3dResInfo(); return r.slice(0,3) })
let moved = false
for (let i=0;i<a.length;i++){ if (a[i] && b[i] && (a[i].x!==b[i].x || a[i].z!==b[i].z || a[i].face!==b[i].face)) moved = true }
console.log('frozen', frozen)
console.log('stats objs', stats.objs, 'calls', stats.calls)
console.log('residents moved?', moved)
await browser.close()
