/// <reference path="./macros.d.ts" />

// In dev builds, we want the macros to do the below things:

// Don't include in prod builds though — the function names get macros-replaced
// with just 'false', so would become 'function false(..) { .. }'.
// `at-ifdef DEBUG ... at-endif`  gets removed here: [js_macros]

// @ifdef DEBUG

function dev_build__do(fn: () => void) {
  fn();
}

function dev_build__logT(msg: string) {
  console.debug(msg);
}

function dev_build__logD(msg: string) {
  console.debug(msg);
}

function dev_build__logM(msg: string) {
  console.log(msg);
}

function dev_build__logW(msg: string, ex?) {
  console.warn(msg, ex);
}

function dev_build__logE(msg: string, ex?) {
  console.error(msg, ex);
}

function dev_build__die(errMsg: string) {
  // This 'die' pops up a nice dialog.
  window['debiki2']?.die(errMsg);
  throw Error(errMsg);
}

function dev_build__dieIf(test: boolean, errMsg: string) {
  if (test) {
    dev_build__die(errMsg);
  }
}

// @endif
