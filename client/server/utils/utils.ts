
//------------------------------------------------------------------------------
   module debiki2 {
//------------------------------------------------------------------------------

export function putInLocalStorage(key, value) {
  throw new Error('putInLocalStorage called server side [DwE902D3]');
}

export function getFromLocalStorage(key): string {
  return null;
}

export function getFromSessionStorage(key): string {
  return null;
}

export function removeFromLocalStorage(key) {
  throw new Error('removeFromLocalStorage called server side [DwE8PUMK2]');
}

export function getPageScrollableRect(): ClientRect {
  throw new Error('getPageScrollableRect called server side [DwE2YPK03]');
}

export function getPageRect(): ClientRect {
  throw new Error('getPageRect called server side [DwE7UYKW2]');
}

export function reactGetRefRect(ref): Rect {
  throw new Error('reactGetRefRect called server side [DwE7GDY20C]');
}

export function cloneRect(rect: ClientRect | Rect): Rect {
  throw new Error('cloneRect called server side [DwE8PK0GW1]');
}

export function event_isEnter(event) {
  throw new Error('event_isEnter called server side [DwE5KYF204]');
}

export function event_isCtrlEnter(event) {
  throw new Error('event_isCtrlEnter called server side [DwE3U83Y2]');
}

export function event_isShiftEnter(event) {
  throw new Error('event_isShiftEnter called server side [DwE5YU80]');
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
