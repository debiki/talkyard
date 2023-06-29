// An implementation is provided in app/debiki/ReactRenderer.scala for server side rendering.


//------------------------------------------------------------------------------
   module debiki2 {
//------------------------------------------------------------------------------

export function win_getSessWinStore(): SessWinStore {
  return (
        // Nashorn (legacy).
        (<any> window).theStore ||
        // Deno (in the future).
        debiki2.ReactStore.allData());   // [ONESTORE]
}

export function makeNoPageData() { die('K42B01'); }
export function makeAutoPage(path?: string) { die('K42B02'); }

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
