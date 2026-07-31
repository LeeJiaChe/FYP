const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas");

function createBusIcon(size) {
  try {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d");

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, "#1e1b4b");
    gradient.addColorStop(1, "#312e81");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, size * 0.22);
    ctx.fill();

    // Outer glow ring
    ctx.strokeStyle = "rgba(99, 102, 241, 0.4)";
    ctx.lineWidth = size * 0.03;
    ctx.stroke();

    // Bus body
    const margin = size * 0.2;
    const busWidth = size - margin * 2;
    const busHeight = size * 0.5;
    const busX = margin;
    const busY = size * 0.25;

    ctx.fillStyle = "#6366f1";
    ctx.beginPath();
    ctx.roundRect(busX, busY, busWidth, busHeight, size * 0.08);
    ctx.fill();

    // Bus windshield
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.roundRect(busX + busWidth * 0.1, busY + busHeight * 0.12, busWidth * 0.8, busHeight * 0.35, size * 0.04);
    ctx.fill();

    // Bus headlights
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(busX + busWidth * 0.15, busY + busHeight * 0.75, size * 0.04, 0, Math.PI * 2);
    ctx.arc(busX + busWidth * 0.85, busY + busHeight * 0.75, size * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // Text TAR UMT
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(size * 0.08)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("TAR UMT", size / 2, busY + busHeight * 0.65);

    return canvas.toBuffer("image/png");
  } catch {
    return null;
  }
}

const publicDir = path.join(__dirname, "..", "public");

const icon192 = createBusIcon(192);
const icon512 = createBusIcon(512);

if (icon192 && icon512) {
  fs.writeFileSync(path.join(publicDir, "icon-192.png"), icon192);
  fs.writeFileSync(path.join(publicDir, "icon-512.png"), icon512);
  console.log("Successfully generated real PNG PWA icons!");
} else {
  console.log("Canvas module unavailable, fallback icon generation skipped.");
}
