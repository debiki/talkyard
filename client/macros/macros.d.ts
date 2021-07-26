/// <reference path="./../types-and-const-enums.ts" />
/// <reference path="./../reactjs-types.ts" />

// These macros get changed to: dev_build__do/logT/logD/logM(..) etc in dev builds,
// but in prod builds, get changed to: void 0 = undefined, and removed by the minifier.
declare function D_DO(fn);
declare function D_LOG_T(msg: St);
declare function D_LOG_D(msg: St);
declare function D_LOG_M(msg: St);
declare function D_LOG_W(msg: St);
declare function D_LOG_W2(msg: St, ex);
declare function D_LOG_E(msg: St);
declare function D_LOG_E2(msg: St, ex);
declare function D_DIE(errMsg: St);
declare function D_DIE_IF(test: Bo, errMsg: St);