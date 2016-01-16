
//------------------------------------------------------------------------------
   module debiki2 {
//------------------------------------------------------------------------------

export function putInLocalStorage(key, value) {
  throw new Error('putInLocalStorage called server side [DwE902D3]');
}

export function getFromLocalStorage(key): string {
  return null;
}

export function removeFromLocalStorage(key) {
  throw new Error('removeFromLocalStorage called server side [DwE8PUMK2]');
}

export function getBoundingPageRect(): ClientRect {
  throw new Error('getBoundingPageRect called server side [DwE2YPK03]');
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
