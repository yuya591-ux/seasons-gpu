// 雨天シーンで雲海の上に出ると雨/雷の音が消えるかを実測。__audio._dbg() の altDuck と各ループ音ゲインを窓辺/高所で比較。
import { chromium } from 'playwright'
const port = process.env.PORT || '5090'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 760 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})   // 音脈を起こす（ユーザー操作）
await page.waitForTimeout(900)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-rain-night'))
await page.waitForTimeout(3000)
const atWindow = await page.evaluate(() => window.__audio && window.__audio._dbg())
console.log('窓辺(雨の中):', JSON.stringify(atWindow))
// 飛び立って雲海の上へ
await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(300)
await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(700)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dFlyPose(20, 112, -300, 0, -0.05)) // 雲海の上(y112)
await page.waitForTimeout(2600) // ダックは0.5sのsetTargetでなめらか＝十分待つ
const aloft = await page.evaluate(() => window.__audio && window.__audio._dbg())
console.log('雲海の上(y112):', JSON.stringify(aloft))
await browser.close()
console.log('check done')
