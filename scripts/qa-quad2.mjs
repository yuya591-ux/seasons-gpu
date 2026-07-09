// 新しい動物ビルダー(猫/犬/馬)の隔離接写＝造形の確認（前3/4・真横）
import { chromium } from 'playwright'
import fs from 'node:fs'
const port = process.env.PORT || '4890'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 } })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2000)
const save = (du, name) => { if (!du) { console.log('SHOT失敗:', name); return } fs.writeFileSync(`scripts/_shots/quad2-${name}.png`, Buffer.from(du.split(',')[1], 'base64')) }
save(await page.evaluate(() => window.__town3dQuadShot(0x8a7a5a, 0.55, 5.6, 'cat')), 'cat-front')
save(await page.evaluate(() => window.__town3dQuadShot(0x5a5a5e, 0.55, 0.8, 'cat')), 'cat-side')
save(await page.evaluate(() => window.__town3dQuadShot(0xc8c0b4, 0.6, 5.6, 'dog')), 'dog-front')
save(await page.evaluate(() => window.__town3dQuadShot(0xc8c0b4, 0.6, 0.8, 'dog')), 'dog-side')
save(await page.evaluate(() => window.__town3dQuadShot(0x5a4030, 1.1, 5.6, 'horse')), 'horse-front')
save(await page.evaluate(() => window.__town3dQuadShot(0x5a4030, 1.1, 0.8, 'horse')), 'horse-side')
await browser.close()
console.log('quad2 done')
