import { chromium } from "playwright"
const port = process.env.PORT || "4801"
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: "networkidle" })
await p.locator(".gate").click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene("kitaterao-window-3d"))
await p.waitForTimeout(2400)
await p.evaluate(() => { window.__town3dFly(true) })
await p.evaluate(() => { window.__town3dCruise(false) })
const shot = async (x,y,z,yaw,pit,name) => { await p.evaluate(([x,y,z,ya,pi]) => window.__town3dFlyPose(x,y,z,ya,pi),[x,y,z,yaw,pit]); await p.waitForTimeout(1400); await p.screenshot({ path: `scripts/_shots/${name}.png` }) }
// 路面電車の線路(z=-30,x[-730,-550])を真上ぎみで広く＝電車が線路上にあるか
await shot(-640, 40, -30, Math.PI/2, -0.6, "aud2-tram")
// 待って動く位置も
await shot(-640, 40, -30, Math.PI/2, -0.6, "aud2-tram2")
// home湾: 島・大橋・灯台
await shot(95, 30, -50, -Math.PI/2, -0.2, "aud2-bay")
// home砂浜
await shot(64, 14, -36, Math.PI/2, -0.05, "aud2-beach")
// home駅
await shot(34, 16, -34, 0, -0.08, "aud2-station")
// home遊園地(観覧車)
await shot(-26, 18, -52, 0, -0.08, "aud2-fun")
console.log("audit2 done")
await b.close()
