import * as _  from 'lodash';
import * as fs from 'fs';
import * as glob from 'glob';
import { die, dieIf, logMessage, logMessageIf, logDebug, logError, logErrorIf, logUnusual
            } from '../../tests/e2e/utils/log-and-die';
import { ChildProcess, spawn as _spawnAsync, spawnSync as _spawnSync } from 'child_process';


export type ExitCode = Nr | Nl;


export function spawnInBackground(cmdMaybeArgs: St, anyArgs?: St[]): ChildProcess { // , opts: { pipeStdIn?: Bo } = {})
  let cmd = cmdMaybeArgs;
  let args = anyArgs;

  if (_.isUndefined(args)) {
    const cmdAndArgs = cmdMaybeArgs.split(' ').filter(v => !!v.trim());
    cmd = cmdAndArgs[0];
    args = cmdAndArgs.slice(1);
  }

  console.log(`\NSPAWN BG:  ${cmd} ${args.join(' ')}\n`);
  //const stdio = opts.pipeStdIn ? ['pipe', process.stdout, process.stderr] : 'inherit';
  const childProcess = _spawnAsync(cmd, args, { detached: true, stdio: 'inherit' });
  //childProcess.stdout.pipe(process.stdout);
  return childProcess;
}


export function spawnInForeground(cmdMaybeArgs: St, anyArgs?: St[], env?: NodeJS.ProcessEnv)
        : ExitCode {
  let cmd = cmdMaybeArgs;
  let args = anyArgs;

  if (_.isUndefined(args)) {
    const cmdAndArgs = cmdMaybeArgs.split(' ').filter(v => !!v.trim());
    cmd = cmdAndArgs[0];
    args = cmdAndArgs.slice(1);
  }

  // For now:
  const envSt = !env ? '' : ('TY_ENV_ARGV_ST="' + env.TY_ENV_ARGV_ST + '"  ');
  console.log(`\nSPAWN FG:\n` +
        `  ${envSt}${cmd} ${args.join(' ')}\n`);

  // stdio 'inherit' makes the child process write directly to our stdout,
  // so colored output and CTRL+C works.
  const result = _spawnSync(cmd, args, { env, stdio: 'inherit' });
  return result.status;
}



export function stringifyOpts(opts: { [k: string]: any }): St {
  return _.map(opts, (v, k: St) => {
    // For now, don't allow quotes in opts?
    const vStr = _.isString(v) ? v : '';
    const hasSingleQuote = vStr.indexOf("'") >= 0;
    const hasDoubleQuote = vStr.indexOf('"') >= 0;
    dieIf(hasSingleQuote || hasDoubleQuote,
          `Opts with single or double quotes ` +
          `not yet supported:  --${k} ${v}  [TyEBADOPT48R5]`);
    //const quote = hasSingleQuote ? '"' : (hasDoubleQuote ? '"' :
    //      // Maybe better use single quotes anyway? So Bash won't do sth weird.
    //      "'"); 
    const quote = "'"; // safest, right
    const spaceValue = v === true ? '' : ` ${quote}${v}${quote}`;
    return `--${k}${spaceValue}`;
  }).join(' ');
}
/*

if (mainCmd === 'e' || mainCmd === 'e2e') {

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
    spawnInForeground(`rmdir ${e2eLogsDirOld}`);
  }
  else {
    // Delete -older, rename -old to -older.
    // `mv -old -older` places -old *inside* -older/  — need to delete it first.
    // (Also with flag --no-target-directory.)
    spawnInForeground(`rm -fr ${e2eLogsDirOlder}`);
    spawnInForeground(`mv ${e2eLogsDirOld} ${e2eLogsDirOlder}`);
  }
}
if (fs.existsSync(e2eLogsDir)) {
  spawnInForeground(`mv -f ${e2eLogsDir} ${e2eLogsDirOld}`);
}
spawnInForeground(`mkdir ${e2eLogsDirOld}`);



// -----------------------------------------------------------------------
//  E2E Tests  (move to other file?)
// -----------------------------------------------------------------------

//const e2eSpecsPattern = `tests/e2e/specs/${subCmd ? `*${subCmd}*.ts` : '*.ts'}`;
//const allMatchingSpecs_old = glob.sync(e2eSpecsPattern, {});

const allSpecs = glob.sync('tests/e2e/specs/*.ts', {});
let allMatchingSpecs: St[] = [...allSpecs];

for (let pattern of allSubCmds) {
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


console.log(`Specs patterns:  ${allSubCmdsSt}`);
console.log(`Specs matching:\n - ${allMatchingSpecs.join('\n - ')}`);


// If we're run
// Let wdio handle signals — until it exits.
// But maybe exit directly on SIGINT if running >= 2 specs? Then probably not debugging.
process.on('SIGINT', function() {
  logMessage(`Caught SIGINT.`);
});

// Can look at node_modules/@wdio/cli/build/launcher.js  to see
// ex of how handle async errs?
//
async function runE2eTests(): Promise<ExitCode> {
  let zeroOrFirstErrorCode: U | Nr;

  // Command line arguments and the test runners?
  //
  // It seems the Wdio test runner child processes we launch here inherit our
  // command line incl arguments, and same working dir — in local-runner, there's
  // fork() with: { cwd: process.cwd(), env: runnerEnv, execArgv: this.execArgv },
  // see: ../node_modules/@wdio/local-runner/build/worker.js

  async function withSpecsMatching(testTypes: St[] | St[][], run: (specs: St[]) =>
          Promise<ExitCode> | 'Skip') {

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
    const num = specsNow.length;
    if (num >= 1) {
      const sep = '\n - ';
      const what = `'${testTypes.join(' ')}'`;
      logMessage(`Running ${num} specs matching ${what}:` + sep + specsNow.join(sep));

      const exitCode = await run(specsNow);
      if (exitCode === 'Skip')
        return;

      if (!zeroOrFirstErrorCode) {
        zeroOrFirstErrorCode = exitCode;
      }
      logErrorIf(exitCode !== 0, `ERROR exit code ${exitCode} from:  ${what}`);
      logMessageIf(exitCode === 0, `Done, fine, exit code 0 from:  ${what}`);
    }
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
  //     const childProcess = spawnInBackground(
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

  const optsStr = stringifyOpts(opts) + ' --isInProjBaseDir';

  async function runWdioInForeground(specs: St[], wdioArgs: St): Promise<Nr> {
    // Need to escape the backslask, like this:  `sh -c "...\\n..."`,
    // so that  sh   gets "...\n..." instead of a real line break.
    const specsOnePerLine = specs.join('\\n');
    // This is for wdio 6, located in tests/e2e/.  [wdio_6_to_7]
    const commandLine = `echo "${specsOnePerLine}" ` +
              `| tests/e2e/node_modules/.bin/wdio tests/e2e/wdio.conf.js ${optsStr} ${wdioArgs}`;
    const exitCode = await spawnInForeground('sh', ['-c', commandLine]);
    return exitCode;
  }


  // TODO   Don't run magic time tests in parallel — they mess up the
  // time for each other.
  */

interface StaticFileServer {
  serverProcess: ChildProcess;
  relativeFileDir: St;
  numWantsIt: Nr;
}

const serverAndDirByPort: { [portNr: string]: StaticFileServer } = {};

export function startStaticFileServer(portNr: Nr, relativeFileDir: St) {
  const server = serverAndDirByPort[portNr];
  if (!server) {
    const serverProcess: ChildProcess = spawnInBackground(
            `node_modules/.bin/http-server -p${portNr} ${relativeFileDir}`);
    serverAndDirByPort[portNr] = {
      serverProcess,
      relativeFileDir,
      numWantsIt: 1,
    };
  }
  else {
    dieIf(server.relativeFileDir !== relativeFileDir,
          `Trying to starts many servers on the same port, but different file dirs:` +
          `    old server.relativeFileDir: ${server.relativeFileDir}\n` +
          `    new server.relativeFileDir: ${relativeFileDir} ` +
          `  [TyE60RMD25]`);
    server.numWantsIt = server.numWantsIt + 1;
  }
}


export function stopStaticFileServer(ps: { portNr: Nr, stopAnyAndAll?: Bo }) {
  const server = serverAndDirByPort[ps.portNr];
  if (!server && ps.stopAnyAndAll)
    return;

  dieIf(!server, `No server to stop at port ${ps.portNr} [TyE60RMD27]`);
  server.numWantsIt = server.numWantsIt - 1;
  dieIf(server.numWantsIt < 0, `Less than 0 wants server [TyE60RMD28]`);
  if (server.numWantsIt === 0 || ps.stopAnyAndAll) {
    const childProcess: ChildProcess = server.serverProcess;
    childProcess.kill();
    delete serverAndDirByPort[ps.portNr];
  }
}

/*
  const skipAlways = ['!UNIMPL', '!-impl.', '!imp-exp-imp-exp-site'];
  const skipEmbAndAlways = ['!embcom', '!embedded-', '!embforum.', ...skipAlways]
  const skip2And3Browsers = ['!.2br', '!.3br'];


  // ----- 1 browser

  let next: St[] | St[][] = [...skip2And3Browsers, ...skipEmbAndAlways];

  await withSpecsMatching(next, async (specs: St[]): Promise<ExitCode> => {
    //const pipeSpecsToWdio__old =
    //        `echo "${ specs.join('\\n') }" ` +
    //          `| node_modules/.bin/wdio  tests/e2e/wdio.conf.js  --parallel 3`;
    return runWdioInForeground(specs, '');
  });


  // ----- 2 browsers

  // This tests needs a static file server.
  // Should rename this test: incl ss8080 in the name? (static server port 8080)
  await withSpecsMatching(['sso-login-required-w-logout-url.2br'], (): 'Skip' => {
    startStaticFileServer(8080, 'target/');
    return 'Skip';
  });

  // Tests that don't modify time can run in parallel.
  next = ['.2br', '!.mtime', '!__e2e-test-template__', ...skipEmbAndAlways];

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    return runWdioInForeground(specs, '--2browsers');
  });

  // But tests that do modify time cannot run in parallel (on the same server).
  next = ['.2br', '.mtime', ...skipEmbAndAlways];

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    return runWdioInForeground(specs, '--2browsers --not-parallel');
  });


  // ----- 3 browsers

  next = ['.3br', ...skipEmbAndAlways];

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    return runWdioInForeground(specs, '--3browsers');
  });


  // ----- 1 browser, embedded comments

  const skip23BrAndUnusualEmb = ['!b3c.', '!gatsby', '!embforum.',
          ...skip2And3Browsers, ...skipAlways];
  // Accidentally different file names.
  next = [['embedded-', ...skip23BrAndUnusualEmb],
          ['embcom.', ...skip23BrAndUnusualEmb]];

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    // Note: 8080 eighty eighty.
    startStaticFileServer(8080, 'target/');
    return await runWdioInForeground(specs,
              // Doesn't work, why not? Disable via xx. (BADSTCSRV)
              // The server starts, lisens to 8080, but never replies to anything :-|
              // Just times out.
              '-xx-static-server-8080 -xx-verbose');
  });


  next = [['embcom.', '.b3c.', '.1br.', ...skipAlways]];

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    startStaticFileServer(8080, 'target/');
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

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    startStaticFileServer(8080, 'target/');
    return runWdioInForeground(specs, ' --2browsers ' +
              // Doesn't work (BADSTCSRV)
              '-xx-static-server-8080');
  });


  // ----- Gatsby, embedded comments

    // Note: 8080 eighty eighty.
  stopStaticFileServer(8080);

  next = ['embedded-', 'gatsby', ...skip2And3Browsers, ...skipAlways];

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    // Note: 8000 eighty zero zero.
    startStaticFileServer(8000, 'modules/gatsby-starter-blog/public/');
    return runWdioInForeground(specs,
              // Doesn't work (BADSTCSRV)
              '-xx-static-server-gatsby-v1-8000');
  });

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    startStaticFileServer(8000, 'modules/gatsby-starter-blog-ed-comments-0.4.4/public/');
    return runWdioInForeground(specs,
              // Doesn't work (BADSTCSRV)
              '-xx-static-server-gatsby-v1-old-ty-8000');
  });

    // Note: 8000 eighty zero zero.
  stopStaticFileServer(8000);

  return zeroOrFirstErrorCode;
}



console.log(`Running e2e tests ...`);

runE2eTests().then((code) => {
  const isFine = code === 0;
  const fineOrFailed = isFine ? 'fine' : 'tests FAILED';
  const logFn = isFine ? logMessage : logError;
  logFn(`\n\nDone running e2e tests, exit code: ${code}, ${fineOrFailed}\n`);
  logErrorIf(code === undefined, `Error: Didn't run any tests at all [TyE0SPECSRUN]`);
  process.exit(code);
}, (error) => {
  console.error(`Error starting tests [TyEE2ESTART]`, error);  // error.stacktrace ?
  process.exit(1);
});


}
else if (!mainCmdIsOk) {
  console.error(`Werid main command: ${mainCmd}. Error. Bye.  [TyE30598256]`);
  process.exit(1);
}
*/