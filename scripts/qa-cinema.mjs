// オートシネマ確認: 無操作7s後に最寄り名所(EDO)を低速オービット。位置/向きが時間で巡るか＋撮影。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2400)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(700)
await page.evaluate(() => { window.__town3dCruise(false) }) // ホバリング（巡航オフ）
await page.evaluate(() => window.__town3dFlyPose(300, 44, -30, Math.PI / 2, -0.12)) // 江戸城の近くで停止
const dbg = () => page.evaluate(() => window.__town3dDbg())
console.log('t0   :', JSON.stringify(await dbg()))
await page.waitForTimeout(7600) // 無操作7s超でシネマ開始
console.log('t7.6 :', JSON.stringify(await dbg())); await page.screenshot({ path: 'scripts/_shots/cinema-a.png' })
await page.waitForTimeout(5000)
console.log('t12.6:', JSON.stringify(await dbg())); await page.screenshot({ path: 'scripts/_shots/cinema-b.png' })
await page.waitForTimeout(5000)
console.log('t17.6:', JSON.stringify(await dbg())); await page.screenshot({ path: 'scripts/_shots/cinema-c.png' })
console.log('cinema shots done')
await browser.close()
