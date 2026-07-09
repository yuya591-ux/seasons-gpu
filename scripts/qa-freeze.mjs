// 凍結拡張の視覚回帰確認: 飛行(室内・時代を凍結)→窓辺へ帰還→室内が正しく描かれるか／江戸へ接近→時代が正しく現れるか
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
await page.waitForTimeout(2200)
fs.writeFileSync('scripts/_shots/freeze-0-window-before.png', await page.screenshot())
// 飛んで室内を凍結→江戸まで渡って時代の再表示も踏む→帰還
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(900)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1200)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
await page.evaluate(() => window.__town3dFlyPose(640, 20, -46, 0, 0)); await page.waitForTimeout(1800)
const edo = await page.evaluate(() => window.__town3dEraCull())
console.log('江戸接近時の時代群:', JSON.stringify(edo))
fs.writeFileSync('scripts/_shots/freeze-1-edo.png', await page.screenshot())
// 窓辺へ帰還（着地→窓モードへ）
await page.evaluate(() => window.__town3dFlyPose(0, 20, 10, 0, 0)); await page.waitForTimeout(600)
await page.evaluate(() => window.__town3dFly(false)); await page.waitForTimeout(2500)
await page.evaluate(() => window.__town3dLean(false)); await page.waitForTimeout(1500)
fs.writeFileSync('scripts/_shots/freeze-2-window-after.png', await page.screenshot())
await browser.close()
console.log('qa-freeze done')
