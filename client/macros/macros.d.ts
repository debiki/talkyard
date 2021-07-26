/// <reference path="./types-and-const-enums.ts" />
/// <reference path="./reactjs-types.ts" />

declare function D_DO(fn);
declare function D_LOG_T(msg: St);
declare function D_LOG_D(msg: St);
declare function D_LOG_M(msg: St);
declare function D_LOG_W(msg: St);
declare function D_LOG_E(msg: St);
declare function D_DIE(errMsg: St);
declare function D_DIE_IF(test: Bo, errMsg: St);

/*
function DIE_IF2(test, errMsg) {
  if (test) {
    throw Error(errMsg);
  }
}

namespace tyns {
  export function __dummy__() {}
}

*/