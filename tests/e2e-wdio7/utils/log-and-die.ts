/// <reference path="../test-types2.ts" />

import * as _ from 'lodash';
const ansiColors = require('ansi-colors');

const normalColor = ansiColors.white;
const boringColor = ansiColors.gray;
const errorColor = ansiColors.bold.bgRed;
const exceptionColor = ansiColors.bold.yellow;
const warningColor = ansiColors.bold.red;
const debugColor = ansiColors.bold.yellow;
export const unusualColor = ansiColors.black.bgGreen;
const serverRequestColor = ansiColors.bold.cyan;
const serverResponseColor = ansiColors.bold.blue;


export function getOrCall<V>(valueOrFn: U | V | (() => V)): U | V {
  return _.isFunction(valueOrFn) ? valueOrFn() : valueOrFn;
}

// Also in slim-bundle. [pretty_num]
export function prettyNum(num: Nr, digits: Nr = 2): Nr {
  return Number(num.toPrecision(digits));
}

/// JSON to string — 'j2s' is shorter than 'JSON.stringify'.
export function j2s(something: Ay, replacer = stringifyReplacer, indentation?: Nr): St {
  return JSON.stringify(something, replacer, indentation);
}

/// JSON.stringify() doesn't know how to serialize a Map, so we'll need to specify
/// what JSON to generate, for a Map.
function stringifyReplacer(key: Ay, value: Ay): Ay {
  if (value instanceof Map) {
    return { mapEntries: [...value.entries()] };
  }
  return value;
}

/// "dj" = Debug log Json
export function dj(message: string, json: any, indentation?: number) {
  logMessage(`${message} ${j2s(json, stringifyReplacer, indentation)}`);
}

export function logMessage(message: StringOrFn) {
  console.log(normalColor(message));
}

export function logMessageIf(test: boolean, message: StringOrFn) {
  if (test) console.log(normalColor(message));
}

export function logBoring(message: StringOrFn) {
  console.log(boringColor(getOrCall(message)));
}

export function logDebugIf(test: Bo, msg: StringOrFn) {
  if (test) logDebug(msg);
}

export function logDebug(message: StringOrFn) {
  // Compilation error, `arguments` is not a real array:
  // const args = [...arguments];
  const args = [];
  for (let i = 0; i < arguments.length; ++i) {
    args[i] = arguments[i];
  }
  args[0] = debugColor(getOrCall(message));
  console.log.apply(console, args);
}

export function logUnusual(message: StringOrFn) {
  console.log(unusualColor(getOrCall(message)));
}

export function logBitHappy(message: St) {
  const m = ansiColors.bold.green(message);
}

export function logMuchHappy(message: St) {
  // '.black' is actually gray, but '.inverse' gives us the for-real
  // black background as the font color.
  const m = ansiColors.bold.green.inverse(message);
  console.log(m);
}

export function logWarningIf(test: BoolOrFn, message: StringOrFn) {
  if (getOrCall(test)) logWarning(message);
}

export function logWarning(message: StringOrFn) {
  console.warn(warningColor(getOrCall(message)));
}

export function logException(message: any, ex?: any) {
  if (!ex) {
    ex = message;
    message = "The exception:";
  }
  if (message) console.log(getOrCall(message));
  const exceptionIndented = '   ' + ex.toString().replace(/\n/g, "\n   ");
  console.log(exceptionColor(exceptionIndented));
  console.trace();
}

export function logErrorIf(test: boolean, message: string, ex?: any) {
  if (test) {
    logError(message, ex);
  }
}

export function logErrorNoTraceIf(test: Bo, message: St, ex?: Ay) {
  if (test) {
    logErrorNoTrace(message, ex);
  }
}

export function logErrorNoTrace(message: string, ex?: any) {
  const m = errorColor(message);
  // Avoid printing 'undefined' if ex is undefined.
  if (_.isUndefined(ex)) console.error(m);
  else console.error(m, ex);
}

export function logError(message: string, ex?: any) {
  logErrorNoTrace(message, ex);
  console.trace();
}

export function logServerRequest(message: string) {
  console.log(serverRequestColor(message));
}

export function logServerResponse(text: string, ps: { boring: boolean } = { boring: true }) {
  console.log(
    serverResponseColor(`The server says:\n----\n` + `${text.trim()}` + `\n----`));
}

export function printBoringToStdout(message: string) {
  process.stdout.write(boringColor(getOrCall(message)));
}

export function die(message: St, details?: St, debugHint?: St): never {
  logErrorNoTrace('\n' + message + (details ? '\n' + details : '') + '\n');
  logDebugIf(!!debugHint, '\n' + debugHint + '\n');
  console.trace();
  throw Error(message);
}

export function dieIf(test: boolean, message: string, details?: string) {
  if (test) {
    die(message, details);
  }
}

export function dieAndExitIf(test: boolean, message: string, details?: string) {
  if (test) {
    logErrorNoTrace(`\n\n${message}${details ? '\n' + details : ''}\n` +
        `Exiting process, error status 1. Bye.\n`);
    console.trace();
    process.exit(1);
  }
}

