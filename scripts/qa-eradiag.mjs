import { chromium } from 'playwright'
const PORT = process.env.PORT || 4803
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 600, height: 400 } })
const errs=[]; page.on('pageerror',e=>errs.push('PE:'+e.message)); page.on('console',m=>{if(m.type()==='error')errs.push('CE:'+m.text())})
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1500)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d')).catch(()=>{})
await page.waitForTimeout(3500)
console.log('hooks:', await page.evaluate(()=>typeof window.__town3dShotAt))
console.log('errs:', JSON.stringify(errs.slice(0,5)))
await browser.close()
