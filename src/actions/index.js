const fs = require('fs');

const actionList = {};

// Try to load from cache
(function iterate(dir) {
  fs.readdirSync(dir).forEach((file) => {
    file = `${dir}/${file}`;

    const stat = fs.lstatSync(file);
    if (stat.isDirectory()) {
      iterate(file);
    } else if (stat.isFile()) {
      if (/\.js$/.test(file)) {
        const action_name = file
          .replace('/index.js', '')
          .replace(__dirname, '')
          .replace(/^./, '')
          .replace(/\//g, '.')
          .replace('.js', '');

        if (action_name) {
          actionList[action_name] = () => require(file);
        }
      }
    }
  });
}(__dirname));

exports.list = actionList;
