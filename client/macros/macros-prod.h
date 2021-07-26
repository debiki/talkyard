// Find docs in ./macros-dev.h.

#include "./macros-dev.h"

// #define IF_DBG_DO(fn)               void "was_macro: D_DO(..)"
// #define IF_DBG_LOG_T(msg)           void "was_macro: D_LOG_T(msg)"
// #define IF_DBG_LOG_D(msg)           void "was_macro: D_LOG_D(msg)"
// #define IF_DBG_LOG_M(msg)           void "was_macro: D_LOG_M(msg)"
// #define IF_DBG_LOG_W(msg)           void "was_macro: D_LOG_W(msg)"
// #define IF_DBG_LOG_E(msg)           void "was_macro: D_LOG_E(msg)"
// #define IF_DBG_DIE(errMsg)          void "was_macro: D_DIE(errMsg)"
// #define IF_DBG_DIE_IF(test, errMsg) void "was_macro: D_DIE_IF(test, errMsg)"

#define IF_DBG_do(fn)               false
#define IF_DBG_logT(msg)            false
#define IF_DBG_logD(msg)            false
#define IF_DBG_logM(msg)            false
#define IF_DBG_logW(msg)            false
#define IF_DBG_logE(msg)            false
#define IF_DBG_die(errMsg)          false
#define IF_DBG_dieIf(test, errMsg)  false
