exports.id = 'count.to';

module.exports = async function* ({ queryResult }, session) {
  const { parameters: p } = queryResult;
  for (let i = 1; i <= Number(p.to); i++) {
    yield String(i);
    await timeout(1000);
  }
};
