import * as asyncTest from 'tape';
import syncTest = require('../sync-tape');


asyncTest('timing test', (test) => {
  test.plan(2);

  test.equal(typeof Date.now, 'function');
  var start = Date.now();

  setTimeout(function () {
    test.equal(Date.now() - start, 100);
  }, 100);
});


syncTest('equals test', (test) => {
  test.equal(3, 3);
  test.equal(4, 4);
  test.equal(5, 5);
  test.equal(6, -1);
  test.equal(7, 7);
});

