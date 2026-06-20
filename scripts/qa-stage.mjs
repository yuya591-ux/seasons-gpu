// 主ボタンの段階化を実UIで確認: 窓をあける→乗り出す→空へ→おりる と一歩ずつ進むか。
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
const tapStage = () => page.evaluate(() => document.querySelector('.iconbtn--stage').click())
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `scripts/_shots/${name}.png` }) }
const labels = async () => page.evaluate(() => {
  const s = document.querySelector('.iconbtn--stage'); const b = document.querySelector('.iconbtn--back'); const m = document.querySelector('.modepill')
  return { stage: s && s.style.display !== 'none' ? s.textContent : '(hidden)', back: b && b.style.display !== 'none' ? b.textContent : '(hidden)', mode: m ? m.textContent : '' }
})
console.log('初期:', JSON.stringify(await labels()))
await shot('stage-0')
await tapStage(); console.log('1歩:', JSON.stringify(await labels())); await shot('stage-1')
await tapStage(); console.log('2歩:', JSON.stringify(await labels())); await shot('stage-2')
await tapStage(); await page.waitForTimeout(900); console.log('3歩:', JSON.stringify(await labels())); await shot('stage-3')
console.log('stage shots done')
await browser.close()
