const gcloudTranslate = require('@google-cloud/translate')();
const config = require('../config');

const TAG = 'Translator';

function translate(text, toLanguage = config.language, fromLanguage = config.language) {
  return new Promise((resolve, reject) => {
    if (toLanguage === fromLanguage) {
      resolve(text);
    } else {
      gcloudTranslate.translate(text, toLanguage, (err, translation) => {
        if (err) {
          reject(err);
        } else {
          resolve(translation);
        }
      });
    }
  });
}

function getLanguages(target = config.language) {
  return new Promise((resolve, reject) => {
    gcloudTranslate.getLanguages(target, (err, languages) => {
      if (err) {
        reject(err);
      } else {
        resolve(languages);
      }
    });
  });
}

module.exports = { translate, getLanguages };
