// 猫の前足の脚を明確に確認。茶トラを強制し近接でボールへ伸ばす瞬間を撮る（脚全体が伸びるか）。
import { chromium } from 'playwright'
const port = process.env.PORT || '5121'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 520, height: 600 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.addInitScript(() => { Math.random = () => 0.2 }) // 茶トラ固定
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dSetView(0.3, -0.55)); await page.waitForTimeout(900) // 猫へ寄って見下ろす
// 足先が伸びる瞬間を数コマ
await page.evaluate(() => window.__town3dBatToyAt(-0.35, 1.5)) // 左手前のボールへ
for (let i = 0; i < 6; i++) { await page.mouse.move(250 + i % 2 * 5, 320 + i % 2 * 5); await page.waitForTimeout(180)
  if (i === 2) await page.screenshot({ path: 'scripts/_shots/catleg-reach.png' })
  if (i === 4) await page.screenshot({ path: 'scripts/_shots/catleg-reach2.png' }) }
await page.screenshot({ path: 'scripts/_shots/catleg-rest.png' })
await browser.close()
console.log('catleg done')
