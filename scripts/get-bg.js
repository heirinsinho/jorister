const Jimp = require("jimp");

async function getColor() {
	const image = await Jimp.read(process.argv[2]);
	const color = Jimp.intToRGBA(image.getPixelColor(0, 0));

	// Convert RGB to Hex
	const hex =
		"#" +
		color.r.toString(16).padStart(2, "0") +
		color.g.toString(16).padStart(2, "0") +
		color.b.toString(16).padStart(2, "0");

	console.log(`LOGO_BG_COLOR=${hex}`);
}

getColor().catch((err) => console.error(err));
