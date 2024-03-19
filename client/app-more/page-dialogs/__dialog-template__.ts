
/*

Update 2024:
    If you don't know, use  morekit.openProxyDiag().  It works also in embedded iframes
    — it knows if parts of the iframe it is in, isn't visible, because the human has
    scrolled down/up a bit.

    See e.g.: client/app-more/tags/tag-dropdown.more.ts  search for 'openProxyDiag'.


Is there a dialog template?

Almost, look at:  client/app-more/page-dialogs/disc-layout-dialog.more.ts
           here:  ./disc-layout-dialog.more.ts

   and do in that way, for now.

To load data from the server, look at:   ../users/group-members.more.ts


Sometimes you want a mini menu popup, right where you clicked
(necessary if should work in the embedded comments iframe — because if placing
  a modal dialog in the middle & top of the page, it might be outside (above)
  the viewport, if one has scrolled down to view comments futher below),
then use:
            SimpleDropdown — no? I've renamed it to morekit.openProxyDiag() I think.



Panels that load data template?  Maybe:

  export const ListGroupsComponent = React.createFactory<RouteChildProps>(function ...

*/