const TAG = 'Selfie';

const gm = require('gm');
const path = require('path');
const md5 = require('md5');
const download = require('download');

const ImageSearch = apprequire('imagesearch');

// TODO: get dynamic
const AVATAR_URL = 'https://storage.googleapis.com/otto-ai/selfies/avatars/maglioncino.png';

// TODO: refactor with async
exports.create = async function(keyword) {
	return new Promise(async(resolve, reject) => {
		const panoramas = (await ImageSearch.search(`${keyword}`, {
			size: 'xxlarge',
			type: 'photo',
			safe: 'high'
		})).filter(e => {
			return (e.type === 'image/jpeg' && e.width / e.height > 1.2 && e.width > 1200);
		});

		const panorama_url = rand(panoramas).url;
		const avatar_file = __tmpdir + '/' + md5(AVATAR_URL) + '.png';
		const panorama_file = __tmpdir + '/' + md5(panorama_url) + '.jpg';

		await download(AVATAR_URL, __tmpdir, { filename: path.basename(avatar_file) });
		await download(panorama_url, __tmpdir, { filename: path.basename(panorama_file) });
		

		gm(panorama_file)
		.identify((err, panorama_data) => {
			const width = 1200;
			const height = width * panorama_data.size.height / panorama_data.size.width;

			gm(panorama_file)
			.resize(width, height)
			.write(panorama_file, () => {

				gm(avatar_file)
				.identify((err, avatar_data) => {

					const avatar_height = height * 0.8;

					gm(avatar_file)
					.resize(avatar_height * avatar_data.width / avatar_data.height, avatar_height)
					.write(avatar_file, () => {

						const final_file = __tmpdir + '/' + uuid() + '.jpg';

						gm(panorama_file)
						.composite(avatar_file)
						.gravity('South')
						.write(final_file, (err) => {
							resolve(final_file);
						});

					});
				});

			});
		});
	});
};