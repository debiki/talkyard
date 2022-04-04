import * as _  from 'lodash';
import * as minimist from 'minimist';
import { die, dieIf, logMessage, logMessageIf, logDebug, logError, logErrorIf, logUnusual
            } from '../tests/e2e-wdio7/utils/log-and-die';
import { argv } from 'process';
import * as tyu from './impl/tyd-util';
import type { ExitCode } from './impl/tyd-util';
import { runE2eTestsExitIfErr } from './impl/tyd-e2e-tests';

/// <reference path="../client/types-and-const-enums.ts" />


// Bash, Zsh, Fish shell command line completion:
// ----------------------------------------------

// Omelette intro: https://github.com/f/omelette/issues/33

const omelette = require('omelette');
const completion = omelette('tyd <mainCmd>')

completion.on('mainCmd', ({ reply }) => {
  reply([
        'h', 'help',
        'u', 'up', //'watchup',
        'up0lim', // no rate limits, for load testing (from a single ip addr)
        'runl', // 'recreate-up-no-limits'  — not impl though. See
                // docker-compose-no-limits.yml.
        'w', 'watch',
        'ps',
        'k', 'kill', 'ka', 'kw',
        'r', 'restart',
        'ra',  // restart app
        'rr',  // rebuild and restart  <some container(s)>
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




// Skip the firts two, argv[1] = /usr/bin/node  argv[2] = <path-to-repo>/s/tyd.
// bash$ script.ts command cmdB cmdC --opt 1 --optB=2
// places [command, cmdB, cmdC] in field '_', and opt-vals in key-vals.
const _tmpCommandsAndOpts: minimist.ParsedArgs = minimist(process.argv.slice(2));
const subCmdsAndOpts = process.argv.slice(3);
const commands = _tmpCommandsAndOpts['_'];
const opts: minimist.ParsedArgs = _tmpCommandsAndOpts;
delete opts._;
 
const mainCmd = commands[0];
if (!mainCmd) {
  logMessage(`Usage:\n    s/tyd some-main-command\n\n` +
        `Open  s/tyd.ts  and read, for details.\n`);
  process.exit(1);
}

dieIf(mainCmd !== process.argv[2], `Weird main command: '${mainCmd}' TyE52SKDM5`)

const mainSubCmd: St = commands[1];
const allSubCmds: St[] = commands.slice(1);
const allSubCmdsSt: St = allSubCmds.join(' ');
let mainCmdIsOk: U | true;

logDebug(`commands: ${commands.join(' ')}`);
logDebug(`    opts: ${JSON.stringify(opts)}`);
logDebug(`opts str: ${tyu.stringifyOpts(opts)}`);

const yarnOfflineSt = opts.offline || opts.o ? '--offline' : '';


if (mainCmd === 'h' || mainCmd === 'help') {
  logMessage(`You help me or I help you? Open  s/tyd.ts  and read`);
  process.exit(0);
}


if (mainCmd === 'nodejs') {
  tyu.spawnInForeground('docker-compose run --rm nodejs ' + subCmdsAndOpts.join(' '));
  process.exit(0);
}


if (mainCmd === 'yarn') {
  // Maybe  --no-bin-links?  [x_plat_offl_builds]
  tyu.spawnInForeground('docker-compose run --rm nodejs yarn ' + subCmdsAndOpts.join(' '));
  process.exit(0);
}


if (mainCmd === 'gulp') {
  tyu.spawnInForeground('docker-compose run --rm nodejs gulp ' + subCmdsAndOpts.join(' '));
  process.exit(0);
}


if (mainCmd === 'cd' || mainCmd === 'clidb') {
  tyu.spawnInForeground('make db-cli');
  process.exit(0);
}


if (mainCmd === 'ca' || mainCmd === 'cliapp') {
  tyu.spawnInForeground('make dead');
  tyu.spawnInForeground('s/d-cli');
  process.exit(0);
}


if (mainCmd === 'ps') {
  tyu.spawnInForeground('docker-compose ps');
  process.exit(0);
}


if (mainCmd === 'l' || mainCmd === 'logs') {
  tailLogsThenExit();
}

function tailLogsThenExit() {
  tyu.spawnInForeground(`docker-compose logs -f --tail 0 ${allSubCmdsSt}`);
  process.exit(0);
}


if (mainCmd === 'lr' || mainCmd === 'logsrecent') {
  tyu.spawnInForeground(`docker-compose logs -f --tail 555 ${allSubCmdsSt}`);
  process.exit(0);
}


if (mainCmd === 'lra' || mainCmd === 'logsrecentapp') {
  tyu.spawnInForeground('docker-compose logs -f --tail 555 app');
  process.exit(0);
}


if (mainCmd === 'lo' || mainCmd === 'logsold') {
  tyu.spawnInForeground(`docker-compose logs ${allSubCmdsSt}`);
  process.exit(0);
}


if (mainCmd === 'tw' || mainCmd === 'transpilewatch') {
  tyu.spawnInForeground(`make debug_asset_bundles`);
  tyu.spawnInForeground('make watch');
  process.exit(0);
}


if (mainCmd === 'w' || mainCmd === 'watch') {
  tyu.spawnInForeground('make watch');
  process.exit(0);
}


if (mainCmd === 'u' || mainCmd === 'up' || mainCmd === 'up0lim') {
  mainCmdIsOk = true;

  const nolimConf = mainCmd !== 'up0lim' ? '' :
          '-f docker-compose.yml -f docker-compose-no-limits.yml';

  // If only starting some specific containers, skip Yarn and Make.
  if (mainSubCmd) {
    tyu.spawnInForeground(`docker-compose ${nolimConf} up -d ${allSubCmdsSt}`);
    tailLogsThenExit();
  }

  // First, update assets bundles once in the foreground — it's annoying
  // if instead that's done while the server is starting, because then the server
  // might decide to stop and restart just to pick up any soon newly built bundles?
  // (Also, log messages from make and the app server get mixed up with each other.)
  // Maybe  --no-bin-links?  [x_plat_offl_builds]
  tyu.spawnInForeground(`docker-compose ${nolimConf} run --rm nodejs yarn install ${yarnOfflineSt}`);
  let exitCode: ExitCode = tyu.spawnInForeground('make debug_asset_bundles');
  if (exitCode >= 1) {
    logError(`Error building asset bundles, Make exit code: ${exitCode}`)
    process.exit(exitCode);
  }

  // Run `up -d` in foreground, so we won't start the `logs -f` process too soon
  // — that process would exit, if `up -d` hasn't yet started any containers.
  tyu.spawnInForeground(`docker-compose ${nolimConf} up -d`);

  // Just this:
  tyu.spawnInForeground(`docker-compose ${nolimConf} logs -f --tail 0`);
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
    // We'll continue after  tyu.spawnInForeground() below. (Need do nothing here.)
  });

  // Show logs until CTRL+C.
  // (There's also:  process.on('SIGINT', function() { ... });
  tyu.spawnInForeground('docker-compose logs -f --tail 0');

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
  tyu.spawnInForeground('sh', ['-c', `s/d kill ${cs}`]);

  // If restarting the web/app, probably we want up-to-date assets?
  if (!containers || containers.includes('web') || containers.includes('app')) {
    logMessage(`Rebuilding assets if needed ...`);
    tyu.spawnInForeground('make debug_asset_bundles');
  }

  logMessage(`Starting containers...`);
  tyu.spawnInForeground('sh', ['-c', `s/d start ${cs}`]);
  tailLogsThenExit();
}


if (mainCmd === 'recreate') {
  const cs = allSubCmdsSt;  // which containers, e.g.  'web app'
  tyu.spawnInForeground('sh', ['-c', `s/d kill ${cs}; s/d rm -f ${cs}; s/d up -d ${cs}`]);
  tailLogsThenExit();
}


if (mainCmd === 'rebuild') {
  rebuild();
  process.exit(0)
}

function rebuild() {
  const cs = allSubCmdsSt;  // which containers, e.g.  'web app'
  logMessage(`\n**Removing: ${cs} **`)
  tyu.spawnInForeground('sh', ['-c', `s/d kill ${cs}; s/d rm -f ${cs}`]);
  logMessage(`\n**Building: ${cs} **`)
  tyu.spawnInForeground('sh', ['-c', `s/d build ${cs}`]);
  logMessage(`\n**Done rebuilding: ${cs}. Bye.**`)
}


if (mainCmd === 'rr' || mainCmd === 'rebuildrestart') {   // was:  'rs' but 'rr' better?
  const cs = allSubCmdsSt;  // which containers
  rebuild();
  logMessage(`\n**Starting: ${cs} **`)
  tyu.spawnInForeground('sh', ['-c', `s/d up -d ${cs}`]);
  tailLogsThenExit();
}


if (mainCmd === 'ka' || (mainCmd === 'kill' && mainSubCmd == 'app')) {
  tyu.spawnInForeground('s/d kill app');
  process.exit(0);
}


if (mainCmd === 'kw' || (mainCmd === 'kill' && mainSubCmd == 'web')) {
  tyu.spawnInForeground('s/d kill web');
  process.exit(0);
}


if (mainCmd === 'k' || mainCmd === 'kill') {
  killAllContainers();
  process.exit(0);
}

function killAllContainers() {
  tyu.spawnInForeground('make dead');
}


if (mainCmd === 'down') {
  killAllContainers();
  tyu.spawnInForeground('s/d down');
  process.exit(0);
}


if (mainCmd === 'cleane2elogs') {
  tyu.spawnInForeground('rm -fr target/e2e-test-logs');
  tyu.spawnInForeground('mkdir target/e2e-test-logs');
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


{
  let wdioVersion: 6 | 7 = 7;

  switch (mainCmd) {
    case 'e6':
    case 'e2e6':
      wdioVersion = 6;
      // Fall through.
    case 'e7':
    case 'e2e7':
      runE2eTestsExitIfErr({ wdioVersion, allSubCmdsSt, allSubCmds, opts });
      process.exit(0);
    default:
      // Continue below.
  }
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

  const exitCode = tyu.spawnInForeground('./node_modules/.bin/jest',
        ['--config', 'tests/api/jest.config.ts'], jestTestEnv);

  process.exit(exitCode);
}


// -----------------------------------------------------------------------
// -----------------------------------------------------------------------


if (!mainCmdIsOk) {
  console.error(`Werid main command: ${mainCmd}. Error. Bye.  [TyE30598256]`);
  process.exit(1);
}