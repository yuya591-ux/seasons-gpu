// 3Dの街「窓をあける／身を乗り出す」アニメーションの確認。
// 閉じ→あける→乗り出す→もどす を順に撮り、ガラスの滑り・枠の後退・カメラ前進を見る。
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
await page.goto('http://localhost:4790/seasons-gpu/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2200)
await page.addStyleTag({ content: '.ui{display:none !important}' })

async function shot(name) {
  await page.waitForTimeout(200)
  await page.screenshot({ path: `scripts/_shots/${name}.png` })
}
await shot('tw-1-closed')

await page.evaluate(() => window.__town3dWindow(true))
await page.waitForTimeout(2400) // あけるアニメ（ガラスが横へ滑って消える）
await shot('tw-2-open')

await page.evaluate(() => window.__town3dLean(true))
await page.waitForTimeout(2800) // 乗り出すアニメ（枠が広がって退き、カメラが前へ）
await page.evaluate(() => window.__town3dSetView && window.__town3dSetView(0.7, 0.1)) // 広がった可動域で見回す
await page.waitForTimeout(1400)
await shot('tw-3-lean')

await page.evaluate(() => { window.__town3dLean(false); window.__town3dWindow(false) })
await page.waitForTimeout(2600) // もどる
await shot('tw-4-back')

console.log(errors.length ? ('エラー: ' + JSON.stringify(errors)) : 'エラー無し ✓')
await browser.close()
