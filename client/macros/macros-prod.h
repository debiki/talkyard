// Find docs in ./macros-dev.h.

// Define the macros to 'void 0' i.e. undefined, which is what the function calls
// return in dev builds — so the prod build behaves in the same way, except
// that it won't log / do anything.

#define D_DO(fn)                void 0
#define D_LOG_T(msg)            void 0
#define D_LOG_D(msg)            void 0
#define D_LOG_M(msg)            void 0
#define D_LOG_W(msg)            void 0
#define D_LOG_W2(msg, ex)       void 0
#define D_LOG_E(msg)            void 0
#define D_LOG_E2(msg, ex)       void 0
#define D_DIE(errMsg)           void 0
#define D_DIE_IF(test, errMsg)  void 0
