const { timeout } = require('../../helpers');

module.exports = async function* main({ queryResult }) {
  const { parameters: p } = queryResult;
  for (let i = 1; i <= Number(p.to); i++) {
    yield String(i);
  }
};

module.exports.id = 'count.to';
