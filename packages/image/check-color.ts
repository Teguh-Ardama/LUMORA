import sharp from 'sharp';

async function checkColor() {
  const meta = await sharp('out.jpg').stats();
  console.log("Channel 0 mean:", meta.channels[0].mean);
  console.log("Channel 1 mean:", meta.channels[1]?.mean);
  console.log("Channel 2 mean:", meta.channels[2]?.mean);
}
checkColor();
