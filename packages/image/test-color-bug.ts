import sharp from 'sharp';
import fs from 'fs';

async function test() {
  // Create a colorful gradient JPEG
  const bg = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).jpeg().toBuffer();
  
  // Apply pipeline exactly as in compose.ts
  let pipeline = sharp(bg).rotate();
  pipeline = pipeline.grayscale();
  pipeline = pipeline.modulate({ brightness: 1.05, saturation: 1 });
  const result = await pipeline.toBuffer();
  
  const stats = await sharp(result).stats();
  console.log("Channel 0 mean:", stats.channels[0].mean);
  console.log("Channel 1 mean:", stats.channels[1]?.mean);
  console.log("Channel 2 mean:", stats.channels[2]?.mean);
  
  const diff = Math.abs(stats.channels[0].mean - stats.channels[1].mean) + Math.abs(stats.channels[1].mean - (stats.channels[2] ? stats.channels[2].mean : stats.channels[1].mean));
  if (diff > 0.1) {
    console.log("IT IS COLORED!");
  } else {
    console.log("It is perfectly grayscale.");
  }
}

test();
