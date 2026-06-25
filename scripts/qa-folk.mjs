import { chromium } from 'playwright'
import fs from 'node:fs'
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:520,height:480}, deviceScaleFactor:2 })
await p.goto('http://localhost:4920/seasons/?dev=1',{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFlyPose(150,16,-560,Math.PI,-0.2)).catch(()=>{}); await p.waitForTimeout(1800)
// 戦国の街道の旅人を間近で（谷は開けていて捉えやすい）。街道は sx+cl+4.8 沿い
const u=await p.evaluate(a=>window.__town3dShotAt(...a),[150,8,-600, 145,6.5,-625, 26])
if(u&&u.startsWith('data:image')) fs.writeFileSync('C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots\\sengoku-folk.png', Buffer.from(u.split(',')[1],'base64'))
console.log('done')
await b.close()
