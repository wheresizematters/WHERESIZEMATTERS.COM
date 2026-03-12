import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, '../assets/logos');
mkdirSync(out, { recursive: true });

const BLACK = '#0A0A0A';
const YELLOW = '#F5C518';
const WHITE = '#FFFFFF';

// ─────────────────────────────────────────────
// LOGO 1: SIZE. bold wordmark in black & yellow
// ─────────────────────────────────────────────
function logo1(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${BLACK}"/>
  <text x="${w/2}" y="${h * 0.68}"
    font-family="Arial Black, Arial, sans-serif"
    font-weight="900"
    font-size="${h * 0.55}"
    fill="${YELLOW}"
    text-anchor="middle"
    letter-spacing="${w * 0.02}">SIZE.</text>
</svg>`;
}

// ─────────────────────────────────────────────
// LOGO 2: Measuring tape shaped like a penis
// ─────────────────────────────────────────────
function logo2(w, h) {
  const cx = w / 2;
  // shaft dimensions
  const shaftW = w * 0.22;
  const shaftH = h * 0.46;
  const shaftX = cx - shaftW / 2;
  const shaftY = h * 0.34;
  const shaftRx = shaftW * 0.35;
  // head (glans) — rounded dome on top
  const headR = shaftW * 0.72;
  const headCY = shaftY + headR * 0.55;
  // base/balls — two circles at the bottom
  const ballR = shaftW * 0.58;
  const ballY = shaftY + shaftH - ballR * 0.1;
  const ballOffX = shaftW * 0.52;
  // tape color
  const tape = YELLOW;
  const tickColor = BLACK;

  // tick marks along shaft
  const tickCount = 8;
  const tickSpacing = shaftH / (tickCount + 1);
  let ticks = '';
  for (let i = 1; i <= tickCount; i++) {
    const ty = shaftY + i * tickSpacing;
    const isMajor = i % 2 === 0;
    const tickW = isMajor ? shaftW * 0.45 : shaftW * 0.28;
    ticks += `<line x1="${shaftX + shaftW * 0.05}" y1="${ty}" x2="${shaftX + shaftW * 0.05 + tickW}" y2="${ty}"
      stroke="${tickColor}" stroke-width="${w * 0.008}" stroke-linecap="round"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${BLACK}"/>

  <!-- Left ball -->
  <circle cx="${cx - ballOffX}" cy="${ballY}" r="${ballR}" fill="${tape}" opacity="0.9"/>
  <!-- Right ball -->
  <circle cx="${cx + ballOffX}" cy="${ballY}" r="${ballR}" fill="${tape}" opacity="0.9"/>

  <!-- Shaft body -->
  <rect x="${shaftX}" y="${shaftY}" width="${shaftW}" height="${shaftH}"
    rx="${shaftRx}" ry="${shaftRx}" fill="${tape}"/>

  <!-- Glans (head) dome -->
  <ellipse cx="${cx}" cy="${headCY}" rx="${headR}" ry="${headR * 0.85}" fill="${tape}"/>
  <!-- Corona ridge line -->
  <ellipse cx="${cx}" cy="${headCY + headR * 0.55}" rx="${headR * 0.88}" ry="${headR * 0.22}"
    fill="none" stroke="${tickColor}" stroke-width="${w * 0.012}" opacity="0.5"/>

  <!-- Tick marks -->
  ${ticks}

  <!-- SIZE. label at bottom -->
  <text x="${cx}" y="${h * 0.95}"
    font-family="Arial Black, Arial, sans-serif"
    font-weight="900"
    font-size="${h * 0.08}"
    fill="${YELLOW}"
    text-anchor="middle"
    letter-spacing="${w * 0.01}">SIZE.</text>
</svg>`;
}

// ─────────────────────────────────────────────
// LOGO 3: SIZE. with S replaced by measuring tape curl
// ─────────────────────────────────────────────
function logo3(w, h) {
  const tape = YELLOW;
  // The S is replaced by an SVG path that looks like a tape measure curling into an S shape
  // We'll draw it as two arcs forming an S, styled like a tape
  const sw = w * 0.18;   // S character width
  const sh = h * 0.52;   // S character height
  const sx = w * 0.08;   // S left position
  const sy = (h - sh) / 2;
  const r = sw / 2;
  const strokeW = h * 0.072;

  // S shape: top arc curves right, bottom arc curves left
  const topArcPath = `M ${sx + r} ${sy + r}
    A ${r} ${r} 0 1 0 ${sx + r} ${sy + r * 2}`;
  const bottomArcPath = `M ${sx + r} ${sy + sh - r * 2}
    A ${r} ${r} 0 1 1 ${sx + r} ${sy + sh - r}`;

  // tick marks on the S tape (just a few along the outer edge)
  const tickLen = strokeW * 0.5;

  // "IZE." text starts after the S
  const textX = sx + sw + w * 0.025;
  const textY = h * 0.685;
  const fontSize = h * 0.52;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${BLACK}"/>

  <!-- S as measuring tape curl -->
  <!-- S top arc -->
  <path d="${topArcPath}"
    fill="none" stroke="${tape}" stroke-width="${strokeW}"
    stroke-linecap="round" opacity="0.95"/>
  <!-- S bottom arc -->
  <path d="${bottomArcPath}"
    fill="none" stroke="${tape}" stroke-width="${strokeW}"
    stroke-linecap="round" opacity="0.95"/>
  <!-- tick marks overlay on S top arc -->
  <path d="${topArcPath}"
    fill="none" stroke="${BLACK}" stroke-width="${strokeW * 0.28}"
    stroke-linecap="round" stroke-dasharray="${tickLen * 0.6} ${tickLen * 2.2}"
    opacity="0.7"/>
  <!-- tick marks overlay on S bottom arc -->
  <path d="${bottomArcPath}"
    fill="none" stroke="${BLACK}" stroke-width="${strokeW * 0.28}"
    stroke-linecap="round" stroke-dasharray="${tickLen * 0.6} ${tickLen * 2.2}"
    opacity="0.7"/>

  <!-- IZE. in bold yellow -->
  <text x="${textX}" y="${textY}"
    font-family="Arial Black, Arial, sans-serif"
    font-weight="900"
    font-size="${fontSize}"
    fill="${tape}"
    text-anchor="start"
    letter-spacing="${w * 0.01}">IZE.</text>
</svg>`;
}

async function save(svg, name, w, h) {
  const path = `${out}/${name}.png`;
  await sharp(Buffer.from(svg)).resize(w, h).png().toFile(path);
  console.log(`✓ ${path}`);
}

// Generate all three at 1200x600 (landscape banner) and 1024x1024 (square icon)
const W = 1200, H = 600, S = 1024;

await save(logo1(W, H), 'logo1-wordmark-banner', W, H);
await save(logo1(S, S), 'logo1-wordmark-square', S, S);

await save(logo2(W, H), 'logo2-tape-penis-banner', W, H);
await save(logo2(S, S), 'logo2-tape-penis-square', S, S);

await save(logo3(W, H), 'logo3-s-tape-banner', W, H);
await save(logo3(S, S), 'logo3-s-tape-square', S, S);

console.log('\nAll logos generated in assets/logos/');
