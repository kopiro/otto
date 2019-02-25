exports.id = 'hotword_trainer';

const Hotword = requireLibrary('hotword');

module.exports = async function ({ queryResult }, session) {
  const { parameters: p } = queryResult;

  const ioDriver = IOManager.getDriver('kid');
  if (ioDriver == null) throw 'driver_unavailable';

  await ioDriver.stopInput();
  await Hotword.getModels(true);
  await ioDriver.startInput();
};
