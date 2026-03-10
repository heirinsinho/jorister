const Jimp = require('jimp');

async function processImage() {
  const image = await Jimp.read(process.argv[2]);
  
  // Create an aggressive autocrop by scanning for pixels that DO NOT match the exact background color
  // The background is #1a2134 (RGB: 26, 33, 52)
  const bgR = 26;
  const bgG = 33;
  const bgB = 52;
  const tolerance = 15; // Handle compression/noise

  image.autocrop({
      tolerance: 0.1, // 10% tolerance for non-exact background pixels
      cropOnlyFrames: false,
      leaveBorder: 10 // Give it a tiny 10px breathing room
  });
  
  // Custom scan if the built in autocrop fails to find the exact edge due to noise
  let minX = image.bitmap.width;
  let minY = image.bitmap.height;
  let maxX = 0;
  let maxY = 0;

  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      const isBg = Math.abs(r - bgR) < tolerance && 
                   Math.abs(g - bgG) < tolerance && 
                   Math.abs(b - bgB) < tolerance;
                   
      if (!isBg) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
      }
  });

  // Calculate final bounds with 10px padding
  const pad = 10;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(image.bitmap.width - cropX, (maxX - minX) + (pad * 2));
  const cropH = Math.min(image.bitmap.height - cropY, (maxY - minY) + (pad * 2));

  // Perform the manual tight crop if it found valid bounds
  if (cropW > 0 && cropH > 0) {
      image.crop(cropX, cropY, cropW, cropH);
  }

  await image.writeAsync(process.argv[3]);
}

processImage().catch(err => console.error(err));
