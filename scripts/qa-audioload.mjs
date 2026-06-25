import { chromium } from 'playwright'
// 差し替えた音素材が実際に200で読まれ、音場が立ち上がるかを確認（旗艦＋秋の角部屋）。
const PORT = process.env.PORT || 4920
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 460, height: 880 } })
const errs = []; const audioReq = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 120)) })
page.on('response', (r) => { const u = r.url(); if (u.includes('/audio/') && u.endsWith('.mp3')) audioReq.push(r.status() + ' ' + u.split('/audio/')[1]) })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
for (const id of ['summer-rain-dusk', 'autumn-dusk-corner-room', 'spring-dusk-corner-room']) {
  await page.evaluate((s) => window.__applyScene(s), id).catch(() => {})
  await page.waitForTimeout(2500)
  console.log('--- scene:', id)
}
await page.waitForTimeout(800)
console.log('audio読み込み:')
for (const a of [...new Set(audioReq)]) console.log('  ', a)
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0, 6)) : 'コンソールエラー無し')
await browser.close()
