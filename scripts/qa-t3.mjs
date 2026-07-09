import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4896
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 760, height: 460 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.addInitScript(() => { try { localStorage.removeItem('seasons_flew_once'); localStorage.removeItem('seasons_look_hint') } catch {} })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(800)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(3000)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(2600)
await page.evaluate(() => { if (window.__town3dClimb) window.__town3dClimb(1) }); await page.waitForTimeout(700)
await page.evaluate(() => { if (window.__town3dClimb) window.__town3dClimb(0) }); await page.waitForTimeout(200)
await page.screenshot({ path: 'scripts/_shots/t3_fly.png' })
const hint = await page.evaluate(() => { const e = document.querySelector('.town3d-ctrlhint, [class*=ctrlhint]'); return e ? e.textContent : 'no ctrlhint el' })
console.log('hint text:', hint)
await browser.close()
