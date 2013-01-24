# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


$('.dw-a-new-forum-topic').click !->
  # Create a new forum thread. Publish it directly, that's how
  # forums usually work?

  # Warning: Dupl code. See AngularJS code in debiki-dashbar.ls.

  # Open new tab directly in response to user click, or browser popup
  # blockers tend to block the new tab.
  newTab = window.open '', '_blank'
  # Create the forum main page before any forum topic,
  # or the topics would have no parent forum main page.
  createThisPageUnlessExists !->
    d.i.createChildPage(
        pageRole: 'ForumTopic', status: 'Published'
        newTab)



/**
 * Creates this page in case it does not exist.
 */
# Warning: Dupl code. See `createThisPageUnlessExists` in debiki-dashbar.ls.
function createThisPageUnlessExists (onSuccess)
  pageMeta = $('.dw-page').dwPageMeta!
  if pageMeta.pageExists
    onSuccess!
    return

  pageMeta.passhash = d.i.parsePasshashInPageUrl!
  newPageData = createPagesUnlessExist: [pageMeta]

  d.u.postJson url: '/-/edit', data: newPageData
      .fail d.i.showServerResponseDialog
      .done !(newDebateHtml) ->
        # Tell any AngularJS parts of the page (e.g. the admin dashbar)
        # that this page now exists.
        d.i.angularApply !(rootScope) ->
          rootScope.pageExists = true

        # Tell any parent pages and any admin dashboard that this page
        # has now been created.
        title = $('.dw-page').dwPageTitleText!
        d.i.forEachOpenerCall 'onOpenedPageSavedCallbacks', [pageMeta, title]

        # Continue with something else.
        onSuccess!



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
