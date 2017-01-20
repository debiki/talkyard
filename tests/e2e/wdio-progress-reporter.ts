import util = require('util');
import events = require('events');

// Prints the current test name, so if a test hangs, one sees which test
// (because if you terminate the hanged test via CTRL+C, you'll kill the whole
// process and it'll never get the chance to tell you which test hanged).
//
let Reporter: any = function(options) {

    this.on('start', function() {
    });

    this.on('end', function() {
    });

    this.on('suite:start', function() {
    });

    this.on('suite:end', function() {
    });

    this.on('test:start', function(test) {
        console.log(test.title);
    });

    this.on('test:end', function() {
    });

    this.on('hook:start', function(something) {
    });

    this.on('hook:end', function() {
    });

    this.on('test:pass', function() {
    });

    this.on('test:fail', function(test) {
        console.log('FAIL: ' + test.err.stack);
    });

    this.on('test:pending', function() {
    });
};

util.inherits(Reporter, events.EventEmitter);

Reporter.reporterName = 'ProgressReporter';

export = Reporter;