#!/usr/bin/env node

require('ts-node').register({ transpileOnly: true });

// Include the '.ts' suffix, otherwise apparently any '.js' file with the same
// name (excl suffix) gets loaded.
exports.config = require('./tyd.ts');

