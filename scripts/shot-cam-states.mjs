// 3Dの街モードの窓カメラ3状態（閉/あけ/乗り出し）を撮り分け、カメラが実際に動くかを目視確認する。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const id = process.argv[2] || 'kitaterao-window-3d'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
await page.waitForTimeout(1800)
await page.addStyleTag({ content: '.ui{display:none !important}' })

await page.waitForTimeout(300)
await page.screenshot({ path: 'scripts/_shots/cam-0-closed.png' })

await page.evaluate(() => window.__town3dWindow(true))
await page.waitForTimeout(1600) // 開ききるまで（ease込み）
await page.screenshot({ path: 'scripts/_shots/cam-1-open.png' })

await page.evaluate(() => window.__town3dLean(true))
await page.waitForTimeout(2000) // 乗り出しきるまで
await page.screenshot({ path: 'scripts/_shots/cam-2-lean.png' })

await browser.close()
console.log('shot cam states: closed/open/lean')
