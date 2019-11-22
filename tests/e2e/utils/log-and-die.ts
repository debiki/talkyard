const ansiColors = require('ansi-colors');

const boringColor = ansiColors.gray;
const errorColor = ansiColors.bold.yellow.bgRed;
const exceptionColor = ansiColors.bold.yellow;
const warningColor = ansiColors.bold.red;
const unusualColor = ansiColors.black.bgGreen;
const serverRequestColor = ansiColors.bold.cyan;


const api = {
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
  logException: function (message: any, ex?: any) {
    if (!ex) {
      ex = message;
      message = "The exception:";
    }
    if (message) console.log(message);
    const exceptionIndented = '   ' + ex.toString().replace(/\n/g, "\n   ");
    console.log(exceptionColor(exceptionIndented));
  },
  logError: function (message: string) {
    console.log(errorColor(message));
  },
  logServerRequest: function(message: string) {
    console.log(serverRequestColor(message));
  },
  printBoringToStdout: function(message: string) {
    process.stdout.write(boringColor(message));
  },
  die: function(message: string, details?: string) {
    api.logError('\n' + message + (details ? '\n' + details : '') + '\n');
    throw Error(message);
  },
  dieIf: function(test: boolean, message: string, details?: string) {
    if (test) {
      api.die(message, details);
    }
  }
};

export = api;

