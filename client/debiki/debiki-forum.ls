# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


$('.dw-a-new-forum-topic').click !->
  # Create a new forum thread. Publish it directly, that's how
  # forums usually work?

  # Warning: Dupl code. See AngularJS code in debiki-dashbar.ls.

  # Create the forum main page before any forum topic,
  # or the topics would have no parent forum main page.
  createThisPageUnlessExists !->
    # Open the new topic in the current browser tab, so there won't be
    # any old forum topic list tab that doesn't list the new topic.
    d.i.createChildPage(
        pageRole: 'ForumTopic', status: 'Published'
        window)



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



/**
 * Toggles open forum topic list items on hover (after you've hovered
 * for about one second).
 */
debiki.scriptLoad.done !->

  # Open topic on <li> click.
  $('.dw-forum-topic-list > li').click !(event) ->
    # But not if clicked a link.
    return if $(event.target).is 'a'
    topicUrl = $(this).find('.topic-title').attr 'href'
    window.location = topicUrl

  # Show excerpt on <li> hover.

  return unless $.fn.hover
  slideHandle = null

  function cancelPendingSlide
    return unless slideHandle
    clearTimeout slideHandle
    slideHandle := null

  $('.dw-forum-topic-list > li').hover(
      !->
        cancelPendingSlide!
        elemHovered = this
        topicExcerpt = $(elemHovered).children('.accordion-toggle')[0]
        slideHandle := setTimeout(
          !->
            $(elemHovered)
                .closest('.dw-forum-topic-list')
                .find('li > .accordion-toggle')
                .filter((index, elem) -> elem != topicExcerpt)
                .stop(true, true)
                .slideUp!
            $(topicExcerpt).slideDown!
          500)
      !->
        cancelPendingSlide!
      )


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
