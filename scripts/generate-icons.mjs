import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, '../assets/images');

// Black background, gold measuring tape — minimal
function makeSVG(size) {
  const cx = size / 2;
  const cy = size / 2;
  const rulerW = size * 0.66;
  const rulerH = size * 0.13;
  const rx = size * 0.065;
  const rulerX = cx - rulerW / 2;
  const rulerY = cy - rulerH / 2;
  const gold = '#C9A84C';
  const tickCount = 16;
  const tickSpacing = rulerW / tickCount;
  const tallTick = rulerH * 0.58;
  const shortTick = rulerH * 0.32;

  let ticks = '';
  for (let i = 1; i < tickCount; i++) {
    const x = rulerX + i * tickSpacing;
    const isMajor = i % 4 === 0;
    const tickH = isMajor ? tallTick : shortTick;
    ticks += `<line x1="${x}" y1="${rulerY + rulerH * 0.08}" x2="${x}" y2="${rulerY + rulerH * 0.08 + tickH}" stroke="${gold}" stroke-width="${size * 0.007}" stroke-linecap="round"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#0A0A0A"/>

  <!-- Ruler body fill -->
  <rect x="${rulerX}" y="${rulerY}" width="${rulerW}" height="${rulerH}"
    rx="${rx}" ry="${rx}" fill="${gold}" opacity="0.10"/>

  <!-- Ruler border -->
  <rect x="${rulerX}" y="${rulerY}" width="${rulerW}" height="${rulerH}"
    rx="${rx}" ry="${rx}" fill="none" stroke="${gold}" stroke-width="${size * 0.011}"/>

  <!-- Tick marks -->
  ${ticks}

  <!-- Right pull-tab (solid gold circle) -->
  <circle cx="${rulerX + rulerW - rx * 0.5}" cy="${cy}" r="${rulerH * 0.38}" fill="${gold}"/>
</svg>`;
}

async function generate(svgStr, outPath, size) {
  await sharp(Buffer.from(svgStr))
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`✓ ${outPath} (${size}x${size})`);
}

await generate(makeSVG(1024), `${out}/icon.png`, 1024);
await generate(makeSVG(1024), `${out}/splash-icon.png`, 1024);
await generate(makeSVG(1024), `${out}/android-icon-foreground.png`, 1024);
await generate(makeSVG(1024), `${out}/android-icon-monochrome.png`, 1024);
await generate(makeSVG(48),   `${out}/favicon.png`, 48);

console.log('\nAll icons generated!');
