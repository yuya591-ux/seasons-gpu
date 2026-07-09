// 茶トラ/キジトラを強制し、近接の見下ろし(catface構図)で背の縞を大きく撮る。
import { chromium } from 'playwright'
const port = process.env.PORT || '5121'
const browser = await chromium.launch()
const cases = [['chatora', 0.2], ['kijitora', 0.07]]
for (const [label, rnd] of cases) {
  const page = await browser.newPage({ viewport: { width: 520, height: 640 }, deviceScaleFactor: 2 })
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
  await page.addInitScript((r) => { Math.random = () => r }, rnd)
  await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
  await page.locator('.gate').click().catch(() => {})
  await page.waitForTimeout(400)
  await page.addStyleTag({ content: '.ui{display:none !important}' })
  await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
  await page.waitForTimeout(2600)
  await page.evaluate(() => window.__town3dCatReact('roll')) // 寝返りで背を見せる時がある
  await page.evaluate(() => window.__town3dSetView(0.32, -0.62)); await page.waitForTimeout(1400) // 近接で見下ろす(catface構図)
  await page.screenshot({ path: `scripts/_shots/stripe2-${label}.png` })
  console.log('done', label)
  await page.close()
}
await browser.close()
console.log('check done')
