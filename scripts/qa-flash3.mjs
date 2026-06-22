import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 500 } })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-rain-night'))
await p.waitForTimeout(2800)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(700)
// 発火→数フレームにわたりオーバーレイ不透明度を記録（立ち上がり→減衰が見えるか）
const readOp = () => p.evaluate(() => { const el = document.querySelector('.town3d-flash'); return el ? +(el.style.opacity||0) : null })
await p.evaluate(() => window.__town3dFlash(1))
const samples = []
for (let i=0;i<8;i++){ samples.push(await readOp()); await p.waitForTimeout(70) }
console.log('flash opacity over time:', samples.join(' '))
await b.close()
