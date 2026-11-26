import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(new URL('../out/package.json', import.meta.url));
const QRCode = require('qrcode');
const sharp = require('sharp');
const jsQR = require('jsqr');
const zx = require('@zxing/library');
const font = require('fontkit').openSync(path.join(here, '../assets/PEYDA-MEDIUM.TTF'));
const upper = 'HTTPS://CATALOG.PERSIANPARTSHOP.IR/Q/K7XP2MQA';
const red = '#ae0f17', black = '#14120f';
const designs = [
  {name:'Catalog plate', foot:10, eye:'A', cells:'square', caption:'مشخصات و قیمت محصول', line:33},
  {name:'Cut tile', foot:11, eye:'D', cells:'liquid', caption:'قیمت و ویژگی‌های محصول', line:34},
  {name:'Inscribed rule', foot:10, eye:'A', cells:'round', caption:'مشخصات و قیمت محصول', line:29},
  {name:'Price nameplate', foot:12, eye:'E', cells:'square', caption:'قیمت محصول را مشاهده کنید', line:35},
  {name:'Open corners', foot:11, eye:'B', cells:'dots', caption:'قیمت و ویژگی‌های محصول', line:34}
];
const rect = (x,y,w,r=0,fill='currentColor') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="${r}" fill="${fill}"/>`;

// Clockwise corners with independent radii.
function contour(x,y,w,[a,b,c,d]) {
  return `M${x+a} ${y}H${x+w-b}q${b} 0 ${b} ${b}V${y+w-c}q0 ${c} -${c} ${c}H${x+d}q-${d} 0 -${d} -${d}V${y+a}q0 -${a} ${a} -${a}Z`;
}
function liquidCell(x,y,on) {
  const neighbors = [on(x,y-1),on(x+1,y),on(x,y+1),on(x-1,y)];
  if(on(x,y)) return contour(x,y,1,neighbors.map((v,i)=>v || neighbors[(i+3)%4] ? 0 : .43));
  let d = '';
  for (const [i,cx,cy,sx,sy] of [[0,x,y,1,1],[1,x+1,y,-1,1],[2,x+1,y+1,-1,-1],[3,x,y+1,1,-1]]) {
    if(neighbors[i] && neighbors[(i+3)%4] && on(x-sx,y-sy))
      d += `M${cx} ${cy}h${sx*.32}q${-sx*.32} 0 ${-sx*.32} ${sy*.32}Z`;
  }
  return d;
}
function finder(id,x,y,rotation) {
  let body = '';
  for(const [inset,w,fill] of [[0,7,'currentColor'],[1,5,'white'],[2,3,'currentColor']]) {
    if(id==='D') {
      const k=w*(inset===2?.23:.14);
      body += `<path transform="translate(${inset} ${inset})" fill="${fill}" d="M${k} 0H${w-k}L${w} ${k}V${w-k}L${w-k} ${w}H${k}L0 ${w-k}V${k}Z"/>`;
    } else {
      const r=w*(id==='B'?.44:id==='E'?.32:.22);
      body += `<path fill="${fill}" d="${contour(inset,inset,w,[r,r,id==='B'?.12:r,r])}"/>`;
    }
  }

  return `<g transform="translate(${x} ${y}) rotate(${rotation} 3.5 3.5)">${body}</g>`;
}
async function distort(img,kind) {
  const {data,info:{width:w,height:h}}=await sharp(img).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const out=Buffer.alloc(data.length,255);
  let seed=4217;
  const random=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)+1)/4294967297;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const p=(y*w+x)*3;
    if(kind==='noise') {
      const delta=8*Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());
      for(let c=0;c<3;c++) out[p+c]=Math.min(255,Math.max(0,Math.round(data[p+c]+delta)));
    } else {
      // Inverse homography to a centered trapezoid, 90% top width and 100% base.
      const v=y/(h-1), scale=.9+.1*v;
      const sx=(x-(w-1)*(1-scale)/2)/scale, sy=(h-1)*v/scale;
      if(sx<0 || sx>w-1) continue;
      const ix=Math.floor(sx), iy=Math.floor(sy), fx=sx-ix, fy=sy-iy;
      for(let c=0;c<3;c++) {
        const at=(dx,dy)=>data[(Math.min(h-1,iy+dy)*w+Math.min(w-1,ix+dx))*3+c];
        out[p+c]=Math.round((1-fy)*((1-fx)*at(0,0)+fx*at(1,0))+fy*((1-fx)*at(0,1)+fx*at(1,1)));
      }
    }
  }
  return sharp(out,{raw:{width:w,height:h,channels:3}}).png().toBuffer();
}
async function decode(buf) {
  const {data,info:{width,height}}=await sharp(buf).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const result=jsQR(new Uint8ClampedArray(data.buffer,data.byteOffset,data.length),width,height,{inversionAttempts:'dontInvert'});
  const gray=new Uint8ClampedArray(width*height);
  for(let i=0;i<gray.length;i++) gray[i]=(data[i*4]*306+data[i*4+1]*601+data[i*4+2]*117)>>10;
  let other;
  try {
    other=new zx.QRCodeReader().decode(new zx.BinaryBitmap(new zx.HybridBinarizer(new zx.RGBLuminanceSource(gray,width,height)))).getText();
  } catch(error) { if(!['NotFoundException','ChecksumException','FormatException'].includes(error.constructor.name)) throw error; }
  return [result?.data,other].map(s=>s===upper?'PASS':s?'WRONG':'FAIL');
}
function contrast(rgb) {
  const lin=rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return 1.05/(.05+lin[0]*.2126+lin[1]*.7152+lin[2]*.0722);
}
function captionArt(text, width, centerX, centerY, fill) {
  const run = font.layout(text, undefined, 'arab', 'FAR ', 'rtl');
  const box = run.bbox;
  const scale = width / (box.maxX - box.minX);
  const x = centerX - (box.minX + box.maxX) * scale / 2;
  const y = centerY + (box.minY + box.maxY) * scale / 2;
  let cursor = 0;
  const paths = run.glyphs.map((glyph, i) => {
    const pos = run.positions[i];
    const d = glyph.path.toSVG();
    const part = d ? `<path transform="translate(${cursor+pos.xOffset} ${pos.yOffset})" d="${d}"/>` : '';
    cursor += pos.xAdvance;
    return part;
  });
  return {svg:`<g fill="${fill}" transform="translate(${x} ${y}) scale(${scale} ${-scale})">${paths.join('')}</g>`,
    height:(box.maxY-box.minY)*scale, body:font.layout('ـسـ').bbox.maxY*scale};
}


// --- Kashida (tatweel) justification -------------------------------------
const TATWEEL = 'ـ';
const DUAL_JOIN = new Set([...'بپتثجچحخسشصضطظعغفقکگلمنهیئ']);
const isLetter = ch => !!ch && /[ء-يٱ-ۓ]/.test(ch);
const shape = text => font.layout(text, undefined, 'arab', 'FAR ', 'rtl');
const inkWidth = text => { const b = shape(text).bbox; return b.maxX - b.minX; };

// Words keep at most one tatweel per round; longest words and mid-word joins first.
export function justifyKashida(text, targetUnits) {
  const words = text.split(' ').map(w => ({ w, adds: [] }));
  const candidates = w => {
    const out = [];
    for (let i = 0; i < w.length - 1; i++) if (DUAL_JOIN.has(w[i]) && isLetter(w[i+1]) && w[i+1] !== TATWEEL) out.push(i + 1);
    return out.sort((a, b) => Math.abs(a - w.length / 2) - Math.abs(b - w.length / 2));
  };
  const build = () => words.map(({ w, adds }) => {
    let r = '';
    for (let i = 0; i < w.length; i++) { r += w[i]; r += TATWEEL.repeat(adds.filter(a => a === i + 1).length); }
    return r;
  }).join(' ');
  const order = [...words.keys()].sort((a, b) => words[b].w.length - words[a].w.length);
  const perWord = words.map(({ w }) => candidates(w));
  let text2 = text;
  for (let round = 0; round < 6; round++) {
    for (const i of order) {
      if (!perWord[i].length) continue;
      const trial = words[i].adds.concat(perWord[i][round % perWord[i].length]);
      const prev = words[i].adds; words[i].adds = trial;
      const candidate = build();
      if (inkWidth(candidate) > targetUnits + 40) { words[i].adds = prev; return build(); }
      text2 = candidate;
    }
  }
  return text2;
}

function textLine(text, scale, centerX, topY, fill) {
  const run = shape(text), box = run.bbox;
  const x = centerX - (box.minX + box.maxX) * scale / 2;
  const baseline = topY + box.maxY * scale;
  let cursor = 0;
  const paths = run.glyphs.map((glyph, i) => {
    const pos = run.positions[i], d = glyph.path.toSVG();
    const part = d ? `<path transform="translate(${cursor + pos.xOffset} ${pos.yOffset})" d="${d}"/>` : '';
    cursor += pos.xAdvance; return part;
  });
  return {svg: `<g fill="${fill}" transform="translate(${x} ${baseline}) scale(${scale} ${-scale})">${paths.join('')}</g>`,
    height: (box.maxY - box.minY) * scale, width: (box.maxX - box.minX) * scale};
}

// Two-line justified block: headline (larger) + instruction sentence, both exactly `width` modules wide.
function captionBlock(lines, width, centerX, topY, gap, fill) {
  const [head, sentence] = lines;
  const sScale = width / inkWidth(sentence.text);   // sentence at natural width
  const hScale = sScale * head.size;                // headline size factor
  const headText = justifyKashida(head.text, width / hScale);
  const hFinal = width / inkWidth(headText);        // tiny uniform correction so edges land exactly
  const a = textLine(headText, hFinal, centerX, topY, fill);
  const b = textLine(sentence.text, sScale, centerX, topY + a.height + gap, fill);
  return {svg: a.svg + b.svg, height: a.height + gap + b.height, headText,
    headScale: hFinal, sentenceScale: sScale, headWidth: a.width, sentenceWidth: b.width};
}

// ---------------------------------------------------------------------------
// Final template: "Cut tile", 60 mm wide. Every spacing is expressed in QR modules.
// One clear-space rule G governs the whole sticker:
//   border ↔ code (left, right, top) = G
//   code ↔ caption ink                = G
//   caption ink ↔ border (bottom)     = G
// G >= 4 modules keeps the QR quiet zone clean on every side.
// ---------------------------------------------------------------------------
export const TEMPLATE = {
  stickerWidthMm: 60,
  stroke: .30,      // border rule width (modules)
  cut: .65,         // cut line -> border centerline (modules)
  G: 3,             // universal clear space (modules)
  chamfer: 2.0,     // corner clip (modules)
  captionWidth: 33, // equals code width: caption edges align with the outer finder edges
  lines: [
    {text: 'قیمت و ویژگی‌های کالا', size: 1.5},
    {text: 'برای مشاهدهٔ جزئیات کامل، اسکن کنید', size: 1}
  ],
  lineGap: 1.2,    // modules between the two lines
  stickerHeightMm: 80 // exact sticker height; vertical gaps Gv are solved to hit it
};

export function templateArtwork(payload, opts = {}) {
  const t = {...TEMPLATE, ...opts};
  const {modules} = QRCode.create(payload,{errorCorrectionLevel:'H'});
  const n = modules.size;
  const innerPad = t.cut + t.stroke / 2;          // cut -> inner edge of border ink
  const w = n + 2 * (innerPad + t.G);             // side gap = G
  const mm = t.stickerWidthMm / w;
  const capArt = captionBlock(t.lines, t.captionWidth, w / 2, 0, t.lineGap, black); // height only
  // Vertical gaps (top, code->caption, caption->bottom) are equal to each other: Gv.
  // With stickerHeightMm set, Gv is solved so the sticker is exactly that tall.
  const fixed = 2 * innerPad + n + capArt.height;
  const hTarget = t.stickerHeightMm ? t.stickerHeightMm / mm : fixed + 3 * t.G;
  const Gv = (hTarget - fixed) / 3;
  if (Gv < t.G) throw new RangeError('Sticker height too small for the content');
  const qx = innerPad + t.G, qy = innerPad + Gv;
  const capTop = qy + n + Gv;                     // top of caption ink
  const capBottom = capTop + capArt.height;
  const h = hTarget;
  const cap = captionBlock(t.lines, t.captionWidth, w / 2, capTop, t.lineGap, black);
  const a = t.cut, b = w - a, z = h - a, k = t.chamfer;
  const border = `<g fill="none" stroke="${red}" stroke-width="${t.stroke}" stroke-linejoin="round"><path d="M${a+k} ${a}H${b-k}l${k} ${k}V${z-k}l-${k} ${k}H${a+k}l-${k} -${k}V${a+k}Z"/></g>`;
  const eyes = [[0,0,0],[n-7,0,90],[0,n-7,-90]];
  const on = (x,y) => x>=0 && y>=0 && x<n && y<n && modules.get(y,x);
  let cells = '', liquid = '';
  for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
    if(eyes.some(([ex,ey])=>x>=ex && x<ex+7 && y>=ey && y<ey+7)) continue;
    if(!modules.isReserved(y,x)) liquid += liquidCell(x,y,on);
    else if(on(x,y)) cells += rect(x,y,1);
  }
  const content = `<rect width="${w}" height="${h}" fill="white"/>${border}<g transform="translate(${qx} ${qy})"><g color="${black}" fill="${black}">${cells}<path d="${liquid}"/></g><g color="${red}">${eyes.map(e=>finder('D',...e)).join('')}</g></g>${cap.svg}`;
  return {w, h, n, qx, qy, Gv, capTop, capBottom, cap, content, mm,
    heightMm: h * mm, moduleMm: mm};
}

export async function renderTemplate(payload, {pixelsPerMm = 40, ...opts} = {}) {
  const a = templateArtwork(payload, opts);
  const W = Math.round(a.w * a.mm * pixelsPerMm), H = Math.round(a.h * a.mm * pixelsPerMm);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${a.w} ${a.h}">${a.content}</svg>`;
  return {a, png: await sharp(Buffer.from(svg)).flatten({background:'white'}).removeAlpha().withIccProfile('srgb').withMetadata({density: Math.round(pixelsPerMm*25.4)}).png().toBuffer()};
}

async function main() {
  const variants = [['final', {}]];
  for (const [name, opts] of variants) {
    const {a, png} = await renderTemplate(upper, opts);
    await fs.writeFile(path.join(here, `template-${name}.png`), png);
    console.log(name, `${a.w.toFixed(2)} x ${a.h.toFixed(2)} modules = 60 x ${a.heightMm.toFixed(2)} mm; module ${a.moduleMm.toFixed(3)} mm; caption block ${(a.cap.height*a.mm).toFixed(2)} mm tall; headline scale ${a.cap.headScale.toFixed(4)} sentence scale ${a.cap.sentenceScale.toFixed(4)} (x${(a.cap.headScale/a.cap.sentenceScale).toFixed(2)}); headline text ${JSON.stringify(a.cap.headText)}`);
    const meta = await sharp(png).metadata();
    const small = await sharp(png).resize(354).png().toBuffer(), tiny = await sharp(png).resize(236).png().toBuffer();
    const cases = [['full',png],['3cm',small],['2cm',tiny],['blur',await sharp(small).blur(1).png().toBuffer()],['gray',await sharp(small).grayscale().png().toBuffer()],
      ['rot-8',await sharp(small).rotate(-8,{background:'white'}).png().toBuffer()],['rot+8',await sharp(small).rotate(8,{background:'white'}).png().toBuffer()],
      ['persp',await distort(small,'perspective')],['jpeg60',await sharp(small).jpeg({quality:60}).toBuffer()],['dim',await sharp(small).linear(.6).png().toBuffer()],['noise',await distort(small,'noise')]];
    console.log(' ', meta.width, 'x', meta.height, 'px', (await Promise.all(cases.map(async([k,b])=>`${k}:${(await decode(b)).join('/')}`))).join(' '));
  }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await main();
