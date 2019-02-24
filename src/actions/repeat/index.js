exports.id = 'repeat';

module.exports = function ({ queryResult }, session) {
  const { parameters: p } = queryResult;
  return p.q;
};
