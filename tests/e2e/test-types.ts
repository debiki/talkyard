/// <reference path="./test-types2.ts" />
/// <reference path="./pub-api.ts" />

// This results in a weird outside-the-project error:
//xx <reference path="../../../modules/definitely-typed/types/mocha/index.d.ts"/>
// instead:
declare const it: any;
declare const describe: any;


