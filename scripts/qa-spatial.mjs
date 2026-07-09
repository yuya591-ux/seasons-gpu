import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 1 })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text()) })
await page.goto('http://localhost:4875/seasons-gpu/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('summer-dusk-seaside'))
await page.waitForTimeout(1500)
const lp = async () => (await page.evaluate(() => window.__audio.getLookPan()))
await page.evaluate(() => window.__renderer.setPanTarget(2.0, 0)) // 右を向く
await page.waitForTimeout(350); const right = await lp()
await page.evaluate(() => window.__renderer.setPanTarget(-2.0, 0)) // 左を向く
await page.waitForTimeout(350); const left = await lp()
await page.evaluate(() => window.__renderer.setPanTarget(0, 0))
await page.waitForTimeout(350); const center = await lp()
console.log('lookPan 右向き=', right.toFixed(3), ' 左向き=', left.toFixed(3), ' 正面=', center.toFixed(3))
console.log('右で音場が左へ(右<0):', right < -0.05, ' 左で右へ(左>0):', left > 0.05, ' 正面で中央(|c|<0.05):', Math.abs(center) < 0.05)
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0,4)) : 'エラー無し')
await browser.close()
