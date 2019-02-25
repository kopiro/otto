const TAG = 'Selfie';

const gm = require('gm');
const path = require('path');
const md5 = require('md5');
const download = require('download');

const ImageSearch = requireLibrary('imagesearch');

// TODO: get dynamic
const AVATAR_URL =	'https://storage.googleapis.com/otto-ai/selfies/avatars/maglioncino.png';

// TODO: refactor with async
exports.create = async function (keyword) {
  return new Promise(async (resolve, reject) => {
    const panoramas = (await ImageSearch.search(`${keyword}`, {
      size: 'xxlarge',
      type: 'photo',
      safe: 'high',
    })).filter(e => (
      e.type === 'image/jpeg' && e.width / e.height > 1.2 && e.width > 1200
    ));

    const panorama_url = rand(panoramas).url;
    const avatar_file = `${tmpDir}/${md5(AVATAR_URL)}.png`;
    const panorama_file = `${tmpDir}/${md5(panorama_url)}.jpg`;

    await download(AVATAR_URL, tmpDir, {
      filename: path.basename(avatar_file),
    });
    await download(panorama_url, tmpDir, {
      filename: path.basename(panorama_file),
    });

    gm(panorama_file).identify((err, panorama_data) => {
      const width = 1200;
      const height =				(width * panorama_data.size.height) / panorama_data.size.width;

      gm(panorama_file)
        .resize(width, height)
        .write(panorama_file, () => {
          gm(avatar_file).identify((err, avatar_data) => {
            const avatar_height = height * 0.8;

            gm(avatar_file)
              .resize(
                (avatar_height * avatar_data.width) / avatar_data.height,
                avatar_height,
              )
              .write(avatar_file, () => {
                const final_file = `/${uuid()}.jpg`;
                const file_file_disk = path.join(tmpDir, final_file);

                gm(panorama_file)
                  .composite(avatar_file)
                  .gravity('South')
                  .write(file_file_disk, (err) => {
                    resolve(file_file_disk);
                  });
              });
          });
        });
    });
  });
};
