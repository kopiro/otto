const aws = require('aws-sdk');

aws.config.loadFromPath(__basedir + '/keys/aws.json');

module.exports = aws;