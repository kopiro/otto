import awsSDK from "aws-sdk";

let _instance: typeof awsSDK;
export default (): typeof _instance => {
  if (!_instance) {
    if (!process.env.AWS_KEY_PATH) {
      throw new Error("AWS_KEY_PATH is not defined");
    }
    awsSDK.config.loadFromPath(process.env.AWS_KEY_PATH);
    _instance = awsSDK;
  }
  return _instance;
};
