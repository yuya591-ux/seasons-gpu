// 建物ファサードの改良確認: ①窓辺/俯瞰の見た目が崩れていないか(退行確認) ②近接の壁面が窓として読めるか。
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
await page.addStyleTag({ content: '.ui{display:none !important}' })

// ① 窓辺の既定ビュー（俯瞰）＝退行確認
await page.waitForTimeout(300)
await page.screenshot({ path: 'scripts/_shots/facade-0-window.png' })

// 乗り出した俯瞰（街を見下ろす）＝退行確認その2
await page.evaluate(() => window.__town3dWindow(true))
await page.waitForTimeout(1400)
await page.evaluate(() => window.__town3dLean(true))
await page.waitForTimeout(1900)
await page.screenshot({ path: 'scripts/_shots/facade-1-lean.png' })

// ② 低空で建物の壁へ寄る（近接ファサード）
await page.evaluate(() => window.__town3dFlyToggle(true))
await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dFlyPose(6, 8, -14, -0.5, 0.05)) // 手前の建物の壁面へ寄る
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/_shots/facade-2-near.png' })

// さらに別の建物群へ寄る
await page.evaluate(() => window.__town3dFlyPose(-10, 7, -26, 0.6, 0.04))
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/_shots/facade-3-near2.png' })

await browser.close()
console.log('facade shots: window/lean(退行) + near/near2(近接)')
