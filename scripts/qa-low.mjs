import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4896
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 820, height: 480 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(900)
await page.evaluate(() => { window.__town3dFlyPose(0, 40, 60, 0, -0.1) }); await page.waitForTimeout(500)
await page.evaluate(() => { window.__town3dLowCruise(true) }); await page.waitForTimeout(4500) // 滑空して高度が地形+5.5へ降りるのを待つ
const d = await page.evaluate(() => { const s = window.__town3dDbg(); const g = window.__town3dGroundAt(s.x, s.z); return { y: +s.y.toFixed(1), terr: +g.toFixed(1), above: +(s.y - g).toFixed(1) } })
console.log('flyY', d.y, 'terrain', d.terr, 'above terrain', d.above, '(expect ~5.5)')
await page.addStyleTag({ content: '[class*="toast"],[class*="hint"]{display:none !important}' })
await page.screenshot({ path: 'scripts/_shots/low_glide.png' })
await browser.close()
