export default function* main({ queryResult }) {
  const { parameters: p } = queryResult;
  for (let i = 1; i <= Number(p.to); i++) {
    yield String(i);
  }
}
