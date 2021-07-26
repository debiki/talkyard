
// Debug build macros, disappears in prod builds.
// Should be uppercase and start with D_ for "dev build" or maybe "debug".

// These macros get processed by the C Preprocessor, 'cpp'. There's a bunch of
// macro processors for typescript and javascript, but they all  become abandonware
// after a while, or don't have enough nice functionality, e.g. gulp-preprocess
// which requires me to add extra '// @if X def' lines above and after
// the dev-build-only stuff. — With gcc we can have minimum noise macros.

#define D_DO(fn)                dev_build__do(fn)
#define D_LOG_T(msg)            dev_build__logT(msg)
#define D_LOG_D(msg)            dev_build__logD(msg)
#define D_LOG_M(msg)            dev_build__logM(msg)
#define D_LOG_W(msg)            dev_build__logW(msg)
#define D_LOG_W2(msg, ex)       dev_build__logW(msg, ex)
#define D_LOG_E(msg)            dev_build__logE(msg)
#define D_LOG_E2(msg, ex)       dev_build__logE(msg, ex)
#define D_DIE(errMsg)           dev_build__die(errMsg)
#define D_DIE_IF(test, errMsg)  dev_build__dieIf(test, errMsg)
