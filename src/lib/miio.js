const TAG = 'MIIO';

const miio = require('miio');

const _config = config.miio;

miio.retrieveDefaultDevice = function () {
  return new Promise((resolve, reject) => {
    const devices = miio.devices({ cacheTime: 300 });
    const timeout_interval = setTimeout(() => {
      reject({
        timeout: true,
      });
    }, 5000);
    devices.on('available', (reg) => {
      if (reg.id === _config.devices[0].id) {
        clearTimeout(timeout_interval);
        console.debug('Found default device', reg);
        resolve(miio.device({
          address: reg.address,
          token: _config.devices[0].token,
        }));
      }
    });
  });
};

module.exports = miio;
