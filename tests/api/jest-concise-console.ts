// Jest wraps log messages in e.g.:
//     console.log
//       ... the actual message ...
//
//       at SomeClass.someLogMsgFn (../some/file.ts:123:45)
//
// which makes the log messages very verbose.
//
// This custom console doesn't do that; it only logs the actual messages.
//
// See: "Remove logging the origin line in Jest"
// https://stackoverflow.com/a/57443150


import { CustomConsole, LogType, LogMessage } from '@jest/console';

function conciseFormatter(type: LogType, message: LogMessage): St {
  // "LM" stands for "log message".
  return message.split('\n').map(line =>
    ' LM ' + line).join('\n');
}

global.console = new CustomConsole(process.stdout, process.stderr, conciseFormatter);