exports.id = "icloud.configure";

const iCloud = require("apple-icloud");

module.exports = async function({ sessionId, result }, session) {
  return new Promise((resolve, reject) => {
    let { parameters: p, fulfillment } = result;

    const icloud = new iCloud({}, p.username, p.password);

    icloud.on("ready", async () => {
      if (icloud.twoFactorAuthenticationIsRequired) {
        icloud.sendSecurityCode("sms");
        // TODO
        require("prompt").get(["Security Code"], async (err, input) => {
          const code = input["Security Code"];
          // Set the security code to the instance
          icloud.securityCode = code;
        });
        return;
      }

      session.saveSettings({
        icloud: icloud.exportSession()
      });

      resolve({
        speech: fulfillment.speech
      });
    });
  });
};
