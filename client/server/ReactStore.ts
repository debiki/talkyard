// An implementation is provided in app/debiki/ReactRenderer.scala for server side rendering.


//------------------------------------------------------------------------------
   module debiki2 {
//------------------------------------------------------------------------------

export function win_getSessWinStore(): SessWinStore {
  return (<any> window).theStore;  // [ONESTORE]
}

export function makeNoPageData() { die('K42B01'); }
export function makeAutoPage(pageId?: PageId): any { die('K42B02'); }

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
