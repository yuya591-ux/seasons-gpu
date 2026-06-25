import { chromium } from 'playwright'
const PORT = process.env.PORT || 4882
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 820 } })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2800)
let mx=0
for (let i=0;i<10;i++){ await page.waitForTimeout(1000); const r=await page.evaluate(()=>window.__town3dResClip()); mx=Math.max(mx,r.peepIn+r.resIn); console.log(`t+${i+1}s res${r.resIn} peep${r.peepIn}`) }
console.log('max', mx)
await browser.close()
