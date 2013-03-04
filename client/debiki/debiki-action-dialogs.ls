# Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved.  

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;



d.i.$showActionDialog = !(whichDialog, event) -->
  event.preventDefault!
  $thread = $(this).closest '.dw-t'
  $post = $thread.children '.dw-p'
  postId = $post.dwPostId!
  formId = switch whichDialog
    | 'CloseThread' => initCloseDialog postId
    | 'Collapse' => initCollapseDialog postId

  $(formId).parent!dialog('open')

    #parent().position({
    #my: 'center top', at: 'center bottom', of: $post, offset: '0 40'});



function initCollapseDialog (postId)
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
    data = [{ pageId: d.i.pageId, actionId: postId }]
    d.u.postJson { url: apiFunction, data }
        .fail d.i.showServerResponseDialog
        .done !(newDebateHtml) ->
          alert 'unimplemented DwE3kRK50'
    false

  formId



function initCloseDialog (postId)
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
    data = [{ pageId: d.i.pageId, actionId: postId }]
    d.u.postJson { url: apiFunction, data }
        .fail d.i.showServerResponseDialog
        .done !(newDebateHtml) ->
          alert 'unimplemented DwE1k3R5r0'
    false

  formId



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
