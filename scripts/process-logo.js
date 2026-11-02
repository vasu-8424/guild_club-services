const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const srcImage = 'C:/Users/admin/.gemini/antigravity/brain/237e4596-e969-448f-b5d4-4fa509b8dbc3/.user_uploaded/media_1793637780975_ecfad847.jpg';

async function main() {
  console.log('Reading source image:', srcImage);

  // We want to center on the circular medallion
  // Center: (512, 333), size ~564
  const size = 564;
  const left = Math.round(512 - size / 2);
  const top = Math.round(333 - size / 2);

  console.log(`Extracting square: left=${left}, top=${top}, size=${size}`);

  // 1. Raw square crop (with background intact for square icons / cards)
  const squareCrop = await sharp(srcImage)
    .extract({ left, top, width: size, height: size })
    .png()
    .toBuffer();

  // 2. Circular masked version with transparent background
  const radius = Math.floor(size / 2) - 2;
  const circleSvg = `<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="white"/></svg>`;
  const circleMask = Buffer.from(circleSvg);

  const circularBuffer = await sharp(squareCrop)
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Save primary web assets
  await sharp(circularBuffer)
    .resize(512, 512)
    .png()
    .toFile('public/logo.png');

  await sharp(circularBuffer)
    .resize(512, 512)
    .png()
    .toFile('public/icon-512.png');

  await sharp(circularBuffer)
    .resize(192, 192)
    .png()
    .toFile('public/icon-192.png');

  await sharp(circularBuffer)
    .resize(180, 180)
    .png()
    .toFile('public/apple-touch-icon.png');

  await sharp(circularBuffer)
    .resize(64, 64)
    .png()
    .toFile('public/favicon.png');

  await sharp(circularBuffer)
    .resize(32, 32)
    .toFile('public/favicon.ico');

  // Also save a bordered / badge version for places where a dark circular badge is needed
  await sharp(squareCrop)
    .resize(512, 512)
    .png()
    .toFile('public/logo-square.png');

  console.log('Web & PWA logo assets generated successfully.');

  // Android mipmap generation
  const androidMipmaps = [
    { dir: 'mipmap-mdpi', launcher: 48, fg: 108 },
    { dir: 'mipmap-hdpi', launcher: 72, fg: 162 },
    { dir: 'mipmap-xhdpi', launcher: 96, fg: 216 },
    { dir: 'mipmap-xxhdpi', launcher: 144, fg: 324 },
    { dir: 'mipmap-xxxhdpi', launcher: 192, fg: 432 },
  ];

  for (const m of androidMipmaps) {
    const targetDir = path.join('android/app/src/main/res', m.dir);
    if (!fs.existsSync(targetDir)) continue;

    // ic_launcher.png (Square / standard)
    await sharp(squareCrop)
      .resize(m.launcher, m.launcher)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // ic_launcher_round.png (Circular)
    await sharp(circularBuffer)
      .resize(m.launcher, m.launcher)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png (Adaptive icon foreground: centered circular logo with transparent padding)
    // Foreground size is typically larger (e.g. 108x108 with the 72x72 emblem centered)
    const fgLogoSize = Math.round(m.fg * 0.72);
    const resizedLogo = await sharp(circularBuffer)
      .resize(fgLogoSize, fgLogoSize)
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: m.fg,
        height: m.fg,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: resizedLogo, gravity: 'center' }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`Generated Android ${m.dir} icons (launcher: ${m.launcher}x${m.launcher}, fg: ${m.fg}x${m.fg})`);
  }

  console.log('All icons and logos processed successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
