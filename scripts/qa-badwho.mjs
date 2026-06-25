import { chromium } from 'playwright'
const PORT = process.env.PORT || 4882
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 820 } })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(3500)
const r = await page.evaluate(()=>window.__town3dResClip())
console.log('bad', JSON.stringify(r.bad))
for (const b of r.bad.slice(0,3)) { const p=await page.evaluate(([x,z])=>window.__town3dProbe(x,z),[b.x,b.z]); console.log(`(${b.x},${b.z})`, JSON.stringify(p.near&&p.near.slice(0,2))) }
await browser.close()
