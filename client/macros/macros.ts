// These macros get expanded to the IF_DBG_... below, which, in prod builds,
// get expanded to nothing (to `(false || void "..")` = undefined),
// and removed by the minifier.
declare function D_DO(fn: (...args) => any): false;
declare function D_LOG_T(msg: string): false;
declare function D_LOG_D(msg: string): false;
declare function D_LOG_M(msg: string): false;
declare function D_LOG_W(msg: string): false;
declare function D_LOG_E(msg: string): false;
declare function D_DIE(errMsg: string): false;
declare function D_DIE_IF(test: boolean, errMsg: string): false;


// In dev builds, we want the macros to do the below things:

// Don't include in prod builds though — the function names get macros-replaced
// with just 'false', so would become 'function false(..) { .. }'.
// ifdef DEBUG gets removed here: [js_macros]
// @ifdef DEBUG

function IF_DBG_do(fn: () => void) {
  fn();
  return false;
}

function IF_DBG_logT(msg: string) {
  console.debug(msg);
  return false;
}

function IF_DBG_logD(msg: string) {
  console.debug(msg);
  return false;
}

function IF_DBG_logM(msg: string) {
  console.log(msg);
  return false;
}

function IF_DBG_logW(msg: string) {
  console.warn(msg);
  return false;
}

function IF_DBG_logE(msg: string) {
  console.error(msg);
  return false;
}

function IF_DBG_die(errMsg: string) {
  // This 'die' pops up a nice dialog.
  if (window['debiki2'].die) window['debiki2'].die(errMsg);
  else throw Error(errMsg);
  return false;
}

function IF_DBG_dieIf(test: boolean, errMsg: string) {
  if (window['debiki2'].dieIf) window['debiki2'].dieIf(test, errMsg);
  else {
    if (test) throw Error(errMsg);
  }
  return false;
}

// @endif
