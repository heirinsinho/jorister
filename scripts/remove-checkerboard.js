const Jimp = require("jimp");

async function processImage() {
	const image = await Jimp.read(process.argv[2]);

	image.scan(
		0,
		0,
		image.bitmap.width,
		image.bitmap.height,
		function (_x, _y, idx) {
			const r = this.bitmap.data[idx + 0];
			const g = this.bitmap.data[idx + 1];
			const b = this.bitmap.data[idx + 2];

			const max = Math.max(r, g, b);
			const min = Math.min(r, g, b);
			const saturation = max - min;

			// Aggressive chroma key: if it lacks strong color, it's the fake background.
			if (saturation < 50) {
				this.bitmap.data[idx + 3] = 0; // Make transparent
			} else {
				// Boost opacity for the actual colored neon lines
				this.bitmap.data[idx + 3] = 255;
			}
		},
	);

	await image.writeAsync(process.argv[3]);
}

processImage().catch((err) => console.error(err));
