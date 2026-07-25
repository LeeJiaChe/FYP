const fs = require('fs');
const path = require('path');

// 1x1 blue PNG pixel buffer converted to valid PNG structure for fallback icon
const minimalPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), minimalPng);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), minimalPng);
console.log("PWA icon assets created in /public");
