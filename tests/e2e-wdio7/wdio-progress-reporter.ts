import WDIOReporter from '@wdio/reporter';
import { WDIOReporterOptions, SuiteStats, HookStats, TestStats, RunnerStats
      } from '@wdio/reporter';
import * as ansiColors from 'ansi-colors';
import * as fs from 'fs';

type TestStatsState = 'pending' | 'passed' | 'skipped' | 'failed';

// cannot import why not
//import { dieIf } from 'utils/log-and-die.ts';


//import WDIOReporter from '@wdio/reporter';
//import { default as ansiColors } from 'ansi-colors';


function logProgr(message: string) {
  //console.log(ansiColors.whiteBright(message));
  console.log(ansiColors.inverse.whiteBright(message));
}

function logProgrBold(message: string) {
  // console.log(ansiColors.bold.whiteBright(message));
  console.log(ansiColors.inverse.bold.whiteBright(message));
}

function logProgrBoldNormal(boldMsg: St, normalMsg: St) {
  // [inv_e2e_progr_msg_cols]
  // console.log(ansiColors.bold.whiteBright(boldMsg) + ansiColors.whiteBright(normalMsg));
  // This: inverse.bold.whiteBright gives a completely black background
  // but:  bold.black.bgWhiteBright gives a black-gray background, making the text had to read
  // (less contrast with the white text).
  console.log(ansiColors.inverse.bold.whiteBright(boldMsg) + ansiColors.inverse.whiteBright(normalMsg));
  // console.log(ansiColors.bold.black.bgWhiteBright(boldMsg) + ansiColors.black.bgWhite(normalMsg));
}


function nowString(): string {
  return (new Date()).toISOString();
}


// Dupl path, also in s/tyd.ts. [693RMSDM3]
const logFileDir = 'target/e2e-test-logs/';


// Prints the current test name, so if a test hangs, one sees which test
// (because if you terminate the hanged test via CTRL+C, you'll kill the whole
// process and it'll never get the chance to tell you which test hanged).
//
class TyWdioReporter extends WDIOReporter {
    #options: WDIOReporterOptions;
    #logFilePath: St | U;
    #logFileSuffix: St | U;
    #specFilePath: St | U;
    #specFileName: St | U;

    constructor(options: WDIOReporterOptions) {
      super(options)
      this.#options = options;

      if (!fs.existsSync(logFileDir)) {
        fs.mkdirSync(logFileDir, { recursive: true, mode: 0o777 });
      }

      // Unique file name, so won't overwrite. (Don't want to try to find
      // any reliable Nodejs atomic-file-append lib. How would I know that
      // it actually works? (doesn't sometimes overwrite and lose test results))
      const randNrStr = Math.random().toString().substr(2, 15);  // substr drops '0.'
      this.#logFileSuffix = `ty-e2e-log-${Date.now()}-${randNrStr}.txt`;
    }

    reporterName = 'TyWdioReporter';

    // Could refactor all this.

    #numSpecs = 0;
    #thisFileStartMs: number;
    #suiteStartMs: number;
    #suites: SuiteStats[] = [];
    #numTestsFailed = 0;
    #numTestsOk = 0;

    #failedTests: TestStats[] = [];

    onRunnerStart(runner) {
      // Is there always just 1 elem in the array? Then why is it an array?
      // https://github.com/webdriverio/webdriverio/blob/master/packages/wdio-reporter/README.md#onrunnerstart
      //dieIf(!runner.specs.length, 'TyE60AMG2GY', `Got no specs`);
      //dieIf(runner.specs.length >= 2, 'TyE60AMG2GX', `Got many specs: ${
      //      JSON.stringify(runner.specs.length)}`);

      this.#specFilePath = runner.specs[0];
      this.#specFileName = this.#specFilePath.replace(/.*\//, '');  // greedy by default
      this.#logFilePath = `${logFileDir}${this.#specFileName}--${this.#logFileSuffix}`

      // See: https://github.com/webdriverio/webdriverio/blob/master/packages/wdio-reporter/README.md
      const arg: any = arguments[0];
      const cid: string = arg.cid;
      const cidNoBrackets = cid.replace(/[\[\]]/g, '');
      const now4seconds = Date.now().toString().substring(5, 9);  // last 4 seconds of now()

      // Could use onWorkerStart() instead? [052RKTL40]
      (global as any).__thisSpecLocalHostname =
          `e2e-test-cid-${cidNoBrackets}-now-${now4seconds}`;

      // Hack, better send cid via the worker hook somehow? [052RKTL40]
      (global as any).getCidOrDie = () => cidNoBrackets;

      this.#thisFileStartMs = Date.now();
    }

    onRunnerEnd(runner) {
      //this.printToFile();
      //this.printToConsole();
    }

    printToConsole() {
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
        let test: TestStats;
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

    printToFile() {
      // A bug in WebdriverIO?  let suite of this.#suites  is always the same
      // suite, and *before* it starts — also when running many.  [WDIOREPTRBUG]
      let text = '';
      for (let suite of this.#suites) {
        text += `SUITE: ${suite.title}\n`;
        let ok = true;
        let test: TestStats;
        let worstState:  TestStatsState | U;
        for (test of suite['tests']) {
          // State is:  'passed' | 'pending' | 'failed' | 'skipped'
          if (test.state === 'failed') {
            worstState = test.state;
            ok = false;
            text += `----- FAILED:  ${suite.title}:  ${test.title}\n`;
            for (let error of test.errors) {
              text += `  Stack trace: ${error.stack}\n`;
            }
          }
          else if (test.state === 'skipped' || test.state === 'pending') {
            if (worstState !== 'failed') {
              worstState = test.state;
            }
          }
          else {
            worstState = test.state;
          }
        }
        if (ok) {
          // For now:
          text += `----- ${worstState}:  ${suite.title}\n`;
        }
      }

      fs.writeFileSync(this.#logFilePath, text);
    }

    onSuiteStart(suite: SuiteStats) {
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
      logProgrBoldNormal(`Suite start: ${this.#specFileName}: "${suite.fullTitle}"`,
            ` ${nowString()}`);
    }

    onSuiteEnd(suite: SuiteStats) {
      //[WDIOREPTRBUG] wdio bug? this is always the same suite, and: "type": "suite:start"
      // but this is on-End?
      // console.log(`\n\nSUITE END:\n${JSON.stringify(suite, undefined, 2)}\n`);
      this.#suites.push(suite);
      //if (suite.title !== suite.parent) return;
      const endMs = Date.now();
      const durSecs = Math.round((endMs - this.#suiteStartMs) / 1000);
      logProgrBoldNormal(`Suite ended: ${this.#specFileName}: "${suite.fullTitle}"`,
            ` ${nowString()} took ${durSecs}s`);
    }

    onTestStart(test: TestStats) {
      logProgr(`${test.title}`);
    }

    onTestEnd(test: TestStats) {
    }

    onHookStart(test: HookStats) {
    }

    onHookEnd(test: HookStats) {
    }

    onTestPass(test: TestStats) {
      this.#numTestsOk += 1;
    }

    onTestFail(test: TestStats) {
      this.#failedTests.push(test);
      this.#numTestsFailed += 1;
      const endMs = Date.now();
      const durSecs = Math.round((endMs - this.#suiteStartMs) / 1000);
      const failedFileAndTest = `FAILED: ${this.#specFileName}: ${test.title}`;
      logProgrBoldNormal('\n' + failedFileAndTest + `  [TyEE2EFAIL] `,
            `${nowString()} took ${durSecs}s\n`);
            // Hmm already printed by wdio:
            //`Stack trace:\n` +
            //`${test.error.stack}\n`);

      // For now, instead of printToFile() above:    [WDIOREPTRBUG]
      let text = failedFileAndTest + `\n`;
      for (let error of test.errors) {
        text += `${error.stack}\n`;
      }
      text += `\n==============================================================\n`
      fs.writeFileSync(this.#logFilePath, text + '\n');
    }

    onTestSkip(test: TestStats) {
      logProgr(`SKIPPING: ${test.title}`);
    }
};

export default TyWdioReporter;