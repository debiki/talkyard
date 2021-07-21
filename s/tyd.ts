import * as _  from 'lodash';
import * as minimist from 'minimist';
import * as fs from 'fs';
import * as glob from 'glob';
import { die, dieIf, logMessage, logMessageIf, logDebug, logError, logErrorIf, logUnusual
            } from '../tests/e2e/utils/log-and-die';
import { ChildProcess, spawn as _spawnAsync, spawnSync as _spawnSync } from 'child_process';
import { argv } from 'process';

// Bash, Zsh, Fish shell command line completion:
// ----------------------------------------------

// Omelette intro: https://github.com/f/omelette/issues/33

const omelette = require('omelette');
const completion = omelette('tyd <mainCmd>')

completion.on('mainCmd', ({ reply }) => {
  reply([
        'h', 'help',
        'u', 'up', //'watchup',
        'runl', // 'recreate-up-no-limits'  — not impl though. See
                // docker-compose-no-limits.yml.
        'w', 'watch',
        'ps',
        'k', 'kill', 'ka', 'kw',
        'r', 'restart', 'ra',
        'down',
        'recreate',
        'rebuild',
        'l', 'logs', 'lr', 'logsrecent',
        'lo', 'logsold',
        'e', 'e2e',
        'cleane2elogs',
        'cd', 'clidb',
        'ca', 'cliapp',
        'nodejs',
        'yarn',
        'gulp',
        ]);
});

completion.init();


// Nice!: https://github.com/f/omelette  — zero deps :-)
// or?: https://github.com/mattallty/Caporal.js — no, to many deps.
// (There's also:  https://github.com/mklabs/tabtab but abandoned?)

// Maybe later: https://github.com/denoland/deno, nice!: function Deno.watchFs

//   this:  s/tyd e2e extaut
//   runs all end-to-end tests for auth at external IDP (e.g. FB or Gmail)
//
// Test traits:
//  1br, 2br, 3br,  b3c  mtime  extaut extln  odic  embcom  embfor
//
// Ex:
// signup-w-goog.1br.extaut.ts
// signup-w-linkedin.1br.extaut.ts
// link-previews-twitter.1br.extln.ts


type ExitCode = Nr | Nl;


function spawnInBackground(cmdMaybeArgs: St, anyArgs?: St[]): ChildProcess { // , opts: { pipeStdIn?: Bo } = {})
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


function spawnInForeground(cmdMaybeArgs: St, anyArgs?: St[], env?: NodeJS.ProcessEnv)
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



// Skip the firts two, argv[1] = /usr/bin/node  argv[2] = <path-to-repo>/s/tyd.
// bash$ script.ts command cmdB cmdC --opt 1 --optB=2
// places [command, cmdB, cmdC] in field '_', and opt-vals in key-vals.
const _tmpCommandsAndOpts: any = minimist(process.argv.slice(2));
const subCmdsAndOpts = process.argv.slice(3);
const commands = _tmpCommandsAndOpts['_'];
const opts = _tmpCommandsAndOpts;
delete opts._;
 
const mainCmd = commands[0];
dieIf(!mainCmd, `No main command? '${process.argv.join(' ')}' TyE52SKDM7`)
dieIf(mainCmd !== process.argv[2], `Weird main command: '${mainCmd}' TyE52SKDM5`)

const mainSubCmd: St = commands[1];
const allSubCmds: St[] = commands.slice(1);
const allSubCmdsSt: St = allSubCmds.join(' ');
let mainCmdIsOk: U | true;

function stringifyOpts(opts: { [k: string]: any }): St {
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

logDebug(`commands: ${commands.join(' ')}`);
logDebug(`    opts: ${JSON.stringify(opts)}`);
logDebug(`opts str: ${stringifyOpts(opts)}`);

const yarnOfflineSt = opts.offline || opts.o ? '--offline' : '';


if (mainCmd === 'h' || mainCmd === 'help') {
  logMessage(`You help me or I help you?`);
  process.exit(0);
}


if (mainCmd === 'nodejs') {
  spawnInForeground('docker-compose run --rm nodejs ' + subCmdsAndOpts.join(' '));
  process.exit(0);
}


if (mainCmd === 'yarn') {
  // Maybe  --no-bin-links?  [x_plat_offl_builds]
  spawnInForeground('docker-compose run --rm nodejs yarn ' + subCmdsAndOpts.join(' '));
  process.exit(0);
}


if (mainCmd === 'gulp') {
  spawnInForeground('docker-compose run --rm nodejs gulp ' + subCmdsAndOpts.join(' '));
  process.exit(0);
}


if (mainCmd === 'cd' || mainCmd === 'clidb') {
  spawnInForeground('make db-cli');
  process.exit(0);
}


if (mainCmd === 'ca' || mainCmd === 'cliapp') {
  spawnInForeground('make dead');
  spawnInForeground('s/d-cli');
  process.exit(0);
}


if (mainCmd === 'ps') {
  spawnInForeground('docker-compose ps');
  process.exit(0);
}


if (mainCmd === 'l' || mainCmd === 'logs') {
  tailLogsThenExit();
}

function tailLogsThenExit() {
  spawnInForeground(`docker-compose logs -f --tail 0 ${allSubCmdsSt}`);
  process.exit(0);
}


if (mainCmd === 'lr' || mainCmd === 'logsrecent') {
  spawnInForeground(`docker-compose logs -f --tail 555 ${allSubCmdsSt}`);
  process.exit(0);
}


if (mainCmd === 'lra' || mainCmd === 'logsrecentapp') {
  spawnInForeground('docker-compose logs -f --tail 555 app');
  process.exit(0);
}


if (mainCmd === 'lo' || mainCmd === 'logsold') {
  spawnInForeground(`docker-compose logs ${allSubCmdsSt}`);
  process.exit(0);
}


if (mainCmd === 'tw' || mainCmd === 'transpilewatch') {
  spawnInForeground(`make debug_asset_bundles`);
  spawnInForeground('make watch');
  process.exit(0);
}


if (mainCmd === 'w' || mainCmd === 'watch') {
  spawnInForeground('make watch');
  process.exit(0);
}


if (mainCmd === 'u' || mainCmd === 'up') {
  mainCmdIsOk = true;

  // If only starting some specific containers, skip Yarn and Make.
  if (mainSubCmd) {
    spawnInForeground(`docker-compose up -d ${allSubCmdsSt}`);
    tailLogsThenExit();
  }

  // First, update assets bundles once in the foreground — it's annoying
  // if instead that's done while the server is starting, because then the server
  // might decide to stop and restart just to pick up any soon newly built bundles?
  // (Also, log messages from make and the app server get mixed up with each other.)
  // Maybe  --no-bin-links?  [x_plat_offl_builds]
  spawnInForeground(`docker-compose run --rm nodejs yarn install ${yarnOfflineSt}`);
  let exitCode = spawnInForeground('make debug_asset_bundles');
  if (exitCode >= 1) {
    logError(`Error building asset bundles, Make exit code: ${exitCode}`)
    process.exit(exitCode);
  }

  // Run `up -d` in foreground, so we won't start the `logs -f` process too soon
  // — that process would exit, if `up -d` hasn't yet started any containers.
  spawnInForeground('docker-compose up -d');

  // Just this:
  spawnInForeground('docker-compose logs -f --tail 0');
  // ... instead of the below,

  // ... Skip this, because 'make watch' and assets rebuild problems
  // can get hidden by app server log messages.
  // Better use two different shell terminals, split screen,
  // one for building assets, another for app & web server logs.
  // And, slightly complicated with a background process and terminating it later.
  // Now time to start rebuilding asset bundles in the background, when needed.
  /*
  const rebuildAssetsCmd = 'make watch';
  const watchChildProcess = spawnInBackground(rebuildAssetsCmd);

  const watchExitedPromise = new Promise<ExitCode>(function(resolve, reject) {
    watchChildProcess.once('exit', function(exitCode: ExitCode) {
      (makeShouldExit ? logMessage : logError)(
            `'${rebuildAssetsCmd}' exited, code: ${exitCode}`);
      resolve(exitCode);
    });
  })

  let makeShouldExit = false;

  // Don't exit immetiately on CTRL+C — first, stop  make watch.
  // But!  'make watch' uses inotifywait, which con't stop :-(
  // Maybe switch to https://github.com/paulmillr/chokidar  instead?
  // And watch client/  and app/  and ty-dao-rdb  and ty-core, call Make
  // on any change?
  process.on('SIGINT', function() {
    logMessage(`Caught SIGINT.`);
    // We'll continue after  spawnInForeground() below. (Need do nothing here.)
  });

  // Show logs until CTRL+C.
  // (There's also:  process.on('SIGINT', function() { ... });
  spawnInForeground('docker-compose logs -f --tail 0');

  logMessage(`Stopping '${rebuildAssetsCmd}' ...`);
  makeShouldExit = true;
  watchChildProcess.kill();

  setTimeout(function() {
    logError(`'${rebuildAssetsCmd}' takes long to exit, I'm quitting anyway, bye.`);
    process.exit(0);
  }, 9000);

  watchExitedPromise.finally(function() {
    logMessage(`Bye. Server maybe still running.`);
    process.exit(0);
  });
  */
}


if (mainCmd === 'ra') {
  restartContainers('app');
}
if (mainCmd === 'r' || mainCmd === 'restart') {
  restartContainers(allSubCmdsSt); // e.g. 'web app'
}

function restartContainers(containers: St) {
  const cs = (containers || '').trim();
  logMessage(cs ? `Stopping containers: ${cs}...` : `Stopping all containers...`);
  spawnInForeground('sh', ['-c', `s/d kill ${cs}`]);

  // If restarting the web/app, probably we want up-to-date assets?
  if (!containers || containers.includes('web') || containers.includes('app')) {
    logMessage(`Rebuilding assets if needed ...`);
    spawnInForeground('make debug_asset_bundles');
  }

  logMessage(`Starting containers...`);
  spawnInForeground('sh', ['-c', `s/d start ${cs}`]);
  tailLogsThenExit();
}


if (mainCmd === 'recreate') {
  const cs = allSubCmdsSt;  // which containers, e.g.  'web app'
  spawnInForeground('sh', ['-c', `s/d kill ${cs}; s/d rm -f ${cs}; s/d up -d ${cs}`]);
  tailLogsThenExit();
}


if (mainCmd === 'rebuild') {
  rebuild();
}

function rebuild() {
  const cs = allSubCmdsSt;  // which containers, e.g.  'web app'
  logMessage(`\n**Removing: ${cs} **`)
  spawnInForeground('sh', ['-c', `s/d kill ${cs}; s/d rm -f ${cs}`]);
  logMessage(`\n**Building: ${cs} **`)
  spawnInForeground('sh', ['-c', `s/d build ${cs}`]);
  logMessage(`\n**Done rebuilding: ${cs}. Bye.**`)
  process.exit(0)
}


if (mainCmd === 'rs' || mainCmd === 'rebuildrestart') {
  const cs = allSubCmdsSt;  // which containers
  rebuild();
  logMessage(`\n**Starting: ${cs} **`)
  spawnInForeground('sh', ['-c', `s/d up -d ${cs}`]);
  tailLogsThenExit();
}


if (mainCmd === 'ka' || (mainCmd === 'kill' && mainSubCmd == 'app')) {
  spawnInForeground('s/d kill app');
  process.exit(0);
}


if (mainCmd === 'kw' || (mainCmd === 'kill' && mainSubCmd == 'web')) {
  spawnInForeground('s/d kill web');
  process.exit(0);
}


if (mainCmd === 'k' || mainCmd === 'kill') {
  killAllContainers();
  process.exit(0);
}

function killAllContainers() {
  spawnInForeground('make dead');
}


if (mainCmd === 'down') {
  killAllContainers();
  spawnInForeground('s/d down');
  process.exit(0);
}


if (mainCmd === 'cleane2elogs') {
  spawnInForeground('rm -fr target/e2e-test-logs');
  spawnInForeground('mkdir target/e2e-test-logs');
  process.exit(1);
}


// -----------------------------------------------------------------------
//  E2E and API tests
// -----------------------------------------------------------------------

const useHttps = argv.includes('--secure') || argv.includes('--https');

if (useHttps) {
  logMessage(`Will use HTTPS, because --secure flag. Disabling HTTPS certificate checks`);
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';
}


// -----------------------------------------------------------------------
//  API and Typescript/Reactjs unit tests
// -----------------------------------------------------------------------

// We use Jest, but Jest doesn't like custom command line flags — it says
// 'Unrecognized option "the_option_name"' and exits.
// Instead, we'll pass Ty command line options to Ty's test suite code,
// via an env var — this, Jest won't notice.


if (mainCmd === 'tapi' || mainCmd === 'testapi') {
  const jestTestEnv: NodeJS.ProcessEnv = {
    // slice(2) drops 's/tyd testapi'.
    'TY_ENV_ARGV_ST': process.argv.slice(2).join(' '),  // use json instead
  };

  // (Another approach could be sth like:
  // process.env.__CONFIG = JSON.stringify(...)
  // require('jest-cli/bin/jest');
  // process.argv = ['node', 'jest', '--config', 'tests/api/jest.config.ts']
  // — but won't work, if we switch to Deno instead, for this s/tyd.ts script?)

  spawnInForeground('./node_modules/.bin/jest',
        ['--config', 'tests/api/jest.config.ts'], jestTestEnv);

  process.exit(1);
}

// -----------------------------------------------------------------------
// -----------------------------------------------------------------------



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

  const serverAndDirByPort: { [portNr: string]: [ChildProcess, St] } = {};

  function startStaticFileServer(portNr: Nr, relDir: St) {
    const anyOld = serverAndDirByPort[portNr];
    if (anyOld) {
      const oldDir = anyOld[1];
      if (oldDir === relDir) {
        // Already started.
        return;
      }
      const oldServer: ChildProcess = anyOld[0];
      oldServer.kill();
    }
    const cp = spawnInBackground(`node_modules/.bin/http-server -p${portNr} ${relDir}`);
    serverAndDirByPort[portNr] = [cp, relDir];
  }

  function stopStaticFileServer(portNr: Nr) {
    const anyOld = serverAndDirByPort[portNr];
    if (anyOld) {
      const oldServer: ChildProcess = anyOld[0];
      oldServer.kill();
    }
  }


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