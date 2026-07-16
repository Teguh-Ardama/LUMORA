import sharp from "sharp";

async function test() {
  const input = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).jpeg().toBuffer();

  // Test 1: grayscale and modulate
  const out1 = await sharp(input)
    .grayscale()
    .modulate({ brightness: 1.1, saturation: 1 })
    .toBuffer();
    
  const meta1 = await sharp(out1).stats();
  console.log("Grayscale -> Modulate:", meta1.channels[0].mean, meta1.channels[1]?.mean);

  // Test 2: saturate 0
  const out2 = await sharp(input)
    .modulate({ brightness: 1.1, saturation: 0 })
    .toBuffer();
    
  const meta2 = await sharp(out2).stats();
  console.log("Saturation 0:", meta2.channels[0].mean, meta2.channels[1]?.mean);
}

test().catch(console.error);
