import sharp from "sharp";

async function applyFilter(photo: Buffer, params: any): Promise<Buffer> {
  let pipeline = sharp(photo, { failOn: "none" }).rotate();

  if (params.grayscale) {
    pipeline = pipeline.grayscale();
  }
  pipeline = pipeline.modulate({
    brightness: params.brightness,
    saturation: params.grayscale ? 1 : params.saturation,
    hue: params.hue,
  });
  if (params.gamma) {
    pipeline = pipeline.gamma(params.gamma);
  }
  if (params.tint && !params.grayscale) {
    pipeline = pipeline.tint(params.tint);
  }
  return pipeline.toBuffer();
}

async function test() {
  const input = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).jpeg().toBuffer();

  const out = await applyFilter(input, {
    hue: 0,
    grayscale: true,
    brightness: 1.05,
    saturation: 1
  });

  await sharp(out).toFile("out.jpg");
  console.log("Done");
}
test();
