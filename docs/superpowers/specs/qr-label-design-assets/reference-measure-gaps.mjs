import { createRequire } from 'node:module'
const require = createRequire(new URL('../out/package.json', import.meta.url))
const sharp = require('sharp')
const { data, info } = await sharp('approved-template-60x80mm.png').raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H, channels: C } = info
const mod = W / 40.6
const dark = (x, y) => { const p = (y * W + x) * C; return data[p] < 128 || data[p+1] < 128 }
const inside = [Math.round(mod * 3.5), Math.round(W - mod * 3.5)] // x range inside border (avoid chamfer & rule)
const rowInk = y => { for (let x = inside[0]; x < inside[1]; x++) if (dark(x, y)) return true; return false }
const colInk = (x, y0, y1) => { for (let y = y0; y < y1; y++) if (dark(x, y)) return true; return false }
// rows of ink inside the interior (skip the top/bottom rule: find rows after the rule)
const rows = []; for (let y = Math.round(mod * 1.2); y < H - Math.round(mod * 1.2); y++) rows.push(rowInk(y))
const off = Math.round(mod * 1.2)
const first = rows.indexOf(true) + off, last = rows.lastIndexOf(true) + off
// code bottom = last row before large blank band
let gapStart = -1, gapEnd = -1
for (let y = first; y <= last; y++) { if (!rowInk(y)) { let e = y; while (e <= last && !rowInk(e)) e++; if (e - y > mod * 2) { gapStart = y; gapEnd = e; } y = e } }
console.log('mod px', mod.toFixed(2))
console.log('top: border inner -> code', ((first - Math.round(mod*0.8)) / mod).toFixed(2), 'mod')
console.log('code -> caption', ((gapEnd - gapStart) / mod).toFixed(2), 'mod')
console.log('caption -> border inner', ((H - Math.round(mod*0.8) - last - 1) / mod).toFixed(2), 'mod')
// sides
let left = W, right = 0
for (let y = first; y < gapStart; y++) for (let x = Math.round(mod*1.2); x < W - Math.round(mod*1.2); x++) if (dark(x, y) && Math.abs(x-mod*.65)>mod*.6 && Math.abs(x-(W-mod*.65))>mod*.6) { left = Math.min(left, x); right = Math.max(right, x) }
console.log('left border inner -> code', ((left - Math.round(mod*0.8)) / mod).toFixed(2), 'right', ((W - Math.round(mod*0.8) - right - 1) / mod).toFixed(2))
