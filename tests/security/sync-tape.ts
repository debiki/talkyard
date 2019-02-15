// Was using:
// "@types/tape": "^4.2.28",
// "tape": "^4.6.3",

// Synchronous tape tests.

import tape = require("tape");

function synctest(name: string, cb: tape.TestCase) {
  tape(name, function(t) {
    cb(t);
    t.end();
  });
}

export = synctest;
