// 引き違いガラス障子の開閉アニメ確認: 閉=ガラスが開口を覆う／窓をあける=右の障子が左へすべる。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2400)
await page.addStyleTag({ content: '.ui{display:none !important}' }).catch(() => {})
await page.screenshot({ path: 'scripts/_shots/glass-closed.png' }) // 窓を閉じた（ガラスが覆う）
await page.evaluate(() => window.__town3dWindow(true)) // 窓をあける
await page.waitForTimeout(1400) // 開きアニメ
await page.screenshot({ path: 'scripts/_shots/glass-open.png' }) // 右の障子が左へすべった
console.log('glass shots done')
await browser.close()
