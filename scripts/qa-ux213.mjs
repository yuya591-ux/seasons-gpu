import { chromium } from 'playwright'
import fs from 'node:fs'
const PORT = process.env.PORT || 4931
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch()
const errs = []
// 1) 縦持ちでギャラリーを開く＝現在の情景カードが画面内に来ているか
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
p.on('pageerror', e => errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await p.locator('.gate').click().catch(() => {}); await p.waitForTimeout(1200)
await p.mouse.move(195, 300); await p.mouse.move(195, 420); await p.waitForTimeout(300)
await p.locator('button:has-text("情景")').first().click().catch(() => {}); await p.waitForTimeout(900)
await p.screenshot({ path: `${OUT}\\ux213-gallery.png` }); console.log('gallery (現在カードが見える位置へ)')
const onCard = await p.locator('.scene-card--on').first().boundingBox().catch(() => null)
console.log('current card box =', onCard ? `y=${Math.round(onCard.y)} h=${Math.round(onCard.height)} (viewport 844)` : 'none')
await p.close()
// 2) 横持ち（低い画面）で上部の混み具合
const l = await b.newPage({ viewport: { width: 844, height: 414 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
l.on('pageerror', e => errs.push(e.message))
await l.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await l.locator('.gate').click().catch(() => {}); await l.waitForTimeout(1200)
await l.mouse.move(420, 200); await l.mouse.move(420, 300); await l.waitForTimeout(300)
await l.screenshot({ path: `${OUT}\\ux213-landscape.png` }); console.log('landscape top')
await l.close()
console.log(errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'no err')
await b.close()
