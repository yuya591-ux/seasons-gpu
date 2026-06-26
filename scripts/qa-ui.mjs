import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(3000)
// 1) 既定の窓辺ビュー（UI込み）
await p.screenshot({ path:'ui-window.png' }); console.log('window')
// 2) 情景メニューを開く
await p.locator('button:has-text("情景")').first().click().catch(()=>{}); await p.waitForTimeout(900)
await p.screenshot({ path:'ui-scenes.png' }); console.log('scenes')
await p.keyboard.press('Escape').catch(()=>{}); await p.waitForTimeout(400)
// 3) 設定パネルを開く
await p.locator('button:has-text("設定")').first().click().catch(()=>{}); await p.waitForTimeout(900)
await p.screenshot({ path:'ui-settings.png' }); console.log('settings')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
