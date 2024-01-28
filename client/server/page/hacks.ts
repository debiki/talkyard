
//------------------------------------------------------------------------------
   namespace debiki2.page.Hacks {
//------------------------------------------------------------------------------

export function navigateTo(path: St): V | true {
  // Noop, when server side rendering.
}

export const ExtReactRootNavComponent = createReactClass({
  render: function() {
    return null;
  }
});


export function reactRouterLinkifyTopHeaderLinks() {
  // Noop.
}


export function processPosts(startElemId?: string) {
  // Noop.
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
