import awsSDK from "aws-sdk";

awsSDK.config.loadFromPath(process.env.AWS_KEY_PATH);

export const client = awsSDK;
