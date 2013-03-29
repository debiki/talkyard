# Copyright (c) 2013 Kaj Magnus Lindberg. All rights reserved.  

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


targetPostId = ''


d.i.$showActionDialog = !(whichDialog, event) -->
  event.preventDefault!

  formId = switch whichDialog
    | 'CloseThread' => initCloseDialog!
    | 'Collapse' => initCollapseDialog!

  # Pass data to dialog via shared variable `targetPostId`.
  $thread = $(this).closest '.dw-t'
  $post = $thread.children '.dw-p'
  targetPostId := $post.dwPostId!

  $(formId).parent!dialog('open')

    #parent().position({
    #my: 'center top', at: 'center bottom', of: $post, offset: '0 40'});



# Warning: Dupl code, similar to: initCloseDialog
function initCollapseDialog
  formId = '#dw-f-collapse'

  $form = $(formId)
  $dialog = $form.parent!
  if $dialog.is '.ui-dialog-content'
    return formId # already inited

  $dialog.dialog $.extend({}, d.i.jQueryDialogReset)

  $form.find('.dw-fi-cancel').button!click !->
    $dialog.dialog 'close'

  $form.find('#dw-f-collapse-post').button!click ->
    submit '/-/collapse-post'

  $form.find('#dw-f-collapse-replies').button!click ->
    submit '/-/collapse-replies'

  $form.find('#dw-f-collapse-tree').button!click ->
    submit '/-/collapse-tree'

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

  formId



# Warning: Dupl code, similar to: initCollapseDialog
function initCloseDialog
  formId = '#dw-f-close-tree'

  $form = $(formId)
  $dialog = $form.parent!
  if $dialog.is '.ui-dialog-content'
    return formId # already inited

  $dialog.dialog $.extend({}, d.i.jQueryDialogReset)

  $form.find('.dw-fi-cancel').button!click !->
    $dialog.dialog 'close'

  $form.find('#dw-f-close-tree-yes').button!click ->
    submit '/-/close-tree'

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

  formId



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
