/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;



d.i.findThread$ = function(threadId) {
  return $('#dw-t-'+ threadId);
}


d.i.findPost$ = function(postId) {
  return $('#post-'+ postId);
}


d.i.findPostHeader$ = function(postId) {
  return $('#post-'+ postId +' > .dw-p-hd');
};


$.fn.dwPostId = function() {
  // Drop initial "post-".
  return this.dwCheckIs('.dw-p').attr('id').substr(5, 999);
};


/**
 * Returns info on the page in which $(whatever) is located.
 * (There might be more than one Debiki page included on a single browser page.)
 */
$.fn.dwPageMeta = function() {
  var $page = this.closest('.dw-page');
  return {
    pageId: $page.attr('id').substr(5, 999), // drops initial "page-"
    pagePath: $page.data('page_path'),
    pageRole: $page.data('page_role'),
    parentPageId: $page.data('parent_page_id'),
    pageExists: $page.data('page_exists')
  };
};


$.fn.dwClosestThread = function() {
  return this.closest('.dw-t');
}


$.fn.dwChildPost = function() {
  return this.children('.dw-p');
}


$.fn.dwFindPosts = function() {
  return this.find('.dw-p');
}


$.fn.dwPostFindHeader = function() {
  return this.dwCheckIs('.dw-p').children('.dw-p-hd');
};


$.fn.dwPostHeaderFindStats = function() {
  return this.dwCheckIs('.dw-p-hd').children('.dw-p-flgs-all, .dw-p-r-all');
};


$.fn.dwPostHeaderFindExactTimes = function() {
  return this.dwCheckIs('.dw-p-hd')
      .find('> .dw-p-at, > .dw-p-hd-e > .dw-p-at');
};


$.fn.dwLastChange = function() {
  var maxDate = '0';
  this.dwCheckIs('.dw-p')
      .children('.dw-p-hd').find('.dw-date').each(function(){
    var date = $(this).attr('title'); // creation or last modification date
    if (date > maxDate)
      maxDate = date;
  });
  return maxDate;
};


/**
 * The user id of the author of a post, or '' if the post is a dummy post,
 * wich has no author.
 */
$.fn.dwAuthorId = function() {
  var uid = this.dwCheckIs('.dw-p')
      .find('> .dw-p-hd > .dw-p-by').attr('data-dw-u-id');
  // Sometimes there is no author. Then return ''.
  // (The server creates e.g. a dummy title "Unnamed page (click to edit)"
  // if the page has no title. But there's no author of that text.)
  uid = uid || '';
  return uid;
};


// The root post need not be the article (if ?view=something-else specified).
$.fn.dwIsRootPost = function() {
  return this.dwCheckIs('.dw-p').parent().is('.dw-depth-0');
};


$.fn.dwIsArticlePost = function() {
  return this.dwCheckIs('.dw-p').is('.dw-ar-p');
};


$.fn.dwIsReply = function() {
  // 1 char IDs are reserved (1 is page body, 2 title, 3 template).
  var id = this.dwPostId();
  return id.length > 1;
};


$.fn.dwIsUnauReply = function() {
  var isReply = this.dwIsReply();
  // Unauthenticated users have '-' in their user ids.
  var unauAuthor = this.dwAuthorId().indexOf('-') !== -1;
  return isReply && unauAuthor;
};


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
