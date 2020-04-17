/// <reference path="../test-types2.ts" />

import * as _ from 'lodash';
const ansiColors = require('ansi-colors');

const normalColor = ansiColors.white;
const boringColor = ansiColors.gray;
const errorColor = ansiColors.bold.yellow.bgRed;
const exceptionColor = ansiColors.bold.yellow;
const warningColor = ansiColors.bold.red;
const debugColor = ansiColors.bold.yellow;
const unusualColor = ansiColors.black.bgGreen;
const serverRequestColor = ansiColors.bold.cyan;
const serverResponseColor = ansiColors.bold.blue;

function getOrCall<V>(valueOrFn: V | (() => V)): V {
  return _.isFunction(valueOrFn) ? valueOrFn() : valueOrFn;
}

const api = {
  unusualColor: unusualColor,

  getOrCall,

  logMessage: function (message: StringOrFn) {
    console.log(normalColor(message));
  },
  logMessageIf: function (test: boolean, message: StringOrFn) {
    if (test) console.log(normalColor(message));
  },
  logBoring: function (message: StringOrFn) {
    console.log(boringColor(getOrCall(message)));
  },
  logDebug: function (message: StringOrFn) {
    const args = [...arguments];
    args[0] = debugColor(getOrCall(message));
    console.log.apply(console, args);
  },
  logUnusual: function (message: StringOrFn) {
    console.log(unusualColor(getOrCall(message)));
  },
  logWarningIf: function (test: BoolOrFn, message: StringOrFn) {
    if (getOrCall(test)) api.logWarning(message);
  },
  logWarning: function (message: StringOrFn) {
    console.warn(warningColor(getOrCall(message)));
  },
  logException: function (message: any, ex?: any) {
    if (!ex) {
      ex = message;
      message = "The exception:";
    }
    if (message) console.log(getOrCall(message));
    const exceptionIndented = '   ' + ex.toString().replace(/\n/g, "\n   ");
    console.log(exceptionColor(exceptionIndented));
  },
  logErrorIf: function (test: boolean, message: string, ex?: any) {
    if (test) {
      api.logError(message, ex);
    }
  },
  logError: function (message: string, ex?: any) {
    const m = errorColor(message);
    // Avoid printing 'undefined' if ex is undefined.
    if (_.isUndefined(ex)) console.error(m);
    else console.error(m, ex);
  },
  logServerRequest: function(message: string) {
    console.log(serverRequestColor(message));
  },
  logServerResponse: function(text: string, ps: { boring: boolean } = { boring: true }) {
    console.log(
      serverResponseColor(`The server says:\n----\n` + `${text.trim()}` + `\n----`));
  },
  printBoringToStdout: function(message: string) {
    process.stdout.write(boringColor(getOrCall(message)));
  },
  die: function(message: string, details?: string) {
    api.logError('\n' + message + (details ? '\n' + details : '') + '\n');
    throw Error(message);
  },
  dieIf: function(test: boolean, message: string, details?: string) {
    if (test) {
      api.die(message, details);
    }
  },
  dieAndExitIf: function(test: boolean, message: string, details?: string) {
    if (test) {
      api.logError(`\n\n${message}${details ? '\n' + details : ''}\n` +
          `Exiting process, error status 1. Bye.\n`);
      console.trace();
      process.exit(1);
    }
  }
};

export = api;

