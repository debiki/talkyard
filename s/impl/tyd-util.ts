import * as _  from 'lodash';
import { dieIf } from '../../tests/e2e-wdio7/utils/log-and-die';
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
          `Cannot run two servers with different file dirs on same port ${portNr}:` +
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
