//------------------------------------------------------------------------------
   module debiki2.utils {
//------------------------------------------------------------------------------

export function calcScrollIntoViewCoordsInPageColumn(...whatever): any {
  throw new Error('calcScrollIntoViewCoordsInPageColumn called server side [TyE4ARK053]');
}

export function scrollIntoViewInPageColumn(...whatever) {
  throw new Error('scrollIntoViewInPageColumn called server side [TyE2AS07U3]');
}

export function elemIsVisible(...whatever): boolean {
  throw new Error('elemIsVisible called server side [TyE4AKRB067]');
}

export function makeShowPostFn(...whatever): (event) => V {
  // This fn is called server side, but the returned function isn't called
  // server side.
  return function() {
    throw new Error('makeShowPostFn fn called server side [TyE4AKRB068]');
  };
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=100 list
