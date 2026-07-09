// 茶トラ/キジトラ/サバトラを強制(Math.random固定)して縞の明瞭化を確認。横・斜め後ろ・真上から撮る。
import { chromium } from 'playwright'
const port = process.env.PORT || '5121'
const browser = await chromium.launch()
// 0.07→キジトラ(0) / 0.2→茶トラ(1) / 0.36→サバトラ(2)
const cases = [['kijitora', 0.07], ['chatora', 0.2], ['sabatora', 0.36]]
for (const [label, rnd] of cases) {
  const page = await browser.newPage({ viewport: { width: 560, height: 600 }, deviceScaleFactor: 2 })
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
  await page.addInitScript((r) => { Math.random = () => r }, rnd)
  await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
  await page.locator('.gate').click().catch(() => {})
  await page.waitForTimeout(400)
  await page.addStyleTag({ content: '.ui{display:none !important}' })
  await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
  await page.waitForTimeout(2600)
  await page.evaluate(() => window.__town3dSetView(0.55, -0.42)); await page.waitForTimeout(1000) // 斜め後ろ上＝背と脇腹
  await page.screenshot({ path: `scripts/_shots/stripe-${label}-back.png` })
  await page.evaluate(() => window.__town3dSetView(-0.5, -0.2)); await page.waitForTimeout(900) // 横から＝脇腹の縞
  await page.screenshot({ path: `scripts/_shots/stripe-${label}-side.png` })
  console.log('done', label)
  await page.close()
}
await browser.close()
console.log('check done')
