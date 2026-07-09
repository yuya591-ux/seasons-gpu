import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4877
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 600 } })
const errs=[]; page.on('pageerror',e=>errs.push('PE:'+e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1&fest=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-night'))
await page.waitForTimeout(3000)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
const n = await page.evaluate(() => window.__town3dFolkCount && window.__town3dFolkCount())
console.log('folk count', n, 'errs', errs.slice(0,3))
if (n > 0) {
  const Y = 90
  await page.evaluate(([Y,n]) => { const step=Math.max(1,(n/4)|0); for (let k=0;k<4;k++) window.__town3dFolkPin(k*step, -2.4 + k*1.6, 0, Math.PI, Y) }, [Y,n])
  await page.waitForTimeout(700)
  save('folk_sky', await page.evaluate((Y) => window.__town3dShotAt(0.6, Y + 0.85, 7.5, 0.6, Y + 0.78, 0, 28), Y))
  console.log('saved folk_sky')
}
await browser.close()
