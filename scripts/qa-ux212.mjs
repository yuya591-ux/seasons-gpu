import { chromium } from 'playwright'
import fs from 'node:fs'
const PORT = process.env.PORT || 4931
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
// 1) ゲート（機能予告は立体の街でだけ。起動シーンに依存するので有無を報告）
await p.waitForTimeout(700)
const teaser = await p.locator('.gate__teaser').count()
console.log('gate teaser count =', teaser)
await p.locator('.gate').click().catch(() => {}); await p.waitForTimeout(1200)
// HUDが自動で隠れる(body.idle→pointer-events:none)ので、押す前に必ず poke する小ヘルパ
const wake = async () => { await p.mouse.move(195, 300); await p.mouse.move(195, 420); await p.waitForTimeout(250) }
// 情景パネルから「立体の街」を選ぶ＝UIのcurrentSceneが更新され canFly()=true になる（__applySceneはUI状態を更新しないため）
await wake(); await p.locator('button:has-text("情景")').first().click().catch(() => {}); await p.waitForTimeout(800)
await p.locator('text=北寺尾の窓辺、立体の街').first().click().catch(() => {}); await p.waitForTimeout(3000)
const tapStage = async () => { await wake(); await p.locator('.iconbtn--stage').first().click({ force: true }).catch(() => {}); await p.waitForTimeout(1600) }
// 2) 段階表示（窓辺＝●○○○）
await wake()
await p.screenshot({ path: `${OUT}\\ux212-stage0.png` }); console.log('stage0 (窓辺)')
const dots0 = await p.locator('.stagedots.stagedots--on .stagedots__d.is-on').count()
console.log('dots lit at 窓辺 =', dots0)
// 窓をあける→乗り出す→空へ と進める
await tapStage(); await tapStage(); await tapStage()
await wake()
await p.screenshot({ path: `${OUT}\\ux212-aloft.png` }); console.log('aloft (空へ＝段階満タン＋すすむ/とまる)')
const dotsA = await p.locator('.stagedots.stagedots--on .stagedots__d.is-on').count()
const cruiseSeg = await p.locator('.town3d-cruise.cruise--on .town3d-cruise__seg').count()
console.log('dots lit aloft =', dotsA, ' cruise segs =', cruiseSeg)
// 3) 地上へ降りて歩く→常駐スティック
await tapStage(); await p.waitForTimeout(1200); await wake()
await p.screenshot({ path: `${OUT}\\ux212-walk.png` }); console.log('walk (常駐スティック)')
const restStick = await p.locator('.town3d-stick.stick--rest').count()
console.log('rest stick present =', restStick)
console.log(errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'no err')
await b.close()
