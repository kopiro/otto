require('../boot');

const Translator = requireLibrary('translator');
const Wolfram = requireLibrary('wolfram');
(async function () {
  try {
    const res = await Wolfram.complexQuery('Einstein', 'it');
    console.log(res);
  } catch (err) {
    console.error(err);
  }
}());
