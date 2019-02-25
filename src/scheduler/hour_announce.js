const TAG = 'Scheduler/HourAnnunce';

const Moment = requireLibrary('moment');

exports.run = function ({ session }) {
  const now = Moment();
  if (now.hours() >= 10 && now.hours() <= 23) {
    return IOManager.outputByInputParams({ event: 'hour_announce' }, session);
  }
};
