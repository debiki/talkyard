import * as _  from 'lodash';
import { ParsedArgs as minimist_ParsedArgs } from 'minimist';
import * as fs from 'fs';
import * as glob from 'glob';
import { prettyNum, j2s, die, dieIf, logMessage, logMessageIf,
         logBitHappy, logMuchHappy,
         logError, logErrorIf, logErrorNoTrace, logErrorNoTraceIf, logWarning,
         } from '../../tests/e2e-wdio7/utils/log-and-die';
import * as tyu from './tyd-util';
import type { ExitCode } from './tyd-util';
import { stdout } from 'process';

//type Pr<R> = Promise<R>;

//x <reference path="../../client/short-types.ts" />
//x <reference path="../../client/types-and-const-enums.ts" />


export function runE2eTestsExitIfErr(ps: {
  wdioVersion: 6 | 7,
  allSubCmdsSt: St,
  allSubCmds: St[],
  opts: minimist_ParsedArgs,
}) {

const startMs = Date.now();
const { allSubCmdsSt, allSubCmds, opts } = ps;


// Cycle e2e test logs:  (dupl path, also in the reporter [693RMSDM3])
//   e2e-test-logs —> e2e-test-logs-old
// And, if -old non-empty:
//   e2e-test-logs-old —> e2e-test-logs-older
//   e2e-test-logs-older —> delete
const e2eLogsDir = 'target/e2e-test-logs';
const e2eLogsDirOld = e2eLogsDir + '-old';
const e2eLogsDirOlder = e2eLogsDir + '-older';
if (fs.existsSync(e2eLogsDirOld)) {
  const oldLogs = glob.sync(e2eLogsDirOld, {});
  if (!oldLogs.length) {
    tyu.spawnInForeground(`rmdir ${e2eLogsDirOld}`);
  }
  else {
    // Delete -older, rename -old to -older.
    // `mv -old -older` places -old *inside* -older/  — need to delete it first.
    // (Also with flag --no-target-directory.)
    tyu.spawnInForeground(`rm -fr ${e2eLogsDirOlder}`);
    tyu.spawnInForeground(`mv ${e2eLogsDirOld} ${e2eLogsDirOlder}`);
  }
}
if (fs.existsSync(e2eLogsDir)) {
  tyu.spawnInForeground(`mv -f ${e2eLogsDir} ${e2eLogsDirOld}`);
}
tyu.spawnInForeground(`mkdir ${e2eLogsDir}`);



//const e2eSpecsPattern = `tests/e2e/specs/${subCmd ? `*${subCmd}*.ts` : '*.ts'}`;
//const allMatchingSpecs_old = glob.sync(e2eSpecsPattern, {});

const testProjDir = ps.wdioVersion === 6 ? 'tests/e2e' : 'tests/e2e-wdio7';
const specsGlob = testProjDir + '/specs/' + (ps.wdioVersion === 6 ? '*.ts' : '**.e2e.ts');
const allSpecs = glob.sync(specsGlob, {});

let allMatchingSpecs: St[] = [...allSpecs];

for (const pattern of allSubCmds) {
  // Dupl filter (987RM29565W)
  allMatchingSpecs = allMatchingSpecs.filter((fileName: St) => {
    // '!' and '0' (like, Nothing, Not) means exclude those tests.
    // (0 is simpler to type on the command line, need not be escaped).
    const shallInclude = pattern[0] !== '0' && pattern[0] !== '!';
    const p = shallInclude ? pattern : pattern.substr(1, 999);  // drop any '!'
    const matchesType = fileName.indexOf(p) >= 0;
    return matchesType === shallInclude;
  });
}


console.log(`Specs patterns:  ${allSubCmdsSt || '(none, will match all)'}`);
console.log(`Specs glob:      ${specsGlob}`);
console.log(`${allMatchingSpecs.length} specs match glob and pattern:\n   - ${
      allMatchingSpecs.join('\n   - ')}\n`);


// Let wdio handle signals, until it exits.
// But maybe exit directly on SIGINT if running >= 2 specs? Then probably not debugging.
process.on('SIGINT', function() {
  if (allMatchingSpecs.length >= 2) {
    logMessage(`Caught SIGINT. Exiting, since >= 2 specs, apparently not debugging.`);
    process.exit(1);
  }
  else {
    logMessage(`Caught SIGINT, not exiting, maybe we're debugging?`);
  }
});


// Can look at node_modules/@wdio/cli/build/launcher.js  to see
// ex of how handle async errs?
//
function runE2eTests(): U | ExitCode | 'TestsCancelled' {
  let zeroOrFirstErrorCode: U | ExitCode | 'TestsCancelled';

  // Command line arguments and the test runners?
  //
  // It seems the Wdio test runner child processes we launch here inherit our
  // command line incl arguments, and same working dir — in local-runner, there's
  // fork() with: { cwd: process.cwd(), env: runnerEnv, execArgv: this.execArgv },
  // see: ../node_modules/@wdio/local-runner/build/worker.js

  function withSpecsMatching(testTypes: St[] | St[][], run: (specs: St[]) =>
          ExitCode | 'DontUpdFirstExitCode') {

    if (_.isString(testTypes[0])) {
      testTypes = [testTypes as St[]];
    }

    dieIf(!testTypes?.[0]?.length, 'TyE38590RTK');
    let specsNow = [];
    for (let tts of testTypes) {
      let moreSpecs = allMatchingSpecs;
      for (let tt of tts) {
        // Dupl filter (987RM29565W)
        moreSpecs = moreSpecs.filter((fileName: St) => {
          // '!' and '0' (like, Nothing, Not) means exclude those tests.
          const shallInclude = tt[0] !== '0' && tt[0] !== '!';
          const pattern = shallInclude ? tt : tt.substr(1, 999);  // drop any '!'
          const matchesType = fileName.indexOf(pattern) >= 0;
          return matchesType === shallInclude;
        });
      }
      specsNow = [...specsNow, ...moreSpecs];
    }

    const what = j2s(testTypes);

    const num = specsNow.length;
    if (num === 0) {
      logMessage(`No specs match in group ${what}`);
      return;
    }

    const sep = '\n   - ';
    logMessage(`Running ${num} matching specs in group ${what}:${
          sep + specsNow.join(sep)}\n`);

    const exitCode = run(specsNow);

    if (exitCode === 'DontUpdFirstExitCode')
      return;

    if (exitCode === null) {
      logWarning(`Exit code null, tests cancelled? [TyM50MWEG1]`);
      zeroOrFirstErrorCode = 'TestsCancelled';
      return;
    }

    dieIf(!_.isNumber(exitCode), `Exit code is not a number: ${exitCode} [TyE4G6SEJ25]`);
    if (!zeroOrFirstErrorCode) {
      zeroOrFirstErrorCode = exitCode;
    }
    const fromWhat = `from specs group: ${what}`;
    if (exitCode !== 0) {
      logErrorNoTrace(`ERROR, exit code ${exitCode} `);
    }
    else {
      logBitHappy(`OK, exit code 0`);
    }
    logMessage(`   ${fromWhat}\n`);
  }


  // Run all variants (e.g. 1br, 2br, 3br) — so we'll find all failing tests
  // without having to restart over and over again:


  // Things that didn't work:
  //
  // 1) Use wdio programaticallly:
  //     import Launcher from '@wdio/cli'
  //     const args = { specs }
  //     const wdio = new Launcher('./tests/e2e/wdio.conf.js', args);
  //     return wdio.run();
  // But that's not flexible enough — the way wdio merges `args` into the
  // config obj from wdio.conf.js seems makes it impossible to configure
  // [number of browsers] from here? For example,
  // see: `merge(object = {}) {...}`
  // in: node_modules/@wdio/config/build/lib/ConfigParser.js
  // Docs: https://webdriver.io/docs/clioptions.html#run-the-test-runner-programmatically
  //
  // 2) Spawn wdio directly, and pipe directly to wdio:
  //
  //     const childProcess = tydutil.spawnInBackground(
  //           'node_modules/.bin/wdio', ['tests/e2e/wdio.conf.js', '--parallel', '3']);
  //     childProcess.stdin.write(specs.join('\n') + '\n');
  //     childProcess.stdin.end();
  //     const promise = new Promise<ExitCode>(function(resolve, reject) {
  //       childProcess.once('exit', function(exitCode: ExitCode) {
  //         resolve(exitCode);
  //       });
  //     })
  //     const exitCode = await promise;
  //     return exitCode;
  //
  // Won't work, because wdio starts before we pipe to it — so wdio looks only
  // at the config file, starts the wrong tests, ignores the stdin pipe input,
  // and exits. But maybe there's a Wdio flag to wait for stdin?
  // I don't see anything in the docs:  https://webdriver.io/docs/clioptions.html
  // (About Nodejs and pipes, see: https://stackoverflow.com/a/52649324)
  //
  // Does work:
  // 3) By using sh -c  we can pipe to Wdio's stdio directly when it starts,
  // like this 'sh -c ... | ...', look:
  //
  //    bash$ sh -c 'echo "aaa\nbb\ncc\n\ndd\n" | cat'
  //    aaa
  //    bb
  //    cc
  //    
  //    dd

  const optsStr = tyu.stringifyOpts(opts) + ' --isInProjBaseDir';

  function runWdioInForeground(specs: St[], wdioArgs: St): Nr {
    // Need to escape the backslask, like this:  `sh -c "...\\n..."`,
    // so that  sh   gets "...\n..." instead of a real line break.
    const specsOnePerLine = specs.join('\n');
    const wdioConfFile = ps.wdioVersion === 6
          ? `${testProjDir}/wdio.conf.js`  // wdio 6, in tests/e2e/.  [wdio_6_to_7]
          : `${testProjDir}/wdio.conf.ts`; // wdio 7, in tests/e2e-wdio7/
    const commandLine =
            `echo "${specsOnePerLine}" ` +
              `| ${testProjDir}/node_modules/.bin/wdio ${wdioConfFile} ${
                    optsStr} ${wdioArgs}`;
    const exitCode = tyu.spawnInForeground('sh', ['-c', commandLine]);
    return exitCode;
  }


  // TODO   Don't run magic time tests in parallel — they mess up the
  // time for each other.



  const skipAlways = ['!UNIMPL', '!-impl.', '!imp-exp-imp-exp-site',
          ];
  const skipEmbAndAlways = ['!embcom', '!embedded-', '!embforum.', ...skipAlways]
  const skip2And3Browsers = ['!.2br', '!.3br', '!.4br'];  // and skip 4 as well


  // ----- 1 browser

  let next: St[] | St[][] = [...skip2And3Browsers, ...skipEmbAndAlways];

  withSpecsMatching(next, (specs: St[]): ExitCode => {
    //const pipeSpecsToWdio__old =
    //        `echo "${ specs.join('\\n') }" ` +
    //          `| node_modules/.bin/wdio  tests/e2e/wdio.conf.js  --parallel 3`;
    return runWdioInForeground(specs, '');
  });

  // ----- 2 browsers

  // This tests needs a static file server.
  // Should rename this test: incl ss8080 in the name? (static server port 8080)
  withSpecsMatching(['sso-login-required-w-logout-url.2br'],
          (): 'DontUpdFirstExitCode' => {
    tyu.startStaticFileServer(8080, 'target/');
    return 'DontUpdFirstExitCode';
  });

  // Tests that don't modify time can run in parallel.
  next = ['.2br', '!.mtime', '!__e2e-test-template__', ...skipEmbAndAlways];

  withSpecsMatching(next, (specs: St[]): ExitCode => {
    return runWdioInForeground(specs, '--2browsers');
  });

  // But tests that do modify time cannot run in parallel (on the same server).
  next = ['.2br', '.mtime', ...skipEmbAndAlways];

  withSpecsMatching(next, (specs: St[]): ExitCode => {
    return runWdioInForeground(specs, '--2browsers --not-parallel');
  });


  // ----- 3 browsers

  next = ['.3br', ...skipEmbAndAlways];

  withSpecsMatching(next, (specs: St[]): ExitCode => {
    return runWdioInForeground(specs, '--3browsers');
  });


  // ----- 4 browsers

  // Just these, currently:
  // d.sessions-logout-elsewhere.4br  TyTESESLGOSELF
  // d.sessions-staff-logout-others.4br  TyTESESLGOOTR

  next = ['.4br', ...skipEmbAndAlways];

  withSpecsMatching(next, (specs: St[]): ExitCode => {
    return runWdioInForeground(specs, '--4browsers');   // UNTESTED
  });


  // ----- 1 browser, embedded comments

  const skip23BrAndUnusualEmb = ['!b3c.', '!gatsby', '!embforum.',
          ...skip2And3Browsers, ...skipAlways];
  // Accidentally different file names.
  next = [['embedded-', ...skip23BrAndUnusualEmb],
          ['embcom.', ...skip23BrAndUnusualEmb]];

  withSpecsMatching(next, (specs: St[]): ExitCode => {
    // Note: 8080 eighty eighty.
    tyu.startStaticFileServer(8080, 'target/');
    return runWdioInForeground(specs,
              // Doesn't work, why not? Disable via xx. (BADSTCSRV)
              // The server starts, lisens to 8080, but never replies to anything :-|
              // Just times out.
              '-xx-static-server-8080 -xx-verbose');
  });


  next = [['embcom.', '.b3c.', '.1br.', ...skipAlways]];

  withSpecsMatching(next, (specs: St[]): ExitCode => {
    tyu.startStaticFileServer(8080, 'target/');
    return runWdioInForeground(specs, ' --b3c ' +
              // Doesn't work (BADSTCSRV)
              '-xx-static-server-8080');
  });


  // ----- 2 browsers, embedded comments

  // (There're currently no emb comments tests that modify time.)

  // Rename somehow to  'embcmt-...'?
  next = [
        ['.2br', 'embedded-', '!.b3c.', ...skipAlways],
        ['.2br', 'embcom', '!.b3c.', ...skipAlways],
        ];

  withSpecsMatching(next, (specs: St[]): ExitCode => {
    tyu.startStaticFileServer(8080, 'target/');
    return runWdioInForeground(specs, ' --2browsers ' +
              // Doesn't work (BADSTCSRV)
              '-xx-static-server-8080');
  });


  // ----- Gatsby, embedded comments

    // Note: 8080 eighty eighty.
  tyu.stopStaticFileServer({ portNr: 8080, stopAnyAndAll: true });

  next = ['embedded-', 'gatsby', ...skip2And3Browsers, ...skipAlways];

  withSpecsMatching(next, (specs: St[]): ExitCode => {
    // Note: 8000 eighty zero zero.
    tyu.startStaticFileServer(8000, 'modules/gatsby-starter-blog/public/');
    return runWdioInForeground(specs,
              // Doesn't work (BADSTCSRV)
              '-xx-static-server-gatsby-v1-8000');
  });

  // Note: 8000 eighty zero zero.
  tyu.stopStaticFileServer({ portNr: 8000, stopAnyAndAll: true });

  withSpecsMatching(next, (specs: St[]): ExitCode => {
    tyu.startStaticFileServer(8000, 'modules/gatsby-starter-blog-ed-comments-0.4.4/public/');
    return runWdioInForeground(specs,
              // Doesn't work (BADSTCSRV)
              '-xx-static-server-gatsby-v1-old-ty-8000');
  });

    // Note: 8000 eighty zero zero.
  tyu.stopStaticFileServer({ portNr: 8000, stopAnyAndAll: true });

  return zeroOrFirstErrorCode;
}



logMessage(`Running e2e tests ...\n`);
let e2eExitCode: ExitCode = 1;

try {
  const code: U | ExitCode | 'TestsCancelled' = runE2eTests();
  const endMs = Date.now();
  const durationMins = (endMs - startMs) / 1000 / 60;
  process.stdout.write('\n');
  if (_.isNumber(code)) {
    e2eExitCode = code;
    if (code === 0) {
      logMuchHappy(`E2E tests OK  `);
    }
    else {
      logErrorNoTrace(`E2E tests FAILED `);
    }
    logMessage(`Tests done after ${prettyNum(durationMins)} minutes, exit code: ${code}`);
  }
  else if (code === 'TestsCancelled') {
    logMessage(`Tests cancelled? [TyME2ECANCLD]`);
  }
  else {
    logErrorNoTrace(`Error: No tests run [TyE0SPECSRUN] `);
  }
}
catch (ex) {
  logErrorNoTrace(`Unexpected exception when running e2e tests [TyEE2EUNEXEX] `, ex);
}

console.log(`Exiting: process.exit(${e2eExitCode})\n`);
process.exit(e2eExitCode);

}