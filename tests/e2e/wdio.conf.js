require('ts-node/register')

// Include the '.ts' suffix, otherwise apparently any '.js' file with the same
// name (excl suffix) gets loaded.
exports.config = require('./wdio.conf.ts');
