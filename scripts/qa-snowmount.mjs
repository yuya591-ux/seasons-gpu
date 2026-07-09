import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 500 } })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-snow'))
await p.waitForTimeout(2600)
console.log('typeof __town3dFly =', await p.evaluate(() => typeof window.__town3dFly))
console.log(errs.length ? 'ERR ' + errs.slice(0,3).join(' | ') : 'no errors')
await b.close()
