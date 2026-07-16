import sharp from "sharp";

async function test() {
  // Create a red square
  const input = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).jpeg().toBuffer();

  const out1 = await sharp(input)
    .grayscale()
    .modulate({ brightness: 1.1, saturation: 1 })
    .toBuffer();
    
  const meta1 = await sharp(out1).stats();
  console.log("Grayscale -> Modulate:", meta1.channels[0].mean, meta1.channels[1]?.mean, meta1.channels[2]?.mean);
}

test().catch(console.error);
