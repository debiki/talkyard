/// <reference path="../../../modules/definitely-typed/chalk/chalk.d.ts"/>

import chalk = require('chalk');

var boringColor = chalk.gray;
var errorColor = chalk.bold.yellow.bgRed;
var warningColor = chalk.bold.red;
var unusualColor = chalk.black.bgGreen;


var api = {
  unusualColor: unusualColor,

  logMessage: function (message: string) {
    console.log(boringColor(message));
  },
  logUnusual: function (message: string) {
    console.log(unusualColor(message));
  },
  logWarning: function (message: string) {
    console.log(warningColor(message));
  },
  logError: function (message: string) {
    console.log(errorColor(message));
  },
  die: function(message: string, details?: string) {
    api.logError('\n' + message + (details ? '\n' + details : ''));
    throw Error(message);
  },
  dieIf: function(test: boolean, message: string, details?: string) {
    if (test) {
      api.die(message, details);
    }
  }
};

export = api;

