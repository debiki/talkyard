var chalk = require('chalk');

var boringColor = chalk.gray;
var errorColor = chalk.bold.yellow.bgRed;
var warningColor = chalk.bold.red;
var unusualColor = chalk.black.bgGreen;


var api = {
  logMessage: function (message) {
    console.log(boringColor(message));
  },
  logUnusual: function (message) {
    console.log(unusualColor(message));
  },
  logWarning: function (message) {
    console.log(warningColor(message));
  },
  logError: function (message) {
    console.log(errorColor(message));
  },
  die: function(message, details) {
    api.logError('\n' + message + (details ? '\n' + details : ''));
    throw Error(message);
  },
  dieIf: function(test, message, details) {
    if (test) {
      api.die(message, details);
    }
  }
};

module.exports = api;

