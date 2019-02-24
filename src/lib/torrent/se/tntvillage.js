const URL = 'http://tntvillage.scambioetico.org/src/releaselist.php';

const request = require('request');
const striptags = require('striptags');

const entities = new require('html-entities').AllHtmlEntities;

exports.query = function (q) {
  return new Promise((resolve, reject) => {
    request({
      url: URL,
      method: 'POST',
      form: {
        cat: 0,
        page: 1,
        srcrel: q,
      },
    }, (err, resp, body) => {
      if (err) return reject(err);

      const results = [];

      body = body.replace(/\t/g, '');
      body = body.replace(/\n/g, '');

      // Imlement a strange way to parse this table
      // with zero dependencies
      body.split('<tr>').slice(2).forEach((line) => {
        const obj = {};
        line.split(/<td[^>]*>/).forEach((col, index) => {
          col = col.split('</td>')[0];
          if (index === 1) {
            obj.torrent = /<a href\='([^']+)'/.exec(col)[1];
          } else if (index === 2) {
            obj.magnet = /<a href\='([^']+)'/.exec(col)[1];
          } else if (index === 7) {
            obj.title = entities.decode(striptags(col));
          }
        });
        results.push(obj);
      });

      resolve(results);
    });
  });
};
