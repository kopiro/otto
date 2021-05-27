import awsSDK from "aws-sdk";

let _instance: typeof awsSDK;
export default (): typeof _instance => {
  if (!_instance) {
    awsSDK.config.loadFromPath(process.env.AWS_KEY_PATH);
    _instance = awsSDK;
  }
  return _instance;
};
