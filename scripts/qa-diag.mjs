import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 500 } })
const errs = []
p.on('pageerror', (e) => errs.push('PAGEERR ' + (e.stack || e.message || String(e))))
p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()) })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset')).catch((e) => errs.push('APPLY ' + e.message))
await p.waitForTimeout(2600)
const hasFly = await p.evaluate(() => typeof window.__town3dFly)
console.log('typeof __town3dFly =', hasFly)
console.log(errs.length ? errs.slice(0, 8).join('\n') : 'no errors')
await b.close()
