import WDIOReporter from '@wdio/reporter'
import * as ansiColors from 'ansi-colors';
//import WDIOReporter from '@wdio/reporter';
//import { default as ansiColors } from 'ansi-colors';


function logProgr(message: string) {
  console.log(ansiColors.whiteBright(message));
}

function logProgrBold(message: string) {
  console.log(ansiColors.bold.whiteBright(message));
}


function nowString(): string {
  return (new Date()).toISOString();
}



// Prints the current test name, so if a test hangs, one sees which test
// (because if you terminate the hanged test via CTRL+C, you'll kill the whole
// process and it'll never get the chance to tell you which test hanged).
//
class TyWdioReporter extends WDIOReporter {
    constructor(options: WDIOReporter.Options) {
      super(options)
    }

    reporterName = 'TyWdioReporter';

    // Could refactor all this.

    #numSpecs = 0;
    #thisFileStartMs: number;
    #suiteStartMs: number;
    #suites: WDIOReporter.Suite[] = [];
    #numTestsFailed = 0;
    #numTestsOk = 0;

    #failedTests: WDIOReporter.Test[] = [];

    onRunnerStart() {
      this.#thisFileStartMs = Date.now();
    }

    onRunnerEnd() {
    }

    printAllResults() {
      logProgrBold(`\n` +
          `---------------------------------------------------------------------\n` +
          `Done running ${this.#numSpecs} specs, results:\n` +
          `---------------------------------------------------------------------`);

      const endMs = Date.now();
      const durSecs = (endMs - this.#thisFileStartMs) / 1000;
      const durMins = Math.floor(durSecs / 60);
      const remRoundSecs = Math.round(durSecs - durMins * 60);

      let numSuitesOk = 0;
      let numSuitesFailed = 0;

      for (let suite of this.#suites) {
        let ok = true;
        let test: WDIOReporter.Test;
        for (test of suite['tests']) {
          if (test.state === 'failed') {
            ok = false;
            console.log(`----- Failed:  ${suite.title}:  ${test.title}`);
            for (let error of test.errors) {
              console.log(`  Stack trace: ${error.stack}`);
            }
          }
        }
        if (ok) {
          console.log(`----- Ok:  ${suite.title}`);
        }
      }

      logProgrBold(
          `---------------------------------------------------------------------\n` +
          `These ${this.#numSpecs} specs took ${durMins} min ${remRoundSecs} se  [TyME2EREPRT]\n` +
          `      Num suites ok: ${numSuitesOk}\n` +
          `  Num suites failed: ${numSuitesFailed}\n` +
          `       Num tests ok: ${this.#numTestsOk}\n` +
          `   Num tests failed: ${this.#numTestsFailed}\n` +
          `---------------------------------------------------------------------`);
    }

    onSuiteStart(suite: WDIOReporter.Suite) {
      /*
      // Don't log this, for nested suites (a  describe(){...} inside a test file).
      // if (suite.parentUid !== suite.uid) return;  — is the same, also for nested suites.
      // suite.title and .parent and .fullTitle are different though:
      if (suite.title !== suite.parent) return;
      */
      this.#numSpecs += 1;
      /*
      console.log('title: ' + suite.title + ' parent: ' + suite.parent + ' fullTtl: ' + suite.fullTitle);
      console.log('parentUid: ' + suite.parentUid +  '   uid: ' + suite.uid); *  /
      */
      this.#suiteStartMs = Date.now();
      //console.log(`${suite.cid}: ■■■ Spec start: ${suite.fullTitle}, ${nowString()}`);
      logProgrBold(`Suite start: "${suite.fullTitle}", ${nowString()}`);
    }

    onSuiteEnd(suite: WDIOReporter.Suite) {
      this.#suites.push(suite);
      //if (suite.title !== suite.parent) return;
      const endMs = Date.now();
      const durSecs = Math.round((endMs - this.#suiteStartMs) / 1000);
      logProgrBold(`Suite ended after ${durSecs} seconds: "${suite.title}", ${nowString()}`);
    }

    onTestStart(test: WDIOReporter.Test) {
      logProgr(`${test.title}`);
    }

    onTestEnd(test: WDIOReporter.Test) {
    }

    onHookStart(test: WDIOReporter.Hook) {
    }

    onHookEnd(test: WDIOReporter.Hook) {
    }

    onTestPass(test: WDIOReporter.Test) {
      this.#numTestsOk += 1;
    }

    onTestFail(test: WDIOReporter.Test) {
      this.#failedTests.push(test);
      this.#numTestsFailed += 1;
      const endMs = Date.now();
      const durSecs = Math.round((endMs - this.#suiteStartMs) / 1000);
      logProgrBold(``);
      logProgrBold(`FAILED after ${durSecs}s: "${test.title}", ${nowString()} [TyEE2EFAIL]`);
      //console.log(`Stack traces:\n${test.error.stack}`);
      logProgr(`Stack trace:\n${test.error.stack}`);
      logProgr(``);
    }

    onTestSkip(test: WDIOReporter.Test) {
      logProgr(`SKIPPING: ${test.title}`);
    }
};

export = TyWdioReporter;