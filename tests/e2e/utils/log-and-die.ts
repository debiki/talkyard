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


function getOrCall<V>(valueOrFn: U | V | (() => V)): U | V {
  return _.isFunction(valueOrFn) ? valueOrFn() : valueOrFn;
}

const api = {
  unusualColor: unusualColor,

  getOrCall,

  /// JSON to string — 'j2s' is shorter than 'JSON.stringify'.
  j2s: function(any: any, hmm?: any, indentation?: Nr): St {
    return JSON.stringify.apply(JSON, arguments);
  },

  // debug log json
  dj: function(message: string, json: any, indentation?: number) {
    api.logMessage(`${message} ${JSON.stringify(json, undefined, indentation)}`);
  },
  logMessage: function (message: StringOrFn) {
    console.log(normalColor(message));
  },
  logMessageIf: function (test: boolean, message: StringOrFn) {
    if (test) console.log(normalColor(message));
  },
  logBoring: function (message: StringOrFn) {
    console.log(boringColor(getOrCall(message)));
  },
  logDebugIf: function (test: Bo, msg: StringOrFn) {
    if (test) api.logDebug(msg);
  },
  logDebug: function (message: StringOrFn) {
    // Compilation error, `arguments` is not a real array:
    // const args = [...arguments];
    const args = [];
    for (let i = 0; i < arguments.length; ++i) {
      args[i] = arguments[i];
    }
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
    console.trace();
  },
  logErrorIf: function (test: boolean, message: string, ex?: any) {
    if (test) {
      api.logError(message, ex);
    }
  },
  logErrorNoTrace: function (message: string, ex?: any) {
    const m = errorColor(message);
    // Avoid printing 'undefined' if ex is undefined.
    if (_.isUndefined(ex)) console.error(m);
    else console.error(m, ex);
  },
  logError: function (message: string, ex?: any) {
    api.logErrorNoTrace(message, ex);
    console.trace();
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
      api.logErrorNoTrace(`\n\n${message}${details ? '\n' + details : ''}\n` +
          `Exiting process, error status 1. Bye.\n`);
      console.trace();
      process.exit(1);
    }
  }
};

export = api;

