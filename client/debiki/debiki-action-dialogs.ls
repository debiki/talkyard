/* Shows action dialogs, e.g. a collapse comment dialog.
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


targetPostId = ''


d.i.$showActionDialog = !(whichDialog, event) -->
  event.preventDefault!

  $dialog = switch whichDialog
    | 'CollapseTree' \
      'CollapsePost' => newCollapseDialog whichDialog
    | 'CloseTree' => newCloseTreeDialog!
    | _ => die 'DwE8GA1'

  # Pass data to dialog via shared variable `targetPostId`.
  $thread = $(this).closest '.dw-t'
  $post = $thread.children '.dw-p'
  targetPostId := $post.dwPostId!

  $dialog.dialog('open')

    #parent().position({
    #my: 'center top', at: 'center bottom', of: $post, offset: '0 40'});



function newCollapseDialog (whichDialog)
  conf = switch whichDialog
    | 'CollapsePost' =>
        title: 'Collapse Comment?'
        details: 'Collapse this comment? (Not any replies, only the comment)'
        url: '/-/collapse-post'
    | 'CollapseTree' =>
        title: 'Collapse Thread?'
        details: 'Collapse this comment and all replies?'
        url: '/-/collapse-tree'
    | _ => die 'DwE7BE8'

  $dialog = collapseDialogHtml conf
  $dialog.dialog $.extend({}, d.i.jQueryDialogDestroy)

  $dialog.find('.dw-fi-cancel').button!click !->
    $dialog.dialog 'close'

  $dialog.find('.dw-f-collapse-yes').button!click ->
    submit $dialog, conf.url

  $dialog



function collapseDialogHtml (conf)
  # (Watch out for XSS, only use safe things from `conf` above.)
  $("""
    <div title="#{conf.title}">
      <p><small>
        When you collapse something, it's made small, so it won't grab
        people's attention. You can do this to hide uninteresting things.
      </small></p>
      <p>#{conf.details}</p>
      <form id="dw-f-collapse">
        <input type="submit" class="dw-f-collapse-yes" value="Yes, collapse"/>
        <input type="button" class="dw-fi-cancel" value="Cancel"/>
      </form>
    </div>
    """)



function newCloseTreeDialog

  $dialog = closeTreeDialogHtml!
  $dialog.dialog $.extend({}, d.i.jQueryDialogDestroy)

  $dialog.find('.dw-fi-cancel').button!click !->
    $dialog.dialog 'close'

  $dialog.find('.dw-f-close-yes').button!click ->
    submit $dialog, '/-/close-tree'

  $dialog



function closeTreeDialogHtml()
  $("""
    <div title="Close?">
      <p><small>
        When you close something, it's tucked away under a
        Closed Threads section. Do this if something is no longer
        of relevance, e.g. a comment about a bug that has been fixed.
      </small></p>
      <form id="dw-f-close">
        <input type="submit" class="dw-f-close-yes" value="Yes, close"/>
        <input type="button" class="dw-fi-cancel" value="Cancel"/>
      </form>
    </div>
    """)



function submit($dialog, apiFunction)
  data = [{ pageId: d.i.pageId, actionId: targetPostId }]
  d.u.postJson { url: apiFunction, data }
      .fail d.i.showServerResponseDialog
      .done !(newDebateHtml) ->
        result = d.i.patchPage newDebateHtml
        result.patchedThreads[0].dwScrollIntoView!
      .always !->
        $dialog.dialog 'close'

  # Prevent browser's built-in action.
  false


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
