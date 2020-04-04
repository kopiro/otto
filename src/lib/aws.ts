import _ from "aws-sdk";
_.config.loadFromPath(process.env.AWS_KEY_PATH);
export default _;
