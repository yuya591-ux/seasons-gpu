// 窓の乗り出し時の見回し幅の確認: 右端いっぱいまで見回した視界（±74°クランプ＝壁の遮蔽の再現）
import { chromium } from 'playwright'
import fs from 'node:fs'
const port = process.env.PORT || '4890'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1000)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1500)
for (let i = 0; i < 10; i++) await page.evaluate(() => window.__town3dLook(0.6, 0)) // 右へ大きく見回す（クランプまで）
await page.waitForTimeout(1200)
const yaw = await page.evaluate(() => window.__town3dDbg && window.__town3dDbg())
fs.writeFileSync('scripts/_shots/lean-right-max.png', await page.screenshot())
for (let i = 0; i < 20; i++) await page.evaluate(() => window.__town3dLook(-0.6, 0)) // 左へ
await page.waitForTimeout(1200)
fs.writeFileSync('scripts/_shots/lean-left-max.png', await page.screenshot())
console.log('qa-lean done')
await browser.close()
