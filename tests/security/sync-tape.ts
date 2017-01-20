// Synchronous tape tests.

import tape = require("tape");

function synctest(name: string, cb: tape.TestCase) {
  tape(name, function(t) {
    cb(t);
    t.end();
  });
}

export = synctest;
