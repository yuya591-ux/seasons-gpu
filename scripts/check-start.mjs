// 起動時に「いま」が3Dの街を選ぶか、ギャラリー先頭が3Dの街か、エラー無しかを確認。
import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 440, height: 900 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.goto('http://localhost:4790/seasons/?dev=1', { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(3500)
const info = await p.evaluate(() => ({
  town3d: !!document.querySelector('.town3d-stage'),
  label: document.querySelector('.hud__scene')?.textContent,
  firstCard: document.querySelector('.scene-card .scene-card__label')?.textContent,
}))
console.log('起動時3D町:', info.town3d, '| 情景名:', info.label, '| ギャラリー先頭:', info.firstCard)
console.log(errs.length ? ('エラー:' + JSON.stringify(errs.slice(0, 4))) : 'エラー無し ✓')
await b.close()
