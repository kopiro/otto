exports.id = "repeat";

module.exports = function main({ queryResult }) {
  const { parameters: p } = queryResult;
  return p.q;
};
