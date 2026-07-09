// 散策の導線をボタン操作で確認: 乗り出す→空へ→おりる(歩く・ヒント表示)→空へ→窓辺へもどる。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const id = process.argv[2] || 'kitaterao-window-3d'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
await page.waitForTimeout(1800)

const fly = () => page.locator('.iconbtn--fly')
const back = () => page.locator('.iconbtn--back')
const mode = async () => (await page.evaluate(() => window.__town3dDbg && window.__town3dDbg()))?.mode
const labels = async () => `fly=[${(await fly().textContent()).trim()} vis:${await fly().isVisible()}] back=[vis:${await back().isVisible()}]`

await page.locator('.iconbtn--lean').click({ force: true })
await page.waitForTimeout(1700)
console.log('乗り出し後 :', await labels())
await fly().click({ force: true }) // 空へ
await page.waitForTimeout(1500)
console.log('空へ後     :', 'mode=', await mode(), await labels())
await fly().click({ force: true }) // おりる
await page.waitForTimeout(2000)
const hintVis = await page.locator('.walk-hint').evaluate((el) => getComputedStyle(el).opacity)
console.log('おりる後   :', 'mode=', await mode(), await labels(), 'ヒントopacity=', hintVis)
await fly().click({ force: true }) // また空へ
await page.waitForTimeout(1800)
console.log('再び空へ後 :', 'mode=', await mode(), await labels())
await back().click({ force: true }) // 窓辺へもどる
await page.waitForTimeout(2000)
console.log('窓辺へ後   :', 'mode=', await mode(), await labels())

await browser.close()
