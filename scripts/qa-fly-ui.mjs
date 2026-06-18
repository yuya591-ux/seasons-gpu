// 「空へ」ボタンの実際の導線を確認: 立体の街で 乗り出す→空へ が現れ、押すと飛び、窓辺へもどるで戻る。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const id = process.argv[2] || 'kitaterao-window-3d'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click({ force: true }).catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
await page.waitForTimeout(1800)

const flyVisible = () => page.locator('.iconbtn--fly').isVisible()
const txt = () => page.locator('.iconbtn--fly').textContent()

console.log('初期: 空へボタン可視 =', await flyVisible()) // false（乗り出す前）
// 乗り出す（窓を自動で開ける導線）
await page.locator('.iconbtn--lean').click({ force: true })
await page.waitForTimeout(1800)
console.log('乗り出し後: 空へ可視 =', await flyVisible(), '/ ラベル =', (await txt()).trim())
// 空へ
await page.locator('.iconbtn--fly').click({ force: true })
await page.waitForTimeout(2200)
console.log('飛行中: ラベル =', (await txt()).trim(), '/ 窓ボタン可視 =', await page.locator('.iconbtn--window').isVisible())
const dbg = await page.evaluate(() => window.__town3dDbg && window.__town3dDbg())
console.log('飛行状態 dbg =', JSON.stringify(dbg))
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.screenshot({ path: 'scripts/_shots/fly-ui-airborne.png' })
await page.evaluate(() => { document.querySelector('style') })
// 窓辺へもどる
await page.evaluate(() => { for (const s of document.querySelectorAll('style')) if (s.textContent.includes('display:none')) s.remove() })
await page.locator('.iconbtn--fly').click({ force: true })
await page.waitForTimeout(2200)
console.log('もどった後: 空へ可視 =', await flyVisible(), '/ ラベル =', (await txt()).trim())

await browser.close()
