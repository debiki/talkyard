// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
// Web framework specific code.

"use strict;"

//----------------------------------------
   jQuery.noConflict()(function($){
//----------------------------------------

// Don't remove the doctype comment below!
/*
Debiki.v0.setReplyFormLoader(function(debateId, postId, complete) {

  // Use datatype "text", because, in at least Chrome 9.0.597.19 beta:
  // 1. If data type "xml" is specified, the error
  // "WRONG_DOCUMENT_ERR: DOM Exception 4" occurs.
  // 2. If data typ "text" is specified, and an XML header <?xml version...?>
  // is included in replyData, the error "WRONG_DOCUMENT_ERR: DOM Exception 4"
  // happens.
  // 3. If no data type is specified, an error happens in jquery-1.4.2.js line
  // 4187: "Uncaught TypeError: Cannot call method 'replace' of undefined".
  // Here: (innerHTML is undefined, no idea why)
  //  html: function( value ) {
  //      if ( value === undefined ) {
  //          return this[0] && this[0].nodeType === 1 ?
  //  --->        this[0].innerHTML.replace(rinlinejQuery, "") :
  //              null;
  // Therefore: data type "text" is specified below. (And the server uploads
  // no XML header.)

  $.get('/-'+ debateId +'/'+ postId +'.xml?reply', function(replyText) {
    var $replyForm = $(replyText).find('.dw-fs-re');
    complete($replyForm)
  }, 'text');
});

Debiki.v0.setEditFormLoader(function(debateId, rootPostId, postId, complete) {
  // see comments in setReplyFormLoader above on using datatype text
  $.get('?edit='+ postId +'&view='+ rootPostId, function(editFormText) {
    var $editForm = $(editFormText).find('.dw-fs-ed');
    complete($editForm)
  }, 'text');
});
*/

Debiki.v0.setReplyFormSubmitter(function($form, debateId, rootPostId, postId) {
  return $.post('?reply='+ postId +'&view='+ rootPostId,
      $form.serialize(), 'html');
});

Debiki.v0.setEditFormSubmitter(function($form, debateId, rootPostId, postId) {
  return $.post('?edit='+ postId +'&view='+ rootPostId, $form.serialize(),
      'html');
});

Debiki.v0.setRatePostUrl(function(debateId, rootPostId, postId) {
  return '?rate='+ postId +'&view='+ rootPostId;
});

//----------------------------------------
   })
//----------------------------------------
