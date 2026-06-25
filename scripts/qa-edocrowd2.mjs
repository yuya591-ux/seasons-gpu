import { chromium } from 'playwright'
import fs from 'node:fs'
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:520,height:480}, deviceScaleFactor:2 })
await p.goto('http://localhost:4920/seasons/?dev=1',{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFlyPose(614,14,-10,Math.PI,-0.2)).catch(()=>{}); await p.waitForTimeout(1800)
const gy=await p.evaluate(()=>window.__town3dGroundAt(614,-28)).catch(()=>5)
// 市の中心を斜め上から見下ろし＝人を捉えやすい
const u=await p.evaluate(a=>window.__town3dShotAt(...a),[614,(gy||5)+5,-14, 614,(gy||5)+0.6,-30, 40])
if(u&&u.startsWith('data:image')) fs.writeFileSync('C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots\\edocrowd2.png', Buffer.from(u.split(',')[1],'base64'))
console.log('done gy='+gy)
await b.close()
