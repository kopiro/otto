const aws = require('aws-sdk');

aws.config.loadFromPath(process.env.AWS_KEY_PATH);
module.exports = aws;
