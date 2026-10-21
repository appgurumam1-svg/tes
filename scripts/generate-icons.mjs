import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const BG = '#4f46e5';
const BG_DARK = '#4338ca';

function svg(size, withPadding = false) {
  const pad = withPadding ? size * 0.12 : size * 0.06;
  const inner = size - pad * 2;
  const scale = inner / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6d67f5"/>
      <stop offset="1" stop-color="${BG_DARK}"/>
    </linearGradient>
  </defs>
  ${withPadding ? `<rect width="${size}" height="${size}" fill="${BG}"/>` : ''}
  <rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${inner * 0.24}" fill="url(#g)"/>
  <g transform="translate(${pad} ${pad}) scale(${scale})" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/>
    <path d="M10.5 19a2 2 0 0 0 3 0"/>
  </g>
</svg>`;
}

await mkdir('public/icons', { recursive: true });

for (const size of [192, 512]) {
  await sharp(Buffer.from(svg(size))).png().toFile(`public/icons/icon-${size}.png`);
}
await sharp(Buffer.from(svg(512, true))).png().toFile('public/icons/maskable-512.png');
await sharp(Buffer.from(svg(180))).png().toFile('public/icons/apple-touch-icon.png');
await sharp(Buffer.from(svg(32))).png().toFile('public/favicon.png');

console.log('icons generated');
