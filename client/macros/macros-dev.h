
// Debug build macros, disappears in prod builds.
// Should be uppercase and start with D_ for "dev build" or maybe "debug".

// These macros get processed by the C Preprocessor, 'cpp'. There's a bunch of
// macro processors for typescript and javascript, but they all  become abandonware
// after a while, or don't have enough nice functionality, e.g. gulp-preprocess
// which requires me to add extra '// @if X def' lines above and after
// the dev-build-only stuff. — With gcc we can have minimum noise macros.

// Include the macros as 'void "macro_text"' too, which is what happens
// in prod builds. — So we'll notice any prod macro problems, in dev builds.
// ('void x' is an unary operator that returns 'undefined'.)

#define D_DO(fn)               IF_DBG_do(fn) || "was_macro: D_DO(..)"
#define D_LOG_T(msg)           IF_DBG_logT(msg) || "was_macro: D_LOG_T(msg)"
#define D_LOG_D(msg)           IF_DBG_logD(msg) || "was_macro: D_LOG_D(msg)"
#define D_LOG_M(msg)           IF_DBG_logM(msg) || "was_macro: D_LOG_M(msg)"
#define D_LOG_W(msg)           IF_DBG_logW(msg) || "was_macro: D_LOG_W(msg)"
#define D_LOG_E(msg)           IF_DBG_logE(msg) || "was_macro: D_LOG_E(msg)"
#define D_DIE(errMsg)          IF_DBG_die(errMsg) || "was_macro: D_DIE(errMsg)"
#define D_DIE_IF(test, errMsg) IF_DBG_dieIf(test, errMsg) || "was_macro: D_DIE_IF(test, errMsg)"
