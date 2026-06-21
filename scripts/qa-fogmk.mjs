import { chromium } from "playwright"
const port = process.env.PORT || "4801"
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 590, height: 280 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: "networkidle" })
await p.locator(".gate").click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene("kitaterao-window-3d"))
await p.waitForTimeout(2400)
await p.evaluate(() => { window.__town3dFly(true) })
await p.evaluate(() => { window.__town3dCruise(false) })
const shot = async (x,y,z,yaw,pit,name,vw,vh) => { if(vw){ await p.setViewportSize({width:vw,height:vh}) } await p.evaluate(([x,y,z,ya,pi]) => window.__town3dFlyPose(x,y,z,ya,pi),[x,y,z,yaw,pit]); await p.waitForTimeout(800); await p.screenshot({ path: `scripts/_shots/${name}.png` }) }
// 飛行中の海(高度あり・ユーザー画像に近い)＝近距離がくっきりか
await shot(300, 42, -44, Math.PI/2, -0.12, "fog-flight")
// 戦国の渡り(北)＝鳥居/光点/島が無いか
await p.setViewportSize({width:440,height:900})
await shot(140, 40, -360, 0, -0.06, "nomk-sengoku")
// 大正の渡り(西)＝灯標/光点/島が無いか
await shot(-400, 40, -30, -Math.PI/2, -0.06, "nomk-taisho")
// 江戸の渡り(東)＝澪標/光点/島は残る
await shot(380, 40, -44, Math.PI/2, -0.06, "nomk-edo")
await b.close()
