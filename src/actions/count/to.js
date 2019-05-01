exports.id = 'count.to';
const { timeout } = require('../../helpers');

module.exports = async function* main({ queryResult }) {
  const { parameters: p } = queryResult;
  for (let i = 1; i <= Number(p.to); i++) {
    yield String(i);
    await timeout(1000);
  }
};
