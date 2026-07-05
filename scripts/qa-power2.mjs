// Step1検証: setTown3dPaused(true)で実描画フレームが止まり、(false)で再開するか。antialias:falseで見た目が崩れないか。
import { chromium } from 'playwright'
import fs from 'node:fs'
const port = process.env.PORT || '4917'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2400)

fs.writeFileSync('scripts/_shots/power2-window.png', await page.screenshot())

// 実描画フレームの計測（停止→再開）
const frame = () => page.evaluate(() => window.__town3dFrame())
const f0 = await frame(); await page.waitForTimeout(1000); const f0b = await frame()
console.log(`通常: 1秒で +${f0b - f0} フレーム描画（>0のはず）`)

await page.evaluate(() => window.__town3dPaused(true))
await page.waitForTimeout(200) // 直前の予約フレームを消化
const p0 = await frame(); await page.waitForTimeout(1500); const p1 = await frame()
console.log(`停止中: 1.5秒で +${p1 - p0} フレーム描画（0のはず）`)

await page.evaluate(() => window.__town3dPaused(false))
await page.waitForTimeout(200)
const r0 = await frame(); await page.waitForTimeout(1000); const r1 = await frame()
console.log(`再開後: 1秒で +${r1 - r0} フレーム描画（>0のはず）`)
fs.writeFileSync('scripts/_shots/power2-resumed.png', await page.screenshot())

await browser.close()
console.log('qa-power2 done')
