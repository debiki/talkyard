// These dummy types prevent compilation errors when compiling TypeScript for
// server side rendering.
//
// The classes listed below aren't included among the server side TypeScript files,
// so unless they're declared here the TypeScript compiler complains.


declare namespace debiki2 {
  var ReactActions: any;
  var ReactStore: any;
  var StoreListenerMixin: any;

  namespace utils {
    export const maybeRunTour: any;
  }
}

