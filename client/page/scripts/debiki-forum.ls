/* Forum topic list stuff, e.g. a create-new-topic button.
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


$newTopicBtn = $('.dw-a-new-forum-topic')
$newTopicBtn.each d.i.$loginSubmitOnClick!
$newTopicBtn.closest('form').submit ->
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
  false



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
  pageMeta.newPageApproval = d.i.parseApprovalInPageUrl!
  newPageData = createPagesUnlessExist: [pageMeta]

  d.u.postJson url: "#{d.i.serverOrigin}/-/edit", data: newPageData
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
 * Shows forum topic excerpts on click (like an accordion), for desktops only.
 */
debiki.scriptLoad.done !->

  return if Modernizr.touch

  # Slide down excerpt on <li> click; slide up other excerpts.
  $('.dw-forum-topic-list > li').click !(event) ->

    # Ignore links though.
    return if $(event.target).is 'a'

    $elemHovered = $(this)
    topicExcerpt = $elemHovered.children('.accordion-toggle')[0]

    # Slide up other excerpts.
    $elemHovered
        .closest('.dw-forum-topic-list')
        .find('li > .accordion-toggle')
        .filter((index, elem) -> elem != topicExcerpt)
        .stop(true, true)
        .slideUp!

    # Slide down the one clicked (or up, if already slided down).
    $(topicExcerpt).slideToggle!


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
