const _config = config.icloud;

const path = require('path');
const AppleiCloud = require('apple-icloud');
const md5 = require('md5');

let $ = null;

class iCloud {
	constructor(username, password) {
		console.log(path.join(__tmpsecretdir, 'icloud-session-' + md5(username + password) + '.json'));
		this.$ = new AppleiCloud(path.join(__tmpsecretdir, 'icloud-session-' + md5(username + password) + '.json'), username, password);
	}
	async login(securityCode = null) {
		return new Promise((resolve, reject) => {
			if (securityCode != null) this.$.securityCode = securityCode;

			this.$.on('ready', () => {
				if (this.$.twoFactorAuthenticationIsRequired) {
					return reject({
						twoFactorAuthenticationIsRequired: true
					});
				}

				this.$.saveSession();
				resolve();
			});

			this.$.on('err', (err) => {
				// reject(err);
			});

		});
	}
}

module.exports = iCloud;