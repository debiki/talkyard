/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


function confirmClosePage() {
  // If there're any reply forms with non-empty replies (textareas),
  // or any edit forms, then return a confirm close message.
  // (COULD avoid counting unchanged edits too.)
  // Count only :visible forms — non-visible forms are 1) hidden template
  // forms and 2) forms the user has closed. They aren't removed, because
  // it's nice to have your text reappear should you accidentally close
  // a form, but open it again.
  var replyCount = $('.dw-fs-re:visible').filter(function() {
    return $(this).find('textarea').val().length > 0;
  }).length;
  var editCount = $('.dw-f-e:visible').length;
  var msg = replyCount + editCount > 0 ?  // i18n
    'You have started writing but not saved your work. Really close page?' :
    undefined;  // don't return null, or IE asks roughly `confirm null?'
  return msg;
};


d.u.postJson = function(options) {
  return $.ajax({
    url: options.url,
    type: 'POST',
    data: JSON.stringify(options.data),
    contentType: 'application/json; charset=utf-8',
    headers: { 'X-XSRF-TOKEN': $.cookie('dwCoXsrf') },
    dataType: 'json',
    error: options.error,
    success: options.success
  });
};

window.onbeforeunload = confirmClosePage;


/**
 * Returns the text of the title of the page in which the current $ elem
 * is located.
 */
$.fn.dwPageTitleText = function() {
  var $page = this.closest('.dw-page');
  var $title = $page.find('> .dw-ar-t > .dw-p > .dw-p-ttl .dw-p-ttl');
  return $title.text();
}



// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
