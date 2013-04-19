# Copyright (c) 2013 Kaj Magnus Lindberg. All rights reserved.  

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


targetPostId = ''


d.i.$showActionDialog = !(whichDialog, event) -->
  event.preventDefault!

  $dialog = switch whichDialog
    | 'CollapseTree' \
      'CollapsePost' => newCollapseDialog whichDialog
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
    submit conf.url

  function submit (apiFunction)
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



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
