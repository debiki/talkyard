/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */

// In this file:
// - jQuery extension functions, prefixed with "dw" to avoid name clashes
// - The implementation of the Debiki module
// - A jQuery onload handler

// Google Closure Linter: Run like so:
//  gjslint src/main/resources/toserve/js/debiki.js | egrep -v 'E:0002:'

/*{{{ Bug avoidance notes

For an <a>, use this.hash not $(this).attr('href'), because in IE 7
attr() prepends 'http://server/.../page' to the href.  Related:
  http://goo.gl/OF16Q  — the JavaScript Bible page 603
  http://webmasters.stackexchange.com/questions/20621/
                    okay-to-use-the-hash-dom-node-property

}}}*/
/* {{{ Misc naming notes

 dwCoSid:
  "dw" is a prefix, avoids name clashes.
  "Co" means "Cookie".
  "Sid" is the cookie name.

 dwEvLoggedInOut:
  "Ev" means "event".
  "LoggedInOut" is the event.

 So you can do: grep dwCo, grep dwEv

 HTML5 data attributes names:  ??
 Like the CSS class names, but underscore not hyphen, so as to aovid
 uppercase/hyphen conversion. (E.g. 'data-variable-name' is converted to
 variableName (no hyphen, uppercase 'N'), and back, according to the html5
 spec: <http://www.w3.org/TR/html5/elements.html#
          embedding-custom-non-visible-data-with-the-data-attributes>
 Using underscoer ensures the data names in the html doc matches
 the names in the Javascript source code which avoids confusion.
 Example:  zd_t_id  means:  folded (zd, 'z' is fold)  thread (t)  id (id).
 But don't use:  zd-t-id, that'd be converted to 'zdTId' I think.
 If the data is only set and read via Javascript (never serialized to html),
 then please use 'dwDataName' (then you know you need only consider the
 javascript files (this file) should you want to rename it).)

 Let names of functions that return a jQuery object end with $.
 Let names of functions that should be passed to jQuery.each start with $.
 Let jQuery objects start with $.
 Currently jQuery extensions are prefixed by 'dw', e.g. $post.dwAuthorId().
 Example:
   var $header = getPostHeader$(postId);
   $header.each($doSomething);

}}}*/

var html_sanitizer_bundle =
    require('html_sanitizer_bundle') ||  // prod builds
    { googleCajaSanitizeHtml: googleCajaSanitizeHtml };  // dev builds


//========================================
   (function(){
//========================================
"use strict";

var UNTESTED; // Indicates that a piece of code has not been tested.

//----------------------------------------
//  Helpers
//----------------------------------------


// Converts markdown to sanitized html.
function markdownToSafeHtml(markdownSrc, hostAndPort, sanitizerOptions) {
  var htmlTextUnsafe = markdownToUnsafeHtml(markdownSrc, hostAndPort);
  var htmlTextSafe = sanitizeHtml(htmlTextUnsafe, sanitizerOptions);
  return htmlTextSafe;
}

function markdownToUnsafeHtml(markdownSrc, hostAndPort) {
  var converter = new Showdown.converter();
  var htmlTextUnsafe = converter.makeHtml(markdownSrc, hostAndPort);
  return htmlTextUnsafe;
}

/**
 * Calls Google Caja JsHtmlSanitizer to sanitize the html.
 *
 * options.allowClassAndIdAttr = true/false
 * options.allowDataAttribs = true/false
 */
function sanitizeHtml(htmlTextUnsafe, options) {
  var htmlTextSafe = html_sanitizer_bundle.googleCajaSanitizeHtml(
      htmlTextUnsafe, options.allowClassAndIdAttr, options.allowDataAttr);
  return htmlTextSafe;
}



//----------------------------------------
// jQuery object extensions
//----------------------------------------


(function() {
  jQuery.fn.dwDisable = function() {
    return _dwEnableDisableImpl(this, true);
  };

  jQuery.fn.dwEnable = function() {
    return _dwEnableDisableImpl(this, false);
  };

  function _dwEnableDisableImpl(self, disabled) {
    // (Radio buttons and checkboxes have the
    // .ui-helper-hidden-accessible class – jQuery UI places
    // .ui-button on the related <label>, not the <input>.)
    if (self.filter('input, button')
        .is('.ui-button, .ui-helper-hidden-accessible'))
      self.button('option', 'disabled', disabled);
    else self.prop('disabled', disabled);
    return self;
  }
})();



// Onload
//----------------------------------------
   jQuery.noConflict()(function($){
//----------------------------------------

// ------- Export functions

// Shows all comments, which should have been hidden via the
// DebateHtml$ hideCommentsStyle, in html.scala.
// Only do this if the article itself is shown though.
debiki.v0.showInteractionsOnClick = function() {
  // Always show comments if the page body is not the root post.
  // (That is, if the article isn't shown, but a plain comment.
  // Otherwise people could create "fake" pages, by creating 
  // a comment and linking it with ?view=<comment-id> and it would
  // seem to be a page itself!)
  if ($('.dw-ar-p').length === 0) {  // article post not present?
    $('html').removeClass('dw-hide-interactions');
    return;
  }

  var numComments = $('.dw-p').length - 1;  // don't count the article
  if ($('.dw-p-ttl').length) numComments -= 1; // don't count article title
  var text = numComments > 1 ?  'Visa '+ numComments +' kommentarer' : // i18n
     (numComments == 1 ?  'Visa 1 kommentar' : 'Lämna en kommentar');
  var $showBtn = $(
      '<div class="dw-as dw-hor-a">' +
      '<a class="dw-a dw-a-show-interactions"></a></div>');
  $showBtn.find('a')
      .text(text)  // xss safe
      .css('font-size', '80%')
      .end()
      .insertBefore('.dw-ar-t > .dw-res')
      .click(function() {
    $showBtn.remove();
    $('html').removeClass('dw-hide-interactions');
    SVG.drawEverything(); // *sometimes* needed
  });
};

function showInteractionsIfHidden() {
  // If they're hidden, there's a button that shows them.
  $('.dw-a-show-interactions').click();
}


// ------- Variables

// Import namespaces as `d.i` and `d.u`.
var d = { i: debiki.internal, u: debiki.v0.util };

// Import terribly frequently used functions.
var die = d.u.die;
var die2 = d.u.die2;
var dieIf = d.u.dieIf;
var die2If = d.u.die2If;
var bugIf = d.u.bugIf;


// Debiki convention: Dialog elem tabindexes should vary from 101 to 109.
// HTML generation code assumes this, too. See Debiki for Developers, #7bZG31.
var DEBIKI_TABINDEX_DIALOG_MAX = 109;

var diffMatchPatch = new diff_match_patch();
diffMatchPatch.Diff_Timeout = 1; // seconds
diffMatchPatch.Match_Distance = 100*1000; // for now

var didResize = false;
// Set to true if a truncated post was clicked and expanded.
var didExpandTruncated = false;

var debateId = $('.debiki').attr('id');

var rootPostId = $('.dw-depth-0');
rootPostId = rootPostId.length ?
    rootPostId.attr('id').substr(5) : undefined; // drops initial `dw-t-'

var $lastInlineMenu = $();

// Remembers which .dw-loginsubmit-on-click button (e.g. "Post as...")
// was clicked when a login dialog is shown.
var loginOnClickBtnClicked = null;

// True iff the user is to be asked whether or not s/he wants to be
// notified via email e.g. of replies.
var continueLoginAskAboutEmail = false;

// Reset all per click state variables when a new click starts.
$.event.add(document, "mousedown", function() {
  didExpandTruncated = false;
  //didResize = false; -- currently handled in another mousedown
});

// If there's no SVG support, we'll use images instead.
var nativeSvgSupport = Modernizr.inlinesvg;

var SVG = nativeSvgSupport && document.URL.indexOf('svg=false') === -1 ?
    d.i.makeSvgDrawer($) : d.i.makeFakeDrawer($);

var Me = makeCurUser();




// ------- Traversing etcetera

function getPostHeader$(postId) {
  return $('#post-'+ postId +' > .dw-p-hd');
}

jQuery.fn.dwPostId = function() {
  // Drop initial "post-".
  return this.dwCheckIs('.dw-p').attr('id').substr(5, 999);
};

jQuery.fn.dwPostFindHeader = function() {
  return this.dwCheckIs('.dw-p').children('.dw-p-hd');
};

jQuery.fn.dwPostHeaderFindStats = function() {
  return this.dwCheckIs('.dw-p-hd').children('.dw-p-flgs-all, .dw-p-r-all');
};

jQuery.fn.dwPostHeaderFindExactTimes = function() {
  return this.dwCheckIs('.dw-p-hd')
      .find('> .dw-p-at, > .dw-p-hd-e > .dw-p-at');
};

jQuery.fn.dwLastChange = function() {
  var maxDate = '0';
  this.dwCheckIs('.dw-p')
      .children('.dw-p-hd').find('.dw-date').each(function(){
    var date = jQuery(this).attr('title'); // creation or last modification date
    if (date > maxDate)
      maxDate = date;
  });
  return maxDate;
};

// The user id of the author of a post.
jQuery.fn.dwAuthorId = function() {
  var uid = this.dwCheckIs('.dw-p')
      .find('> .dw-p-hd > .dw-p-by').attr('data-dw-u-id');
  return uid;
};

// The root post need not be the article (if ?view=something-else specified).
$.fn.dwIsRootPost = function() {
  return this.dwCheckIs('.dw-p').parent().is('.dw-depth-0');
}

$.fn.dwIsArticlePost = function() {
  return this.dwCheckIs('.dw-p').is('.dw-ar-p');
}

$.fn.dwIsReply = function() {
  // 1 char IDs are reserved (1 is page body, 2 title, 3 template).
  var id = this.dwPostId();
  return id.length > 1;
}

$.fn.dwIsUnauReply = function() {
  var isReply = this.dwIsReply();
  // Unauthenticated users have '-' in their user ids.
  var unauAuthor = this.dwAuthorId().indexOf('-') !== -1;
  return isReply && unauAuthor;
}


// ------- Open/close


function $threadToggleFolded() {
  // In case the thread will be wider than the summary, prevent float drop.
  resizeRootThreadExtraWide();
  var $thread = $(this).closest('.dw-t');
  // Don't hide the toggle-folded-link and arrows pointing *to* this thread.
  var $childrenToFold = $thread.children(':not(.dw-z, .dw-arw)');
  var $foldLink = $thread.children('.dw-z');
  // {{{ COULD make the animation somewhat smoother, by sliting up the
  // thread only until it's as high as the <a> and then hide it and add
  // .dw-zd, because otherwie when the <a>'s position changes from absolute
  // to static, the thread height suddenly changes from 0 to the highht
  // of the <a>). }}}
  if ($thread.is('.dw-zd')) {
    // Thread is folded, open it.
    $childrenToFold.each($slideDown);
    $thread.removeClass('dw-zd');
    $foldLink.text('[–]'); // not a '-', but an en dash, \u2013,
  } else {
    // Fold thread.
    var postCount = $thread.find('.dw-p').length;
    $childrenToFold.each($slideUp).queue(function(next) {
      $foldLink.text('[+] Click to show '+  // COULD add i18n
          postCount +' posts');
      $thread.addClass('dw-zd');
      next();
    });
  }
  return false; // don't follow any <a> link
}


// ------- Outlining

// Outline new posts
/*
(function(){
  var myLastVersion = $.cookie('myLastPageVersion'); // cookie no longer exists
  if (!myLastVersion) return;
  var newPosts = posts.filter(function(index){ // BUG?…
    //… relied on posts = $('.debiki .dw-p-bd') but use '*.dw-p' instead?
    return $(this).dwLastChange() > myLastVersion;
  })
  newPosts.closest('.dw-t').addClass('dw-m-t-new');
  // TODO: sometimes .dw-m-p-edited instead of -new
})()
*/


/**
 * Highlights and outlines $tag, for a little while. If there're opaque
 * elems inside, you can list them in the `opt_backgroundSelector`
 * and then background highlighting is placed on them instead of on $tag.
 */
function highlightBriefly($tag, opt_backgroundSelector) {
  var duration = 2500;
  var $background = opt_backgroundSelector ?
      $tag.find(opt_backgroundSelector) : $tag;
  $background.effect('highlight',
      { easing: 'easeInExpo', color: 'yellow' }, duration);
  $tag.css('outline', 'solid thick #f0a005');
  // Remove the outline quickly (during 500 ms). Otherwise it looks
  // jerky: removing 1px at a time, slowly, is very noticeable!
  setTimeout(function() {
    $tag.animate({ outlineWidth: '0px' }, 400);
  }, Math.max(duration - 550, 0));
  /// This won't work, jQuery plugin doesn't support rgba animation:
  //$post.animate(
  //    { outlineColor: 'rgba(255, 0, 0, .5)' }, duration, 'easeInExpo');
  /// There's a rgba color support plugin though:
  /// http://pioupioum.fr/sandbox/jquery-color/
}


/**
 * Scrolls to `this`, then highlights `$tag`.
 */
jQuery.fn.dwScrollToThenHighlight = function($tag, options) {
  this.dwScrollIntoView(options).queue(function(next) {
    highlightBriefly($tag);
    next();
  });
  return this;
};


/**
 * Scrolls to and highlights `this`.
 */
jQuery.fn.dwScrollToHighlighted = function(options) {
  return this.dwScrollToThenHighlight(this);
};


function showAndHighlightPost($post, options) {
  $post.dwScrollIntoView(options).queue(function(next) {
    highlightBriefly($post, '.dw-p-bd, .dw-p-hd');
    next();
  });
}


function scrollToUrlAnchorPost() {
  var $anchorPost = $(location.hash).filter('.dw-p');
  if (!$anchorPost.length) return;
  showAndHighlightPost($anchorPost, { marginRight: 200, marginBottom: 300 });
  $anchorPost.parent().addClass('dw-m-t-new');  // outlines it
}


// Adds class 'debiki-current-site-section' to the navigation
// menu link that matches the current window.location.
// However, unless you are on the home page, links to the home page
// (which is assumed to be '/') are ignored, because *everything* is below
// the homepage, so homepage links would otherwise always be marked.
function showCurLocationInSiteNav() {
  function $isCurSectionLink() {
    var link = $(this).attr('href');
    var linkPathStart =
      link.search('https?://') === 0 ? link.indexOf('/', 8) : 0;
    // Same protocol, host and port, a.k.a. origin?
    var linkOrigin = link.substr(0, linkPathStart);
    if (linkOrigin.length !== 0 && linkOrigin !== location.origin)
      return false;
    // Exact path match? (include home page links)
    var linkPath = link.substr(linkPathStart);
    if (linkPath === location.pathname)
      return true;
    // Ignore links to the home page.
    if (linkPath === '/')
      return false;
    // Ignore links with query string or hash parts.
    // {{{ Then I can include in the site <nav> links to a certain
    // Subscribe part of my homepage ,without that link being
    // considered a separate site section. }}}
    if (linkPath.search(/[?#]/) !== -1)
      return false;
    // Does `location' start with `linkPath'?
    // But ingore any page name part of `linkPath'. Only folder paths
    // constitute site sections, I've decided.
    // {{{ So you can have <nav> links like this one: site/folder/path/-<guid>,
    // that is, reference the section "index" page via guid,
    // so redirects will work, should you redesign your site and
    // move sections elsewhere (to site/another/path/-<but-same-guid>). }}}
    var linkFolderPath = linkPath.substr(0, linkPath.lastIndexOf('/') + 1);
    var locStartsWithLink = location.pathname.search(linkFolderPath) === 0;
    return locStartsWithLink;
  }

  $('.debiki-0-mark-current-site-section a[href]')
      .filter($isCurSectionLink)
      .addClass('debiki-0-current-site-section');
}



// ------- Resizing


// Makes the root thread wide enough to contain all its child posts.
// Unless this is done e.g. when child posts are resized or stacked eastwards,
// or a reply/rate/edit form is shown/resized, the east-most threads
// will float-drop below the other threads.
// Had IE7 supported display: table-cell, none of this would have been needed?
function resizeRootThreadImpl(extraWidth) {
  // Let the root thead, which floats: left, expand eastwards as much as
  // it needs to — by making its parent very very wide.
  var $rootThread = $('.dw-depth-0');
  var $parent = $rootThread.parent();
  $parent.width(200200);

  // Now check how wide the parent actually needs to be, to prevent the
  // eastmost root post child threads from float dropping.
  // Also add 200px, because when you zoom in and out the width of
  // the root post might change a few pixels (this caused float
  // drop in Opera, at least before I started calling resizeRootThread
  // on zoom in/out).
  // {{{ Old comment
  // If a user drag-resizes a form quicker than this amount of pixels
  // per browser refresh, div-drop might happen anyway, because
  // this function isn't invoked until after the
  // browser has decided to float-drop the divs?
  // Also, zooming in/out might cause float drop (it seems all elems
  // aren't scaled exactly in the same way), if too small.
  // Hence it's a rather wide value. (Otherwise = 50 would do.)
  // }}}
  $rootThread.width('auto'); // cancel below bug workaround
  var requiredWidth = $rootThread.width();
  // Change from 2200:200 to 2700:700. 200 causes float drop, if
  // browser window is narrow, and you add a root post reply (why!?).
  $parent.width(requiredWidth + (extraWidth ? 2700 : 700));

  // Browser (?) bug workaround:
  // Oddly enough, in very very few situations, the browser (Chrome v19)
  // resizes $rootThread so the last <li> actually float drops! However
  // if I add just 10px to that $rootThread.width(), then there is no
  // more float drop (so it seems to me that the browser does a 10px error
  // — if the browser didn't attempt to avoid float drop at all,
  // adding 10px wouldn't suffice? A thread <li> is perhaps 200px wide.)
  // However, after adding 100px here, I've never observed any more
  // float drop.
  // This also requires us to add 100px in debiki.css, see [3krdi2].
  $rootThread.width(requiredWidth + 100);
}


// Makes the root thread wide enough to contain all its child posts.
// Is this not done e.g. when child posts are resized or stacked eastwards,
// or a reply/rate/edit form is shown/resized, the east-most threads
// will float-drop below the other threads.
function resizeRootThread() {
  resizeRootThreadImpl();
}

// Resizes the root thread so it becomes extra wide.
// This almost avoids all float drops, when quickly resizing an element
// (making it larger).
function resizeRootThreadExtraWide() {
  resizeRootThreadImpl(true);
}

// After an elem has been resized, the root thread is resized by
// a call to resizeRootThread(). However, it seems the browser
// (Google Chrome) calls that function before all elements
// are in their final position, in some weird manner, causing
// floats to drop, as if resizeRootThread() had not been called.
// This can be fixed by calling resizeRootThread() again,
// after a while when the browser is (probably) done
// doing its layout stuff.
var resizeRootThreadNowAndLater = (function(){
  var handle;
  return function() {
    resizeRootThread();
    if (handle) clearTimeout(handle);
    handle = setTimeout(resizeRootThread, 1500);
  };
}());

// Makes [threads layed out vertically] horizontally resizable.
function $makeEastResizable() {
  $(this).resizable({
    resize: function() {
      resizeRootThreadExtraWide();
      SVG.$drawParentsAndTree.apply(this);
    },
    handles: 'e',
    stop: function(event, ui) {
      // jQuery has added `height: ...' to the thread's style attribute.
      // Unless removed, the therad won't resize itself when child
      // threads are opened/closed.
      $(this).css('height', '');
      resizeRootThreadNowAndLater();
    }
  });
}


// ------- Tag Dog


// The tag dog searches text inside html tags, without being so very
// confused by tags and attributes.
var tagDog = (function(){
  var sniffAndMem;
  return {
    maxMatchLength: new diff_match_patch().Match_MaxBits,
    sniffHtml: function($tag) {
      var htmlText = $tag.html();
      sniffAndMem = TagDog.sniffHtml(htmlText);
      return sniffAndMem.sniffedHtml;
    },
    barkHtml: function(sniffedHtml) {
      sniffAndMem.sniffedHtml = sniffedHtml;
      var htmlText = TagDog.barkHtml(sniffAndMem);
      return htmlText;
    }
  };
}());

// ------- Posts

// Inits a post and its parent thread.
// Makes posts resizable, activates mouseenter/leave functionality,
// draws arrows to child threads, etc.
// Initing a thread is done in 4 steps. This function calls all those 4 steps.
// (The initialization is split into steps, so everything need not be done
// at once on page load.)
// Call on posts.
function $initPostsThread() {
  $initPostsThreadStep1.apply(this);
  $initPostsThreadStep2.apply(this);
  $initPostsThreadStep3.apply(this);
  $initPostsThreadStep4.apply(this);
}

function $initPostsThreadStep1() {
  var $thread = $(this).closest('.dw-t');

  // Find or add action buttons.
  var $actions = $thread.children('.dw-res').children('.dw-p-as');
  if ($actions.length) {
    // This thread is laid out horizontally and the action links have
    // already been placed somewhere in the child thread <ol>.
  } else {
    $actions = $('#dw-action-menu')
        .clone()
        .removeAttr('id')
        .css('visibility', 'hidden');
    $thread.find('> .dw-as').replaceWith($actions);
    // Touch devices cannot show-on-mouse-hover.
    if (Modernizr.touch)
      $actions.children('.dw-a-reply, .dw-a-rate')
          .css('visibility', 'visible');
  }

  // {{{ On delegating events for reply/rate/edit.
  // Placing a jQuery delegate on e.g. .debiki instead, entails that
  // these links are given excessively low precedence on Android:
  // on a screen touch, any <a> nearby that has a real click event
  // is clicked instead of the <a> with a delegate event. The reply/
  // reply/rate/edit links becomes virtually unclickable (if event
  // delegation is used instead). }}}
  $actions.children('.dw-a-reply').click(d.i.$showReplyForm);
  $actions.children('.dw-a-rate').click(d.i.$showRatingForm);
  $actions.children('.dw-a-more').click(function() {
    $(this).closest('.dw-p-as').find('.dw-a')
        .show()
        .end().end().remove();
  });
  //$actions.children('.dw-a-link').click($showLinkForm); — not implemented
  $actions.children('.dw-a-edit').click($showEditsDialog);
  $actions.children('.dw-a-flag').click(d.i.$showFlagForm);
  $actions.children('.dw-a-delete').click(d.i.$showDeleteForm);

  // Open/close threads if the fold link is clicked.
  $thread.children('.dw-z').click($threadToggleFolded);
}

// Things that can be done a while after page load.
function $initPostsThreadStep2() {
  var $thread = $(this).closest('.dw-t');
  var $post = $thread.filter(':not(.dw-depth-0)').children('.dw-p');

  // When hovering a post, show actions, and make it resizable.
  // But always show the leftmost Reply, at depth-0, that creates a new column.
  // (Better avoid delegates for frequent events such as mouseenter.)
  $post.mouseenter(function() {
    var $i = $(this);

    // If actions are already shown for an inline child post, ignore event.
    // (Sometimes the mouseenter event is fired first for an inline child
    // post, then for its parent — and then actions should be shown for the
    // child post; the parent should ignore the event.)
    var inlineChildActionsShown = $i.find('#dw-p-as-shown').length;

    // If the post is being edited, show no actions.
    // (It's rather confusing to be able to Reply to the edit <form>.)
    var isBeingEdited = $i.children('.dw-f-e:visible').length;

    if (isBeingEdited)
      hideActions();
    else if (!inlineChildActionsShown)
      $i.each($showActions);
    // else leave actions visible, below the inline child post.
  });

  $thread.mouseleave(function() {
    // If this is an inline post, show the action menu for the parent post
    // since we're hovering that post now.
    $(this).closest('.dw-p').each($showActions);
  });

  $initPostStep1.apply(this);
}

function $initPostsThreadStep3() {
  $initPostStep2.apply(this);
}

function $initPostsThreadStep4() {
  var $thread = $(this).closest('.dw-t');

  // Make replies to the root thread resizable horizontally. (Takes
  // perhaps 100 ms on my 6 core 2.8 GHz AMD, 24 depth-1 reply columns.)
  // (But skip inline replies; they expand eastwards regardless.)
  // $makeEastResizable must be called before $makePostResizable (not in
  // use though!), or $makeEastResizable has no effect. No idea
  // why -- my guess is some jQuery code does something similar to
  // `$.find(..)', and finds the wrong resizable stuff,
  // if the *inner* tag is made resizable before the *outer* tag.
  //
  // However for touch devises, don't enable resizing of posts: it doesn't
  // work, and the resize handles steal touch events from buttons nearby.
  if (!Modernizr.touch)
    $thread.filter(function() {
      var $i = $(this);
      return !$i.is('.dw-i-t') && $i.parent().closest('.dw-t').is('.dw-hor');
    }).each($makeEastResizable);

  showCurLocationInSiteNav();
}

// Inits a post, not its parent thread.
function $initPost() {
  $initPostStep1.apply(this);
  $initPostStep2.apply(this);
}

function $initPostStep1() {
  var $i = $(this),
      $hdr = $i.find('.dw-p-hd'),
      $postedAt = $hdr.children('.dw-p-at'),
      postedAtTitle = $postedAt.attr('title'),
      postedAt = d.u.isoDateToMillis(postedAtTitle),
      $editedAt = $hdr.find('> .dw-p-hd-e > .dw-p-at'),
      editedAtTitle = $editedAt.attr('title'),
      editedAt = d.u.isoDateToMillis(editedAtTitle),
      now = new Date();  // COULD cache? e.g. when initing all posts

  // If this post has any inline thread, place inline marks and split
  // the single .dw-p-bd-blk into many blocks with inline threads
  // inbetween.
  // (This takes rather long (120 ms for 110 posts, of which 20 are inlined,
  // on my 6 core 2.8 GHz AMD) but should nevertheless be done quite early,
  // because it rearranges threads and posts, and that'd better not happen
  // after a while when the user thinks the page has already finished
  // loading.)
  if ($i.parent().children('.dw-res').children('.dw-i-t').length) {
    $i.each($placeInlineMarks)
      .each($splitBodyPlaceInlines);
  }

  function timeAgoAbbr(title, then, now) {
    return $('<abbr title="'+ title +'">'+ d.u.prettyTimeBetween(then, now) +
        '</abbr>');
  };

  // Show pretty how-long-ago info. (The $posted/editedAt are already hidden.)
  $postedAt.before(timeAgoAbbr(postedAtTitle, postedAt, now));
  $editedAt.before(timeAgoAbbr(editedAtTitle, editedAt, now));

  // If you clicks the header, show detailed rating and flags info.
  // If you click again, show exact creation date and edit date.
  // On a third click, hide everything again.
  if ($hdr.dwPostHeaderFindStats().length
      ) $hdr.css('cursor', 'help').click(function(event) {
    if ($(event.target).is('a'))
      return;  // don't expand header on link click
    var $i = $(this);
    var $stats = $i.dwPostHeaderFindStats();
    var $times = $i.dwPostHeaderFindExactTimes();
    if ($stats.is(':hidden')) {
      $stats.show();
    }
    /// Skip this for now, rewrite so dates are appended, don't
    /// insert in the middle.
    // else if ($times.is(':hidden')) {
    //  $times.show();
    else {
      $times.hide();
      $stats.hide();
    }
    // This might have expanded the post, so redraw arrows.
    $i.closest('.dw-p').each(SVG.$drawParents);
  });

  // When hovering an inline mark or thread, highlight the corresponding
  // thread or mark.
  // TODO don't remove the highlighting until hovering something else?
  //  So one can follow the svg path to the inline thread.
  // When hovering an inline thread, highlight the mark.
  // COULD highlight arrows when hovering any post, not just inline posts?
  $('> .dw-p-bd', this)
      .find('> .dw-p-bd-blk .dw-i-m-start')
        .hover($inlineMarkHighlightOn, $inlineMarkHighlightOff)
      .end()
      .find('> .dw-i-ts > .dw-i-t > .dw-p')
        .hover($inlineThreadHighlightOn, $inlineThreadHighlightOff);
}

function $initPostStep2() {
  // $initPostSvg takes rather long (190 ms on my 6 core 2.8 GHz AMD, for
  // 100 posts), and  need not be done until just before SVG is drawn.
  SVG.$initPostSvg.apply(this);
}

// Extracts markup source from html.
function $htmlToMarkup() {
  var mup = '';
  $(this).find('p').each(function(){ mup += $(this).text() +'\n\n'; });
  return mup.trim() +'\n';
}

// Moves inline child threads back to the thread's list of child threads,
// and removes inline marks and undoes wrapping of -bd contents into
// -bd-blk:s. That is, undoes $placeInlineMarks and $splitBodyPlaceInlines.
// Call on posts.
function $undoInlineThreads() {
  // Remove inline marks and unwrap block contents.
  var $post = $(this);
  var $body = $post.children('.dw-p-bd');
  // The post body contents is placed in various <div .dw-p-bd-blk>
  // with inline threads, <div .dw-i-ts>, inbetween.
  // Move the contents back to a single <div .dw-p-bd-blk>,
  // and also remove inline marks.
  var $bodyBlock = $('<div class="dw-p-bd-blk"></div>');
  $body.children('.dw-p-bd-blk').each(function() {
    var $block = $(this);
    $block.find('.dw-i-m-start').remove();
    $block.contents().appendTo($bodyBlock);
    $block.remove();
  });
  $body.append($bodyBlock);
  // Move inline threads back to the thread's list of child threads.
  var $inlineThreads = $body.find('> .dw-i-ts .dw-i-t');
  $inlineThreads.detach();
  $body.children('.dw-i-ts').remove();
  $post.parent().children(".dw-res").prepend($inlineThreads);
}

// Places marks where inline threads are to be placed.
// This is a mark:  <a class='dw-i-m-start' href='#dw-t-(thread_id)' />
// Better do this before splitBodyPlaceInlines, so as not to confuse the
// TagDog unnecessarily much (it'd be confused by the -bd-blk:s).
// Call on posts.
function $placeInlineMarks() {
  $(this).parent().find('> .dw-res > .dw-i-t', this).each(function(){
    // Search the parent post for the text where this mark starts.
    // Insert a mark (i.e. an <a/> tag) and render the parent post again.
    var markStartText = $(this).attr('data-dw-i-t-where');
    var $parentThread = $(this).parent().closest('.dw-t');
    var $bodyBlock = $parentThread.find(
        '> .dw-p > .dw-p-bd > .dw-p-bd-blk');
    bugIf($bodyBlock.length !== 1, 'error DwE6kiJ08');
    var tagDogText = tagDog.sniffHtml($bodyBlock);
    var loc = 10; // TODO should be included in the data attr
    if (markStartText.length > tagDog.maxMatchLength) {
      // Avoid a `Pattern too long for this browser' error (in case
      // corrupt/too-long matches were sent by the server, the whole
      // page would otherwise be messed up).
      markStartText = markStartText.substr(0, tagDog.maxMatchLength);
    }
    var match = diffMatchPatch.match_main(tagDogText, markStartText, loc);
    var arrow = $parentThread.filter('.dw-hor').length ?
        'ui-icon-arrow-1-e' : 'ui-icon-arrow-1-s';
    // TODO When possible to mark a text range: Underline matched text?
    // COULD add i18n, here and in $(mark) below.
    var mark =
        '<a id="dw-i-m_'+ this.id +'" class="dw-i-m-start ui-icon '+
        arrow +'" href="#'+ this.id +'" title="Contextual comment" />';
    if (match === -1) {
      // Text not found. Has the parent post been edited since the mark
      // was set? Should diffMatchPatch.Match_Distance and other settings
      // be tweaked?
      // To indicate that no match was found, appen the mark to the post body.
      // Then there's no text to the right of the mark — no text, no match.
      $(mark).attr('title',
          'Contextual comment, but the context text was not found, '+
          'so this comment was placed at the end of the post.'
          ).appendTo($bodyBlock);
      return;
    }
    var beforeMatch = tagDogText.substring(0, match);
    var afterMatch = tagDogText.substring(match, 999999);
    var tagDogTextWithMark = [beforeMatch, mark, afterMatch].join('');
    var blockWithMarks =
        ['<div class="dw-p-bd-blk">',
          tagDog.barkHtml(tagDogTextWithMark),
          '</div>'].join('');
    $bodyBlock.replaceWith(blockWithMarks);

    // Or simply:
    // var htmlWithMark = tagDogsniffAndMark(markStartText, $bodyBlock);
    // $bodyBlock.replace($(htmlWithMark));
  });
}

// Splits the single .dw-p-bd-blk into many -bd-blk:s,
// and places inline threads inbetween, in <ol .dw-i-ts> tags.
// Call on posts.
function $splitBodyPlaceInlines() {
  // Groups .dw-p-bd child elems in groups around/above 200px high, and
  // wrap them in a .dw-p-bd-blk. Gathers all inline threads for each
  // .dw-p-bd-blk, and places them in an <ol> to the right of the
  // .dw-p-bd-blk.
  var $placeToTheRight = function() {
    // Height calculation issue:
    //  After a .dw-p-bd-blk and an <ol> have been added, there are
    //  elems before [the current block to wrap in a .dw-p-bd-blk] that
    //  float left. The height of the block includes the height of these
    //  floating blocks. So the current block might be excessively high!
    //  Therefore, read the height of the *next* block, which has its
    //  correct height, since there's a non-floating currunt elem
    //  immediately in front of it. Save the result in `nextHeight'.
    var nextHeight = null;
    var accHeight = 0;
    var elems = [];
    $(this).children().each(function(){
      accHeight += nextHeight || $(this).outerHeight(true);
      nextHeight = $(this).next().outerHeight(true); // null if no next
      elems.push(this);
      if (accHeight < 270 && nextHeight) // COULD make 270 configurable?
        return;
      // The total height of all accElemes is above the threshold;
      // wrap them in a .dw-p-bd-blk, and any inline replies to them will
      // float to the right of that -body-block.
      var $block = $('<div class="dw-p-bd-blk"></div>').insertBefore(elems[0]);
      $block.prepend(elems);
      // Create an <ol> into which $block's inline threads will be placed.
      var $inlineThreads = $('<ol class="dw-i-ts"></ol>').insertAfter($block);
      var accHeightInlines = 0;
      var numInlines = 0;
      $block.find('.dw-i-m-start').each(function(){
        // TODO change from <li> to <div>
        var $inline = $(this.hash); // this.hash is '#dw-t-<id>'
        $inline.appendTo($inlineThreads);
        accHeightInlines += $inline.outerHeight(true);
        numInlines += 1;
      });
      // If the inline replies <ol> is higher than the -bd-blk, there'll
      // be empty space between this -bd-blk and the next one (because a
      // -bd-blk clears floats). Avoid this, by reducing the height of
      // each inline thread.
      if (accHeightInlines > accHeight) {
        // TODO // For now, simply set the height to accHeight / numInlines.
      }
      accHeight = 0;
      elems = [];
    });
  };

  var $placeInside = function() {
    // There are some .dw-i-m-start that are direct children of this .dw-p-bd.
    // They are inline marks for which no matching text was found, and are
    // currently placed at the end of this .dw-p-bd. Wrap them in a single
    // .dw-p-bd-blk, and their threads in an <ol>.
    var $bdyBlkMatchless = $('<div class="dw-p-bd-blk"></div>');
    var $inlineThreadsMatchless = $('<ol class="dw-i-ts"></ol>');

    $(this).children().each(function(){
      if ($(this).filter('.dw-i-m-start').length) {
        // This is a mark with no matching text. Place it in the trailing
        // Matchless block. (We wouldn't find this mark, when searching
        // for ``$('.dw-i-m-start', this)'' below.)
        $bdyBlkMatchless.append(this);
        $inlineThreadsMatchless.append($(this.hash)); // hash is '#dw-t-<id>'
        return;
      }
      // Wrap the elem in a -blk and append an <ol> into which inline
      // threads will be placed.
      var $bdyBlk = $(this).wrap('<div class="dw-p-bd-blk"></div>').parent();
      var $inlineThreads = $('<ol class="dw-i-ts"></ol>').insertAfter($bdyBlk);
      $('.dw-i-m-start', this).each(function(){
        var $inline = $(this.hash); // TODO change from <li> to <div>
        $inline.appendTo($inlineThreads);
      });
    });

    // Append any inline marks and threads that matched no text.
    if ($bdyBlkMatchless.length) {
      $(this).append($bdyBlkMatchless).append($inlineThreadsMatchless);
    } else {
      $bdyBlkMatchless.remove();
      $inlineThreadsMatchless.remove();
    }
  };

  // Group body elems in body-block <div>s. In debiki.css, these divs are
  // placed to the left and inline threads in a <ol> to the right, or
  // below (between) the body blocks.
  $(this).find('> .dw-p-bd > .dw-p-bd-blk').each(function(){
    var $placeFun = $(this).closest('.dw-t').filter('.dw-hor').length ?
        $placeToTheRight : $placeInside;
    $placeFun.apply(this);
    // Now there should be one <div .dw-p-bd-blk> with many
    // <div .dw-p-bd-blk> and <div .dw-i-ts> inside. Unwrap that single
    // parent <div .dw-p-bd-blk>.
    $(this).replaceWith($(this).contents());
  });
}

function $showInlineReply() {
  /*
  Could design a Page Object API that allows me to write:
    var thread = Thread.fromHash(this.hash);
    if (thread.isFolded()) thread.unfold()
    thread.getPost().scrollIntoView().highlight();
  Or simply:
    Post.fromThreadHash(this.hash).showAndHighlight();
  — Later, when I've ported to Play 2 and can use Coffeescript :-)
  */
  var $thread = $(this.hash);
  var postHash = '#post-'+ this.hash.substr(6, 999); // drops '#dw-t-'
  var $post = $(postHash);
  // Ensure inline thread not folded.
  if ($thread.is('.dw-zd')) {
    $thread.children('.dw-z').click();
  }
  showAndHighlightPost($post);
  return false;
}

function $inlineMarkHighlightOn() {
  var threadId = this.hash.substr(1, 999); // drops '#'
  toggleInlineHighlight(threadId, true);
}

function $inlineMarkHighlightOff() {
  var threadId = this.hash.substr(1, 999); // drops '#'
  toggleInlineHighlight(threadId, false);
}

function $inlineThreadHighlightOn() {
  var threadId = $(this).closest('.dw-t').attr('id');
  toggleInlineHighlight(threadId, true);
}

function $inlineThreadHighlightOff() {
  var threadId = $(this).closest('.dw-t').attr('id');
  toggleInlineHighlight(threadId, false);
}

function toggleInlineHighlight(threadId, on) {
  var inlineMarkId = 'dw-i-m_'+ threadId; // i.e. 'dw-i-m_dw-t-<thread-id>'
  var svgCurveId = 'dw-svg-c_'+ inlineMarkId;
  var $markAndPost = $('#'+ inlineMarkId +", #"+ threadId +" > .dw-p");
  var $arrow = $('#'+ svgCurveId);
  if (on) {
    $markAndPost.addClass('dw-highlight');
    $arrow.each(SVG.$highlightOn);
  } else {
    $markAndPost.removeClass('dw-highlight');
    $arrow.each(SVG.$highlightOff);
  }
}


// ------- Inline actions

function $hideInlineActionMenu(event) {
  $lastInlineMenu.remove();
}

// Opens a menu with Inline Reply and Edit endries.
// Does currently not work (does nothing) in IE 7 and 8.
function $showInlineActionMenu(event) {
  var $menu;
  var $target = $(event.target);
  if ($target.closest('.dw-fs').length) {
    // A form was clicked. Ignore click.
    return;
  }
  if (event.which === 2 || event.which === 3) {
    return; // ignore middle and right mouse buttons
    // (What is `which' for touch events? This works fine on Android anyhow.)
  }
  if (didExpandTruncated) {
    // The post is truncated. This click expands it; don't
    // let the click result in a reply form appearing, too.
    return;
  }

  // {{{ Could use ierange-m2.js (http://code.google.com/p/ierange/)
  // for this to work in IE 7 and 8, if the user has actually selected
  // a text range — mouse clicks, however, generate no range in IE 8 (and 7?)
  // (with ierange-m2). But mouse clicks are what is interesting, so skip
  // ierange for now. How find the *clicked* node and offset in IE 7 and 8? }}}
  if (!window.getSelection) return;  // IE 7 and 8
  var sel = window.getSelection();
  if (!sel.anchorNode || !sel.anchorNode.data ||
      sel.anchorNode.data.substr(sel.anchorOffset, 1).length === 0) {
    // No text clicked. Ignore.
    return;
  }

  // Find out what piece of text was cliced or selected.
  // See: http://stackoverflow.com/questions/3968520/
  //      how-to-use-jquery-prevall-to-select-nearby-text-nodes/3968929#3968929

  // If the user clicked e.g. inside a short <b> tag, the range might be only a 
  // few characters long, and these few characters might occur somewhere else
  // in the same post. This could result in Google's diff-match-patch finding 
  // the wrong occurrance.
  // jQuery(window.getSelection().anchorNode).parent().parent().contents()

  // TODO: Find out where to show the menu. And show menu.
  // TODO: Show a mark where the click was? See insertNodeAtCursor here:
  //  http://stackoverflow.com/questions/2213376/
  //    how-to-find-cursor-position-in-a-contenteditable-div/2213514#2213514
  // Use event.clientX, event.clientY.

  // Remember the clicked node and, if it's a text node, its parent
  // non-text node.
  // Later, when finding the closest .dw-p-bd-blk, we must start searching
  // from a non-text node, because jQuery(text-node) results in TypeError:
  //  Object #<a Text> has no method 'getAttribute'.
  var isTextNode = sel.focusNode.nodeType === 3;  // 3 is text
  var focusText = isTextNode ? sel.focusNode : undefined;
  var $focusNonText = $(isTextNode ? sel.focusNode.parentNode : sel.focusNode);
  var $post = $target.closest('.dw-p');
  var $postBody = $post.children('.dw-p-bd');

  if (!isTextNode) {
    // Finding the text clicked, when !isTextNode, is not implemented.
    // So right now, no inline menu will appear.
    // Seems to happen if you select a <li> or <p>,
    // by selecting a line end just before such an elem.
    // Or if you release the mouse button inside a .dw-i-m-start.
    return;
  }

  // When the user clicks a menu button, `sel' will refer to this new click,
  // so copy the old click forever:
  var sel = {
    focusOffset: sel.focusOffset,
    focusNode: sel.focusNode,
    anchorNode: sel.anchorNode,
    anchorOffset: sel.anchorOffset
  };

  // Finds the text just after the click. For example, if you click
  // somewhere on 'cows' in a post with this text:
  //    'All <strong>crazy cows</strong> eagerly eat running rabbits'
  // I think it finds ' eagerly eat running rabbits'.
  // (It does this without being so very confused by html tags,
  // because it converts tags to single characters and then uses
  // google-diff-match-patch to do a fussy search for the start
  // of the clicked text.)
  var placeWhereFunc = function() {
    // Find out where to place the relevant form.
    // This must be done when the -bd has been split into -bd-blks.
    var elem = $focusNonText.closest('.dw-p-bd-blk')
          .dwBugIfEmpty('error DwE6u5962rf3')
          .next('.dw-i-ts')
          .dwBugIfEmpty('error DwE17923xstq');

    if (isTextNode) {
      // Insert a magic token where the mouse was clicked.
      // Convert the whole post to text, and find the text just
      // after the magic token. That text (after the token) is
      // where the inline mark should be placed.
      // The *whole* post body is converted to text. If only
      // the clicked node was considered, the text just after
      // the click could be very short, e.g. only "You"
      // if the node is <h1>Hey You</h1> and "you" could have many
      // matches in the post (and when inline marks are placed
      // the whole post is considered).
      var origText = focusText.nodeValue;
      var textAfterFocus = origText.substr(sel.focusOffset);
      // "Move" the focus to the end of the clicked word, so the inline
      // mark won't split the word in two.
      var charsToEndOfWord = textAfterFocus.search(
          / |!|"|'|\)|\*|\+|\-|\/|<|>|\]|`|\||\}/i)
      if (charsToEndOfWord === -1) {
        // The user clicked the last word in the text node.
        // Place the mark after this last word.
        charsToEndOfWord = textAfterFocus.length;
      }
      var endOfWordOffs = sel.focusOffset + charsToEndOfWord;
      var textBefore = origText.substr(0, endOfWordOffs);
      var textAfter = origText.substr(endOfWordOffs);
      var token = '_magic_'+ Math.random() +'_'+ Math.random() +'_';
      var textWithToken = textBefore + token + textAfter;
      focusText.nodeValue = textWithToken; // this destroys `sel'
      sel = null;
      // Copy the post body, with the magic token, but skip inline threads.
      var $clean = $('<div></div>');
      $postBody.children('.dw-p-bd-blk').each(function() {
        $clean.append($(this).children().clone());  // .dw-i-ts skipped
      });
      // Undo the changes to the focused node.
      focusText.nodeValue = origText;
      // Remove all inline marks and threads from the copy.
      $clean.find('.dw-i-m-start').remove();
      var cleanHtmlWithMark = $clean.html();
      var sniff = TagDog.sniffHtml(cleanHtmlWithMark);
      // Find the text just after the mark.
      var tokenOffs = sniff.sniffedHtml.search(token);
      var justAfterMark = sniff.sniffedHtml.substr(
                            tokenOffs + token.length, tagDog.maxMatchLength);
      return {
        textStart: justAfterMark,
        // Currently not possible to mark a range of chars:
        textEnd: justAfterMark,
        elem: elem
      };
    } else {
      die('[error DwE09k12rs52]'); // dead code
    }
  };

  // Entitle the edit button `Suggest Edit' or `Edit', depending on
  // whether or not it's the user's post.
  var authorId = $post.dwAuthorId();
  var curUserId = Me.getUserId();

  // Open a menu, with Edit, Reply and Cancel buttons. CSS: '-i' means inline.
  $menu = $(  // TODO i18n
      '<ul class="dw-as-inline">' +
        '<li><a class="dw-a-edit-i">Improve</a></li>' +
        // Disable inline replies for now, until I've made them work better,
        //'<li><a class="dw-a-reply-i">Reply inline</a></li>' +
        //'<li><a class="dw-a-mark-i">Mark</a></li>' + // COULD implement
      '</ul>');
  $menu.find('a').button();//"option", "disabled", true);

  // Place the center of the menu on the mouse click. Then the
  // user needs move the mouse only a tiny amount up/dow or
  // northeast/nw/se/sw, to click the relevant button (if there are
  // <= 4 menu buttons). — no, then a double click causes a button click,
  // instead of selecting a word.
  var $thread = $post.closest('.dw-t');
  var threadOfs = $thread.offset();
  $thread.append($menu);
  var menuHeight = $menu.outerHeight(true);  // after append

  $menu.css('left', event.pageX - threadOfs.left - 50)  // 50 px to the left
      .css('top', event.pageY - threadOfs.top - menuHeight - 10); // above click

  // Fill in the `where' form field with the text where the
  // click/selection was made. Google's diff-match-patch can match
  // only 32 chars so specify only 32 chars.
  // (All selected text:
  //    sel.getRangeAt(0).toString().substr(0,32);
  // but we're interested in the start and end of the selection/click.)
  // TODO Consider using http://code.google.com/p/ierange/, so this stuff
  // works also with IE (6)/7/8.
  // BUG: Next line: Uncaught TypeError: Cannot read property 'data' of null

  // Preload dependencies, in case user opens editor:
  $post.each($loadEditorDependencies);

  // Bind actions.
  $menu.find('.dw-a-edit-i').click(function(){
    showInteractionsIfHidden();
    $post.each($showEditForm);
    $menu.remove();
  });

  $menu.find('.dw-a-reply-i').click(function(){
    // To have somewhere to place the reply form, split the block into
    // smaller .dw-p-bd-blk:s, and add .dw-i-ts, if not already
    // done (which is the case if this post has no inline replies).
    if (!$postBody.children('.dw-i-ts').length) {
      // This rearranging of elems destroys `sel', e.g. focusNode becomes null.
      $post.each($splitBodyPlaceInlines);
    }
    // Find the text that was clicked. Cannot be done until now, because
    // this destroys the selection, `sel', and it wouldn't be possible
    // to select text at all, were this done directly when the $menu was
    // created. (Because your selection wound be destroyed when you made it.)
    var placeWhere = placeWhereFunc();

    // Showing interactions, if hidden, might result in [the paragraph
    // that was clicked] being moved downwards, because inline threads
    // are inserted. This'll be fixed later, when inline threads are
    // shrinked, so the root post won't be affected by them being shown.
    showInteractionsIfHidden(); // might move `placeWhere' to elsewhere
    d.i.$showReplyForm.call(this, event, placeWhere);
    $menu.remove();
  });

  // Remove the menu after any action has been taken, and on Cancel click.
  $menu.mouseleave(function(){
    $menu.remove();
  });

  // If the user doesn't use the menu, remove it…
  var removeMenuTimeout = setTimeout(function(){
    $menu.remove();
  }, 1500);

  //… but cancel the remove-unused-menu timeout on mouseenter.
  $menu.mouseenter(function(){
    clearTimeout(removeMenuTimeout);
  });

  $lastInlineMenu = $menu;
}


// ------- Forms and actions

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
}

// Shows actions for the current post, or the last post hovered.
function $showActions() {
  // Hide any action links already shown; show actions for one post only.
  hideActions();
  // Show links for the the current post.
  $(this).closest('.dw-t').children('.dw-as')
    .css('visibility', 'visible')
    .attr('id', 'dw-p-as-shown');
}

function hideActions() {
  $('#dw-p-as-shown')
      .css('visibility', 'hidden')
      .removeAttr('id');
}

function $slideUp() {
  // COULD optimize: Be a $ extension that loops many elems then lastNow
  // would apply to all those (fewer calls to $drawParentsAndTree).
  var $i = $(this);
  var $post = $(this).closest('.dw-t').children('.dw-p');
  var lastNow = -1;
  var props = {
    height: 0,
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 0,
    marginBottom: 0
  };
  $i.animate(props, {
    duration: 530,
    step: function(now, fx) {
      // This callback is called once per animated property, but
      // we only need to redraw arrows once.
      if (lastNow === now) return;
      lastNow = now;
      $post.each(SVG.$drawParentsAndTree);
    }
  }).queue(function(next) {
    $i.hide();
    // Clear height etc, so $slideDown works properly.
    $.each(props, function(prop, val) {
      $i.css(prop, '');
    });
    next();
  });
}

function $slideDown() {
  // COULD optimize: See $slideUp(…).
  var $i = $(this);
  var $post = $i.closest('.dw-t').children('.dw-p');
  var realHeight = $i.height();
  $i.height(0).show().animate({height: realHeight}, {
    duration: 530,
    step: function(now, fx) {
      $post.each(SVG.$drawParentsAndTree);
    }
  });
  // Clear height and width, so $i adjusts its size after its child elems.
  $i.queue(function(next) {
    $(this).css('height', '').css('width', '');
    next();
  });
}

function $slideToggle() {
  if ($(this).is(':visible')) {
    $(this).each($slideUp);
  } else {
    $(this).each($slideDown);
  }
}

function fold($elem, how) {
  var $post = $elem.closest('.dw-t').children('.dw-p');
  $elem.animate(how.firstProps, {
    duration: how.firstDuration,
    step: function(now, fx) {
      $post.each(SVG.$drawParentsAndTree);
    }
  }).animate(how.lastProps, {
    duration: how.lastDuration,
    step: function(now, fx) {
      $post.each(SVG.$drawParentsAndTree);
    }
  });
}

function $foldInLeft() {
  // COULD optimize: See $slideUp(…), but pointless right now.
  var $i = $(this);
  var realHeight = $i.height();
  var realWidth = $i.width();
  $i.height(30).width(0).show();
  fold($i, {
    firstProps: {width: realWidth},
    firstDuration: 400,
    lastProps: {height: realHeight},
    lastDuration: 400
  });
  // Clear height and width, so $i adjusts its size after its child elems.
  $i.queue(function(next) {
    $(this).css('height', '').css('width', '');
    next();
  });
}

function $foldOutLeft() {
  // IE 7 and 8 bug fix: $.fold leaves the elem folded up
  // (the subsequent fold-left won't happen).
  if ($.browser.msie && $.browser.version < '9') {
    $(this).hide();
    return;
  }
  // COULD optimize: See $slideUp(…), but pointless right now.
  fold($(this), {
    firstProps: {height: 30},
    firstDuration: 400,
    lastProps: {width: 0, margin: 0, padding: 0},
    lastDuration: 400
  });
  // COULD clear CSS, so the elem gets its proper size should it be folded out
  // again later. Currently all elems that are folded out are also
  // $.remove()d though.
}

function removeInstantly($form) {
  var $thread = $form.closest('.dw-t');
  $form.remove();
  // Refresh SVG threads. When the last animation step callback was
  // invoked, the $form had not yet been remove()d.
  $thread.each(SVG.$drawPost).each(SVG.$drawParents);
  resizeRootThread();
}

// Action <form> cancel button -- won't work for the Edit form...?
function slideAwayRemove($form, opt_complete) {
  // Slide away <form> and remove it.
  var $thread = $form.closest('.dw-t');
  function rm(next) {
    if (opt_complete) opt_complete();
    removeInstantly($form);
    next();
  }
  // COULD elliminate dupl code that determines whether to fold or slide.
  if ($thread.filter('.dw-hor, .dw-debate').length &&  // COULD rm .dw-debate?
      !$form.closest('ol').filter('.dw-i-ts').length) {
    $form.each($foldOutLeft).queue(rm);
  }
  else {
    $form.each($slideUp).queue(rm);
  }
}


function $removeClosestForms() {
  // Sometimes the form is of class .dw-f, sometimes threre's a form parent
  // with class .dw-fs. Remove that parent if possible.
  var $formSetOrForm = $(this).closest('.dw-fs').add($(this).closest('.dw-f'));
  slideAwayRemove($formSetOrForm.first());
}


// Slide in reply, edit and rate forms -- I think it's
// easier to understand how they are related to other elems
// if they slide in, instead of just appearing abruptly.
// If $where is specified, $form is appended to the thread 
// $where.closest('.dw-t'), otherwise it is assumed that it has
// alread been inserted appropriately.
function slideInActionForm($form, $where) {
  if ($where) {
    // Insert before the first .dw-fs, or the .dw-res, or append.
    var $thread = $where.closest('.dw-t');
    var $oldFormOrCmts = $thread.children('.dw-fs, .dw-res').filter(':eq(0)');
    if ($oldFormOrCmts.length) $oldFormOrCmts.before($form);
    else $thread.append($form);
  }
  else $where = $form.closest('.dw-t');
  // Extra width prevents float drop.
  resizeRootThreadExtraWide();
  // Slide in from left, if <form> siblings ordered horizontally.
  // Otherwise slide down (siblings ordered vertically).
  if ($where.filter('.dw-hor, .dw-debate').length && // COULD rm .dw-debate?
      !$form.closest('ol').filter('.dw-i-ts').length) {
    $form.each($foldInLeft);
  } else {
    $form.each($slideDown);
  }

  // Scroll form into view, and cancel extra width.
  // Or add even more width, to prevent float drops
  // -- needs to be done also when sliding downwards, since that sometimes
  // makes the root thread child threads wider.
  $form.queue(function(next){
      resizeRootThreadNowAndLater();
      $form.dwScrollIntoView();
      next();
    });
}



// ------- Templates and notifications

// Returns $(an-error-message-in-a-<div>), which you can .insertAfter
// something, to indicate e.g. the server refused to accept the
// suggested edits.
// COULD remove this function! And let the server reply via
// FormHtml._responseDialog, and use (a modified version of?)
// showServerResponseDialog() (below) to construct an error info box.
// Then this would work with javascript disabled, and i18n would be
// handled server side.
function notifErrorBox$(error, message, details) {
  var when = '' // (Does toISOString exist in all browsers?)
                // No, not IE 8 says http://kangax.github.com/es5-compat-table/
  try { when = (new Date).toISOString(); } catch (e) {}
  var $box = $(
      '<div class="ui-widget dw-ntf">' +
        '<div class="ui-state-error ui-corner-all">' +
          '<a class="ui-dialog-titlebar-close ui-corner-all" role="button">' +
            '<span class="ui-icon ui-icon-closethick">close</span>' +
          '</a>' +
          '<span class="ui-icon ui-icon-alert" ' +
                'style="float: left; margin-right: .3em;"></span>' +
          '<div class="dw-ntf-bd">' +
            '<div class="dw-ntf-sts"></div> ' +
            '<div class="dw-ntf-msg"></div>' +
            '<div class="dw-ntf-at">'+ when +'</div>' +
            (details ?
               '<br><a class="dw-ntf-shw">Show details</a>' +
               '<pre class="dw-ntf-dtl"></pre>' : '') +
          '</div>' +
        '</div>' +
      '</div>');
  var $showDetails = $box.find('a.dw-ntf-shw');
  var $details = $box.find('.dw-ntf-dtl');
  error = error ? error +':' : ''
  // I don't use jQuery's .tmpl: .text(...) is xss safe, .tmpl(...) is not?
  $box.find('.dw-ntf-sts').text(error).end()
      .find('.dw-ntf-msg').text(message).end()
      .find('.dw-ntf-dtl').text(details || '').hide().end()
      .find('.dw-ntf-shw').click(function() {
        $details.toggle();
        $showDetails.text(
            $details.filter(':visible').length ?
               'Hide details' : 'Show details');
      }).end()
      .find('a.ui-dialog-titlebar-close').click(function() {
        $box.remove();
      });
  return $box;
}


$.fn.dwActionLinkEnable = function() {
  setActionLinkEnabled(this, true);
  return this;
}


$.fn.dwActionLinkDisable = function() {
  setActionLinkEnabled(this, false);
  return this;
}


function setActionLinkEnabled($actionLink, enabed) {
  if (!$actionLink.length) return;
  bugIf(!$actionLink.is('.dw-a'));
  if (!enabed) {
    // (Copy the event list; off('click') destroys the original.)
    var handlers = $actionLink.data('events')['click'].slice();
    $actionLink.data('DisabledHandlers', handlers);
    $actionLink.addClass('dw-a-disabled').off('click');
  } else {
    var handlers = $actionLink.data('DisabledHandlers');
    $actionLink.removeData('DisabledHandlers');
    $.each(handlers, function(index, handler) { 
      $actionLink.click(handler);
    });
    $actionLink.removeClass('dw-a-disabled');
  }
}


function disableSubmittedForm($form) {
  $form.children().css('opacity', '0.7').find('input').dwDisable();
  // Show a 'Submitting ...' tips. CSS places it in the middle of the form.
  var $info = $('#dw-hidden-templates .dw-inf-submitting-form').clone();
  $form.append($info);
}


// Builds a function that shows an error notification and enables
// inputs again (e.g. the submit-form button again, so the user can
// fix the error, after having considered the error message,
// and attempt to submit again).
function showErrorEnableInputs($form) {
  return function(jqXHR, errorType, httpStatusText) {
    var $submitBtns = $form.find('.dw-submit-set');
    var $thread = $form.closest('.dw-t');
    var err = jqXHR.status ? (jqXHR.status +' '+ httpStatusText) : 'Error'
    var msg = (jqXHR.responseText || errorType || 'Unknown error');
    notifErrorBox$(err, msg).insertAfter($submitBtns).dwScrollToHighlighted();
    $thread.each(SVG.$drawParentsAndTree); // because of the notification
    // For now, simply enable all inputs always.
    $form.children().css('opacity', '');
    $form.find('input, button').dwEnable();
    $form.children('.dw-inf-submitting-form').remove();
  };
}


// Constructs and shows a dialog, from either 1) a servers html response,
// which should contain certain html elems and classes, or 2)
// a jQuery jqXhr object.
function showServerResponseDialog(jqXhrOrHtml, opt_errorType,
                                  opt_httpStatusText, opt_continue) {
  var $html, title, width;
  var html, plainText;

  // Find html or plain text.
  if (!jqXhrOrHtml.getResponseHeader) {
    html = jqXhrOrHtml;
  }
  else {
    var contentType = jqXhrOrHtml.getResponseHeader('Content-Type');
    if (!contentType) {
      plainText = '(no Content-Type header)';
      if (jqXhrOrHtml.state && jqXhrOrHtml.state() == 'rejected') {
        plainText = plainText + '\n($.Deferred was rejected)';
      }
    }
    else if (contentType.indexOf('text/html') !== -1) {
      html = jqXhrOrHtml.responseText;
    }
    else if (contentType.indexOf('text/plain') !== -1) {
      plainText = jqXhrOrHtml.responseText;
    }
    else {
      die2('DwE94ki3');
    }
  }

  // Format dialog contents.
  if (html) {
    var $allHtml = $(html);
    $html = $allHtml.filter('.dw-dlg-rsp');
    if (!$html.length) $html = $allHtml.find('.dw-dlg-rsp');
    if ($html.length) {
      title = $html.children('.dw-dlg-rsp-ttl').text();
      width = d.i.jQueryDialogDefault.width;
    } else {
      plainText = 'Internal server error.';
    }
  }

  if (plainText) {
    // Set title to something like "403 Forbidden", and show the
    // text message inside the dialog.
    title = jqXhrOrHtml.status ?
              (jqXhrOrHtml.status +' '+ opt_httpStatusText) : 'Error'
    $html = $('<pre class="dw-dlg-rsp"></pre>');
    width = 'auto'; // avoids scrollbars in case of any long <pre> line
    // Use text(), not plus (don't: `... + text + ...'), to prevent xss issues.
    $html.text(plainText || opt_errorType || 'Unknown error');
  }
  else if (!html) {
    die2('DwE05GR5');
  }

  // Show dialog.
  $html.children('.dw-dlg-rsp-ttl').remove();
  $html.dialog($.extend({}, d.i.jQueryDialogNoClose, {
    title: title,
    autoOpen: true,
    width: width,
    buttons: {
      OK: function() {
        $(this).dialog('close');
        if (opt_continue) opt_continue();
      }
    }
  }));
}


// ------- User properties

// Updates cookies and elements to show the user name, email etc.
// as appropriate. Unless !propsUnsafe, throws if name or email missing.
// Fires the dwEvLoggedInOut event on all .dw-loginsubmit-on-click elems.
// Parameters:
//  props: {name, email, website}, will be sanitized unless
//  sanitize: unless `false', {name, email, website} will be sanitized.
function fireLogout() {
  Me.refreshProps();
  $('#dw-u-info').hide();
  $('#dw-a-logout').hide();
  $('#dw-a-login').show();

  // Clear all xsrf tokens. They are invalid now after logout, because
  // the server instructed the browser to delete the session id cookie.
  $('input.dw-fi-xsrf').attr('value', '');

  // Let `Post as <username>' etc buttons update themselves:
  // they'll replace <username> with `...'.
  $('.dw-loginsubmit-on-click, .dw-loginsubmit-on-mouseenter')
      .trigger('dwEvLoggedInOut', [undefined]);

  Me.clearMyPageInfo();
}


function fireLogin() {
  Me.refreshProps();
  $('#dw-u-info').show()
      .find('.dw-u-name').text(Me.getName());
  $('#dw-a-logout').show();
  $('#dw-a-login').hide();

  // Update all xsrf tokens in any already open forms (perhaps with
  // draft texts, we shuldn't close them). Their xsrf prevention tokens
  // need to be updated to match the new session id cookie issued by
  // the server on login.
  var token = $.cookie('dwCoXsrf');
  //$.cookie('dwCoXsrf', null, { path: '/' }); // don't send back to server
  // ^ For now, don't clear the dwCoXsrf cookie, because then if the user
  // navigates back to the last page, after having logged out and in,
  // the xsrf-inputs would need to be refreshed from the cookie, because
  // any token sent from the server is now obsolete (after logout/in).
  $('input.dw-fi-xsrf').attr('value', token);

  // Let Post as ... and Save as ... buttons update themselves:
  // they'll replace '...' with the user name.
  $('.dw-loginsubmit-on-click, .dw-loginsubmit-on-mouseenter')
      .trigger('dwEvLoggedInOut', [Me.getName()]);

  Me.clearMyPageInfo();
  Me.loadAndMarkMyPageInfo();
}


// Returns a user object, with functions refreshProps, getName,
// isLoggedIn, getLoginId and getUserId.
function makeCurUser() {
  // Cache user properties — parsing the session id cookie over and
  // over again otherwise takes 70 - 80 ms on page load, but only
  // 2 ms when cached. (On my 6 core 2.8 GHz AMD, for a page with
  // 100 posts. The user id is checked frequently, to find out which
  // posts have the current user written.)
  var userProps;
  var emailPrefs = undefined;
  var emailSpecified = false;
  var permsOnPage = {};

  function refreshProps() {
    parseSidCookie();
    parseConfigCookie();
  }

  // Warning: Never use the user's name as html, that'd allow xss attacks.
  // (loginId and userId are generated by the server.)
  function parseSidCookie() {
    // sid example:
    //   Y1pBlH7vY4JW9A.23.11.Magnus.1316266102779.15gl0p4xf7
    var sid = $.cookie('dwCoSid');
    if (!sid) {
      userProps = { loginId: undefined, userId: undefined, name: undefined };
      return;
    }
    var arr = sid.split('.');
    userProps = {
      // [0] is a hash
      loginId: arr[1],
      userId: arr[2],
      name: arr[3].replace('_', '.')
      // [4] is login time
      // [5] is a random value
    };
  }

  function parseConfigCookie() {
    var val = $.cookie('dwCoConf');
    emailPrefs = undefined;
    emailSpecified = false;
    if (!val) return;
    if (val.indexOf('EmNtR') !== -1) emailPrefs = 'Receive';
    if (val.indexOf('EmNtN') !== -1) emailPrefs = 'DontReceive';
    if (val.indexOf('EmNtF') !== -1) emailPrefs = 'ForbiddenForever';
    if (val.indexOf('EmSp') !== -1) emailSpecified = true;
  }

  function fireLoginIfNewSession(opt_loginIdBefore) {
    // Sometimes an event object is passed instead of a login id.
    var loginIdBefore = typeof opt_loginIdBefore == 'string' ?
        opt_loginIdBefore : userProps.loginId;
    Me.refreshProps();
    if (loginIdBefore !== userProps.loginId) {
      if (Me.isLoggedIn()) fireLogin();
      else fireLogout();
      // If the login/logout happened in another browser tab:
      // COULD pop up a modal dialog informing the user that s/he has
      // been logged in/out, because of something s/he did in *another* tab.
      // And that any posts s/he submits will be submitted as the new user.
    }
  }

  /**
   * Clears e.g. highlightings of the user's own posts and ratings.
   */
  function clearMyPageInfo() {
    $('.dw-p-by-me').removeClass('dw-p-by-me');
    $('.dw-p-r-by-me').remove();
    permsOnPage = {};
  }

  /**
   * Highlights e.g. the user's own posts and ratings.
   *
   * Loads user specific info from the server, e.g. info on
   * which posts the current user has authored or rated,
   * and the user's permissions on this page.
   *
   * If, however, the server has already included the relevant data
   * in a certain hidden .dw-data-yaml node on the page, then use
   * that data, but only once (thereafter always query the server).
   * — So the first invokation happens synchronously, subsequent
   * invokations happens asynchronously.
   */
  function loadAndMarkMyPageInfo() {
    // Avoid a roundtrip by using any yaml data already inlined on the page.
    // Then delete it because it's only valid on page load.
    var hiddenYamlTag = $('.dw-data-yaml');
    if (hiddenYamlTag.length) {
      parseYamlMarkActions(hiddenYamlTag.text());
      hiddenYamlTag.hide().removeClass('dw-data-yaml');
    }
    else {
      // Query the server.
      // On failure, do what? Post error to non existing server error
      // reporting interface?
      $.get('?page-info&user=me', 'text')
          .fail(showServerResponseDialog)  // for now
          .done(function(yamlData) {
        parseYamlMarkActions(yamlData);
      });
    }

    function parseYamlMarkActions(yamlData) {
      var pageInfo = YAML.eval(yamlData);
      permsOnPage = pageInfo.permsOnPage;
      markMyActions(pageInfo);
    }

    function markMyActions(actions) {
      if (actions.ratings) $.each(actions.ratings, showMyRatings);
      if (actions.authorOf) $.each(actions.authorOf, function(ix, postId) {
        markMyPost(postId);
      });
    }
  }

  return {
    // Call whenever the SID changes: on page load, on login and logout.
    refreshProps: refreshProps,
    clearMyPageInfo: clearMyPageInfo,
    loadAndMarkMyPageInfo: loadAndMarkMyPageInfo,
    // Call when a re-login might have happened, e.g. if focusing
    // another browser tab and then returning to this tab.
    fireLoginIfNewSession: fireLoginIfNewSession,

    // Warning: Never ever use this name as html, that'd open for
    // xss attacks. E.g. never do: $(...).html(Me.getName()), but the
    // following should be okay though: $(...).text(Me.getName()).
    getName: function() { return userProps.name; },
    isLoggedIn: function() { return userProps.loginId ? true : false; },
    getLoginId: function() { return userProps.loginId; },
    getUserId: function() { return userProps.userId; },
    mayEdit: function($post) {
      return userProps.userId === $post.dwAuthorId() ||
          permsOnPage.editPage ||
          (permsOnPage.editAnyReply && $post.dwIsReply()) ||
          (permsOnPage.editUnauReply && $post.dwIsUnauReply());
    },
    getEmailNotfPrefs: function() { return emailPrefs; },
    isEmailKnown: function() { return emailSpecified; }
  };
}


function showMyRatings(postId, ratings) {
  var $header = getPostHeader$(postId);
  var $myRatings = $(  // i18n
    '<span>. <span class="dw-p-r-by-me">You rated it <em></em></span></span>');
  $myRatings.find('em').text(ratings.join(', '));
  $header.children('.dw-p-r-by-me').remove(); // remove any old
  // Insert after authorship, flags and ratings info.
  $header.children('.dw-p-r-top, .dw-p-flgs-top, .dw-p-at')
      .last().after($myRatings);
  // Remove outer <span>.
  $myRatings = $myRatings.children().unwrap();
  return $myRatings;
}


function markMyPost(postId) {
  var $header = getPostHeader$(postId);
  $header.children('.dw-p-by').addClass('dw-p-by-me');
}


// ------- Logout

// COULD refactor jQuery UI dialog usage: a function that creates a default
// Debiki dialog. E.g. hide the submit input, and set defaut properties.

function showLogout() {
  initLogout();
  $('#dw-fs-lgo').dialog('open');
}

function initLogout() {
  var $logout = $('#dw-fs-lgo');
  if ($logout.is('.ui-dialog-content'))
    return; // already inited

  var $logoutForm = $logout.find('form');
  $logout.find('input').hide(); // Use jQuery UI's dialog buttons instead
  $logout.dialog($.extend({}, d.i.jQueryDialogDefault, {
    height: 180,
    width: 280,
    buttons: {
      Cancel: function() {
        $(this).dialog('close');
      },
      'Log out': function() {
        $(this).dialog('close');
        $logoutForm.submit();
      }
    }
  }));
  $logoutForm.submit(function() {
    // Don't clear the user name and email cookies until the server has
    // indeed logged out the user.
    var postData = $logoutForm.serialize();
    $.post($logoutForm.attr("action"), postData, function() {
      // The server has now logged out the user.
      fireLogout();
    }, 'html');
    return false;
  });
}

// ------- Login result

function showLoginOkay(opt_continue) {
  initLoginResultForms(opt_continue);
  $('#dw-fs-lgi-ok-name').text(Me.getName());
  $('#dw-fs-lgi-ok').dialog('open');
}

function showLoginFailed(errorMessage) {
  initLoginResultForms();
  $('#dw-fs-lgi-failed-errmsg').text(errorMessage);
  $('#dw-fs-lgi-failed').dialog('open');
}

var initLoginResultForms = (function() {
  var continueClbk;
  return function(opt_continue) {  // COULD remove this function?...
          // ...No longer called on login OK? Is it called on failure?
    continueClbk = opt_continue;
    if ($('#dw-fs-lgi-ok.ui-dialog-content').length)
      return; // login-ok and -failed already inited

    var $loginResult = $('#dw-fs-lgi-ok, #dw-fs-lgi-failed');
    var $loginResultForm = $loginResult.find('form');
    $loginResult.find('input').hide(); // Use jQuery UI's dialog buttons instead
    $loginResult.dialog($.extend({}, d.i.jQueryDialogNoClose, {
      buttons: {
        'OK': function() {
          $(this).dialog('close');
          !continueClbk || continueClbk();
        }
      }
    }));
  }
})();


// ------- Login, simple

function initLoginSimple() {
  var $login = $('#dw-fs-lgi-simple');
  if ($login.is('.ui-dialog-content'))
    return; // already inited

  var $loginForm = $login.find('form');
  $login.find('.dw-fi-submit').hide();  // don't show before name known
  // Use jQueryDialogReset so email is not remembered, in case
  // this is a public computer, e.g. in a public library.
  // Usually (?) the browser itself helps you fill in form fields, e.g.
  // suggests your email address?
  $login.dialog($.extend({}, d.i.jQueryDialogReset, {
    width: 452,
    buttons: {
      Submit: function() {
        $loginForm.submit();
      },
      Cancel: function() {
        $(this).dialog('close');
      }
    }
  }));

  $loginForm.submit(function() {
    // COULD show a "Logging in..." message — the roundtrip
    // might take a second if the user is far away?
    $.post($loginForm.attr("action"), $loginForm.serialize(), 'html')
        .done(function(data) {
          // Warning: Somewhat dupl code, see d.i.handleLoginResponse.
          // User info is now available in cookies.
          $login.dialog('close');
          fireLogin();
          // Show response dialog, and continue with whatever caused
          // the login to happen.
          // {{{ If the login happens because the user submits a reply,
          // then, if the reply is submitted (from within
          // continueAnySubmission) before the dialog is closed, then,
          // when the browser moves the viewport to focus the new reply,
          // the welcome dialog might no longer be visible in the viewport.
          // But the viewport will still be dimmed, because the welcome
          // dialog is modal. So don't continueAnySubmission until
          // the user has closed the response dialog. }}}
          showServerResponseDialog(data, null, null, continueAnySubmission);
        })
        .fail(showServerResponseDialog)
        .always(function() {
          // COULD hide any "Logging in ..." dialog.
        });
    return false;
  });

  $login.find('.dw-a-login-openid')
      .button().click(function() {
        showLoginOpenId();
        return false;
      });
}


function $loginSubmitOnClick(loginEventHandler, data) {
  return _$loginSubmitOn('click', loginEventHandler, data);
}


function $loginSubmitOnMouseenter(loginEventHandler, data) {
  return _$loginSubmitOn('mouseenter', loginEventHandler, data);
}


function _$loginSubmitOn(eventType, loginEventHandler, data) {
  return function() {
    var $i = $(this);
    $i.addClass('dw-loginsubmit-on-'+ eventType);
    !loginEventHandler || $i.bind('dwEvLoggedInOut', loginEventHandler);
    $i.on(eventType, null, data, $loginThenSubmit)
  };
}


// Invoke on a .login-on-click submit <input>. After the login
// has been completed, the button will be submitted, see
// continueAnySubmission(). If already logged in, submits immediately.
function $loginThenSubmit(event) {
  loginOnClickBtnClicked = this;
  continueLoginAskAboutEmail = event.data && event.data.askAboutEmailNotfs;
  if (!Me.isLoggedIn()) {
    // Will call continueAnySubmission(), after login.
    // {{{ Hmm, could add a `continue' callback to showLogin() instead!?
    // But initLoginSimple/OpenId runs once only, so the very first
    // anonymous function is the only one considered, so a somewhat
    // global callback-to-invoke-state is needed anyway.
    // Better move login stuff to a separate module (with a module
    // local "global" callback state).}}}
    showLoginSimple();
  } else {
    continueAnySubmission();
  }
  return false;  // skip default action; don't submit until after login
}


/**
 * Continues any form submission that was interrupted by the
 * user having to log in.
 */
function continueAnySubmission() {
  // Configure email notification prefs, unless already done.
  // (This is useful e.g. if the user submits a reply but hasn't
  // specified her email prefs. We want her to subscribe to
  // email notfs, and right now her motivation is at its peak?)
  var emailQuestion = $.Deferred().resolve();
  if (continueLoginAskAboutEmail) {
    continueLoginAskAboutEmail = false;
    if (!Me.getEmailNotfPrefs()) {
      emailQuestion = configEmailPerhapsRelogin();
    }
  }

  // If the login was initiated via a click on a
  // .dw-loginsubmit-on-click button, continue the submission
  // process that button is supposed to start.
  emailQuestion.done(function() {
    $(loginOnClickBtnClicked).closest('form').submit();
  }).always(function() {
    loginOnClickBtnClicked = null;
  });
}


var configEmailPerhapsRelogin = (function() {
  var dialogStatus;

  return function() {
    dialogStatus = $.Deferred();

    var $form = $('#dw-f-eml-prf');
    var $emailAddrDiv = $form.find('.dw-f-eml-prf-adr');
    var $dontRecvBtn = $form.find('#dw-fi-eml-prf-rcv-no');
    var $yesRecvBtn = $form.find('#dw-fi-eml-prf-rcv-yes');

    // Init dialog, do once only.
    if (!$form.parent().is('.ui-dialog')) {
      $form.dialog($.extend({}, d.i.jQueryDialogDefault, {
        close: function() {
          dialogStatus.reject();
          // Better not remember email addr. Perhaps this is a public
          // computer, e.g. in a public library.
          d.i.jQueryDialogReset.close.apply(this);
        }
      }));
      $('#dw-f-eml-prf').find('input[type="radio"], input[type="submit"]')
          .button();

      $dontRecvBtn.click(submitForm); // always
      $form.submit(function() {
        $yesRecvBtn.button('enable'); // or value not posted

        // When you change your email address, this triggers a re-login,
        // if you use an unauthenticated identity — because the email is
        // part of that identity. We need to know if a login happens.
        var loginIdBefore = Me.getLoginId();

        $.post($form.attr('action'), $form.serialize(), 'html')
            .done(function(responseHtml) {
              // Fire login event, to update xsrf tokens, if the server
              // created a new login session (because we changed email addr).
              Me.fireLoginIfNewSession(loginIdBefore);

              dialogStatus.resolve();
              $form.dialog('close');
              // (Ignore responseHtml; it's empty, or a Welcome message.)
            })
            .fail(showServerResponseDialog);
        return false;
      });
    }

    // Hide email input, if email addr already specified,
    // and submit directly on Yes/No click.
    function submitForm() {
      $form.submit();
      return false;
    }
    function showEmailAddrInp() {
      $emailAddrDiv.show();
      $yesRecvBtn.button('disable');
    }
    $emailAddrDiv.hide();
    $yesRecvBtn.button('enable');
    if (Me.isEmailKnown()) {
      // Submit directly; need not ask for email addr.
      $yesRecvBtn.click(submitForm);
      $yesRecvBtn.off('click', showEmailAddrInp);
    } else {
      // Ask for email addr; submit via Done button.
      $yesRecvBtn.click(showEmailAddrInp);
      $yesRecvBtn.off('click', submitForm);
    }

    $form.dialog('open');
    return dialogStatus;
  }
})();


function showLoginSimple() {
  initLoginSimple();
  $('#dw-fs-lgi-simple').dialog('open');  // BUG Tag absent unless…
          //… a debate is shown, so the dw-hidden-templates included.
  // Preload OpenID resources, in case user clicks OpenID login button.
  loadOpenIdResources();
}



// ------- Login, OpenID


function showLoginOpenId() {
  loadOpenIdResources().done(function() {
    initLoginOpenId();
    $('#dw-fs-openid-login').dialog('open');
  });
}


var loadOpenIdResources = (function() {
  var loadStatus;
  return function() {
    if (loadStatus)
      return loadStatus;
    loadStatus = $.Deferred();
    // (COULD load these files directly in the <head>, on desktops,
    // and load a single .min.js.gz on mobiles. And load one at a time
    // in Dev builds. But that'd be 3 different cases! Postpone...)
    Modernizr.load({
      load: [
        '/-/res/openid-selector/css/openid.css',
        '/-/res/openid-selector/js/openid-jquery.js',
        '/-/res/openid-selector/js/openid-en.js',
        '/-/res/popuplib.js'],
      complete: function() {
        loadStatus.resolve();
      }
    });
    return loadStatus;
  }
})();


function initLoginOpenId() {
  var $openid = $('#dw-fs-openid-login');
  if ($openid.is('.ui-dialog-content'))
    return; // already inited

  openid.img_path = '/-/res/openid-selector/images/';
  openid.submitInPopup = submitLoginInPopup;
  // Keep default openid.cookie_expires, 1000 days
  // — COULD remove cookie on logout?
  openid.init('openid_identifier');

  // Use jQueryDialogReset, so OpenID cleared on close,
  // in case this is a public computer?
  $openid.dialog($.extend({}, d.i.jQueryDialogReset, {
    width: 670,
    height: 410, // (incl. extra space for 'Enter your OpenID' input field)
    // Place above guest login dialog.
    zIndex: d.i.jQueryDialogDefault.zIndex + 10,
    buttons: {
      Cancel: function() {
        $(this).dialog('close');
      }
    }
  }));
}


// Submits an OpenID login <form> in a popup. Dims the window and
// listens for the popup to close.
function submitLoginInPopup($openidLoginForm) {
  // Based on popupManager.createPopupOpener, from popuplib.js,
  // in this folder.

  var width = 450;
  var height = 500;
  var coordinates = popupManager.getCenteredCoords(width, height);

  // Here is described how to configure the popup window:
  // http://svn.openid.net/repos/specifications/user_interface/1.0/trunk
  //    /openid-user-interface-extension-1_0.html
  var popupWindow = window.open('', 'LoginPopup',
      'width='+ width +',height='+ height +
      ',status=1,location=1,resizable=yes'+
      ',left='+ coordinates[0] +',top='+ coordinates[1]);

  // Check to perform at each execution of the timed loop. It also triggers
  // the action that follows the closing of the popup
  var waitCallback = window.setInterval(waitForPopupClose, 80);
  function waitForPopupClose() {
    if (popupWindow && !popupWindow.closed) return;
    popupWindow = null;
    var darkCover = window.document.getElementById(
        window.popupManager.constants['darkCover']);
    if (darkCover) {
      darkCover.style.visibility = 'hidden';
    }
    if (d.i.handleLoginResponse !== null) {
      d.i.handleLoginResponse({status: 'LoginFailed'});
    }
    if (waitCallback !== null) {
      window.clearInterval(waitCallback);
      waitCallback = null;
    }
  }

  // This callback is called from the return_to page:
  d.i.handleLoginResponse = function(result) {
    d.i.handleLoginResponse = null;
    var errorMsg;
    if (/openid\.mode=cancel/.test(result.queryString)) {
      // This seems to happen if the user clicked No Thanks in some
      // login dialog; when I click "No thanks", Google says:
      // "openid.mode=cancel&
      //  openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0"
      errorMsg = 'You cancelled the login process? [error DwE89GwJm43]';
    } else if (result.status === 'LoginFailed') {
      // User closed popup window?
      errorMsg = 'You closed the login window? [error DwE5k33rs83k0]';
    } else if (result.status !== 'LoginOk') {
      errorMsg = 'Unknown login problem [error DwE3kirsrts12d]';
    } else {
      // Login OK
      // {{{ The queryString is e.g. …
      // openid.ns=http://specs.openid.net/auth/2.0
      // openid.mode=id_res
      // openid.op_endpoint=https://www.google.com/accounts/o8/ud
      // openid.response_nonce=2011-04-10T20:14:19Zwq0i9rEOAN0QsA
      // openid.return_to=http://10.42.43.10:8080/openid/response
      // openid.assoc_handle=AOQobUdh75yilxlGb-KbwvcLIocAG...
      // openid.signed=op_endpoint,claimed_id,identity,return_to,
      //    response_nonce,assoc_handle,ns.ext1,ext1.mode,ext1.type.first,
      //    ext1.value.first,ext1.type.email,ext1.value.email,
      //    ext1.type.country,ext1.value.country
      // openid.sig=jlCF7WrP99%2Be1Ee8eq1s03JUE0h4wILx37FHZkv/KlA=
      // openid.identity=https://www.google.com/accounts/o8/id?id=AItOaw...
      // openid.claimed_id=https://www.google.com/accounts/o8/id?id=AItO...
      // openid.ns.ext1=http://openid.net/srv/ax/1.0
      // openid.ext1.mode=fetch_response
      // openid.ext1.type.first=http://axschema.org/namePerson/first
      // openid.ext1.value.first=Kaj+Magnus
      // openid.ext1.type.email=http://axschema.org/contact/email
      // openid.ext1.value.email=someone@example.com
      // openid.ext1.type.country=http://axschema.org/contact/country/home
      // openid.ext1.value.country=SE
      // }}}

      // Warning: Somewhat dupl code, compare w initLoginSimple.
      $('#dw-fs-openid-login').dialog('close');
      $('#dw-fs-lgi-simple').dialog('close');
      fireLogin();
      showLoginOkay(continueAnySubmission);
      return;
    }

    showLoginFailed(errorMsg);
  }

  // TODO dim the main win, open a modal dialog: "Waiting for you to log in",
  // and a Cancel button, which closes the popup window.
  // — Then the user can continue also if the popup gets lost (perhaps
  // lots of windows open).

  // Make the default submit action submit the login form in the popup window.
  $openidLoginForm.attr('target', 'LoginPopup');
}



// ------- Inline edits

d.i.EditTabIdEdit = 0;
d.i.EditTabIdDiff = 1;
d.i.EditTabIdPreview = 2;
d.i.EditTabIdLast = d.i.EditTabIdPreview;
d.i.EditTabCount = 3;


var $loadEditorDependencies = (function() {
  // COULD use 2 loadStatus, and load Code Mirror only iff `this`
  // is the root post.
  var loadStatus;
  return function() {
    if (loadStatus)
      return loadStatus;
    loadStatus = $.Deferred();
    var loadCodeMirror = !Modernizr.touch;
    Modernizr.load({
      test: loadCodeMirror,
      yep: [
        '/-/res/codemirror/lib/codemirror.css',
        '/-/res/codemirror/lib/util/dialog.css', // search dialogs
        '/-/res/codemirror-2.25-custom.min.js'],
      both: [
        '/-/res/wmd/showdown.js'],
      complete: function() {
        loadStatus.resolve();
      }
    })
    return loadStatus;
  }
})();


/**
 * Loads editor resources and opens the edit form.
 */
function $showEditForm() {
  var i = this;
  $loadEditorDependencies.call(i).done(function() {
    _$showEditFormImpl.call(i);
  });
}


function _$showEditFormImpl() {
  var $post = $(this);
  var $postBody = $post.children('.dw-p-bd');
  var postId = $post.dwPostId();
  var isRootPost = $post.parent().is('.dw-depth-0');

  // It's confusing with Reply/Rate/etc below the edit form.
  hideActions();

  var editFormLoader = function(debateId, rootPostId, postId, complete) {
    $.get('?edit='+ postId +'&view='+ rootPostId, function(editFormText) {
      // Concerning filter(…): [0] and [2] are text nodes.
      var $editForm = $(editFormText).filter('form');
      d.u.makeIdsUniqueUpdateLabels($editForm, '#dw-e-tab-');
      complete($editForm)
    }, 'text');
  };

  function $disableSubmitBtn() {
    $(this).find('input.dw-fi-submit').button({ disabled: true }).end()
        .find('.dw-f-e-prvw-info').show();
  }

  function scrollPostIntoView() {
    $post.dwScrollIntoView({ marginLeft: 40, marginTop: -35 });
  }

  // If the edit form has already been opened, but hidden by a Cancel click,
  // reuse the old hidden form, so any edits aren't lost.
  var $oldEditForm = $post.children('.dw-f-e');
  if ($oldEditForm.length) {
    $oldEditForm.each($disableSubmitBtn);
    $oldEditForm.find('.dw-e-tabs').tabs('select' , d.i.EditTabIdEdit);
    $oldEditForm.show();
    $postBody.hide();
    scrollPostIntoView();
    return;
  }

  editFormLoader(debateId, rootPostId, postId, function($editForm) {
    var $panels = $editForm.find('.dw-e-tab');
    var $editPanel = $panels.filter('[id^="dw-e-tab-edit"]');
    var $diffPanel = $panels.filter('[id^="dw-e-tab-diff"]');
    var $previewPanel = $panels.filter('[id^="dw-e-tab-prvw"]');
    var $submitBtn = $editForm.find('input.dw-fi-submit');
    var $cancelBtn = $editForm.find('input.dw-fi-cancel');

    var $clickPreviewHelp = $editForm.find('.dw-f-e-prvw-info');
    var $suggestOnlyHelp = $editForm.find('.dw-f-e-sugg-info');

    var $editTabs = $editForm.children('.dw-e-tabs');
    var $tabPanelLinks = $editTabs.find('> ul > li > a');
    var $editTabLink = $tabPanelLinks.filter('a[href^="#dw-e-tab-edit"]');
    var $diffTabLink = $tabPanelLinks.filter('a[href^="#dw-e-tab-diff"]');
    var $previewTabLink = $tabPanelLinks.filter('a[href^="#dw-e-tab-prvw"]');

    var codeMirrorEditor = null;

    $submitBtn.button({ disabled: true }); // you need to preview before submit
    $cancelBtn.button();

    $editForm.insertBefore($postBody);
    $postBody.hide();
    $cancelBtn.click(function() {
      $postBody.show();
      $editForm.hide();
      $post.each(SVG.$drawParents);
    });

    // Find the post's current (old) source text, and store in
    // .dw-e-src-old, so it's easily accessible to $updateEditFormDiff(…).
    if (!$editForm.data('dw-e-src-old')) {
      var oldSrc = $editForm.find('.dw-e-src-old');
      if (oldSrc.length) {
        oldSrc = oldSrc.text();
      }
      else {
        // html.scala excluded .dw-e-src-old, if the textarea's text
        // is identical to the old src. (To save bandwidth.)
        oldSrc = $editPanel.find('textarea').val();
      }
      $editForm.data('dw-e-src-old', oldSrc);
    }

    // Don't show until Submit button visible. (Would be too much to read,
    // because the 'Click Preview then Save' help text is alo visible.)
    $suggestOnlyHelp.hide();

    var enableSubmitBtn = function() {
      $submitBtn.button({ disabled: false });
      $clickPreviewHelp.hide();
      // Notify the user if s/he is making an edit suggestion only.
      var hideOrShow = Me.mayEdit($post) ? 'hide' : 'show';
      $suggestOnlyHelp[hideOrShow]();
      $editForm.children('.dw-submit-set').dwScrollIntoView();
    }

    // Update the preview, if the markup type is changed.
    $editForm.find('select[name="dw-fi-e-mup"]').change(function() {
      $editForm.each($updateEditFormPreview);
    });

    // If CodeMirror has been loaded, use it.
    // For now, use CodeMirror on the root post only — because if
    // the other posts are resized, CodeMirror's interal width
    // gets out of sync and the first character you type appears on
    // the wrong row. (But the root post is always full size.)
    if (typeof CodeMirror !== 'undefined' && isRootPost) {
      codeMirrorEditor = CodeMirror.fromTextArea(
          $editPanel.children('textarea')[0], {
        lineNumbers: true, //isRootPost,
        lineWrapping: true,
        mode: "text/html", // for now
        tabMode: "indent"
      });
    }

    // Always activate the editor on mouse/touch clicks on the tab.
    // — However if the user navigates using the keyboard, s/he might
    // not want to start editing, but only view the source text.
    // Then it's annoying if the editor grabs focus. So, if this is
    // a keyboard click, we require another Enter click, before we
    // focus the editor (see the next code paragraph.)
    // — Oddly enough, keyboard Enter click generates a click event
    // with event.which set to 1, i.e. mouse button 1. Weird.
    // So use `mouseup' instead of `click.'
    // — Don't use mousedown though — because then we'd focus the editor
    // *before* jQuery UI gives focus to the tab link (which seems to
    // happen on mouse*up* when the click is over).
    // — I guess all this doesn't really matter for touch devices.
    $editTabLink.mouseup(function(event, ui) {
      focusEditor();
    });

    // Enter the editor, if the editor *panel* is shown and
    // the user clicks Enter on the editor *tab link*.
    $editTabLink.keydown(function(event) {
      if (event.which !== $.ui.keyCode.ENTER) return;
      if ($editTabs.tabs('option', 'selected') !== d.i.EditTabIdEdit) {
        // Only activate the editor if the user clicks when the panel is
        // already  visible. Instead, let jQuery UI handle the click
        // — it will show the edit panel.
        return;
      }
      focusEditor();
    });

    function focusEditor() {
      // jQuery UI shows the panel on Enter click — but right now,
      // the edit panel *might* not yet be visible. If it is not,
      // the editor cannot be given focus right now.
      setTimeout(function() {
        // Now (later) the editor panel should be visible.
        if (codeMirrorEditor) {
          codeMirrorEditor.refresh();
          codeMirrorEditor.focus();
        }
        else $editPanel.find('textarea').focus();
      }, 0);
    }

    // Sometimes we'll make the panels at least as tall as
    // the post itself (below). But not large enough to push the
    // Submit/Cancel buttons of screen, if editing the root post
    // and the page title is visible (at the top of the page).
    var approxTitleAndBtnsHeight = 260; // page title + tabs + submit buttons
    var maxPanelHeight = Math.max(
        140, $(window).height() - approxTitleAndBtnsHeight);
    var minPanelHeight = Math.max(140, $postBody.height() + 60);
    if (minPanelHeight > maxPanelHeight) minPanelHeight = maxPanelHeight;

    // Place the edit/diff/preview tabs below the content, close to the Submit
    // button. Otherwise people (my father) tend not to notice the tabs,
    // if the edit form is tall (then there'd be lots of space & text
    // between the tabs and the submit & cancel button).
    // Clearfix the tabs, because .dw-p-bd makes the preview tab float left.
    $editTabs.addClass('dw-ui-tabs-bottom ui-helper-clearfix').tabs({
      selected: d.i.EditTabIdEdit,
      show: function(event, ui) {
        // Sync the edit panel <textarea> with any codeMirrorEditor,
        // so the diff and preview tabs will work correctly.
        if (codeMirrorEditor) codeMirrorEditor.save();

        // Update the tab to be shown.
        var $panel = $(ui.panel);
        switch (ui.panel.id) {
          case $editPanel.attr('id'):
            $editTabLink.focus();
            break;
          case $diffPanel.attr('id'):
            $diffTabLink.focus();
            $(this).each($updateEditFormDiff);
            break;
          case $previewPanel.attr('id'):
            $previewTabLink.focus();
            $(this).each($updateEditFormPreview);
            enableSubmitBtn();
            break;
          default: die('[error DwE4krERS]');
        };

        // Resize the root post dynamically, fix size of other posts.
        // Then e.g. CodeMirror can make the root post editor taller
        // dynamically, and the preview panel adjusts its size.
        $panel.height('auto');

        // But don't push the Submit/Cancel buttons of screen.
        $panel.css('max-height', maxPanelHeight +'px');

        // If CodeMirror isn't enabled and thus auto-resize the <textarea>,
        // then resize it manually, so it's as tall as the other panels.
        // {{{ Also don't shrink any panel
        // because: (and old comment of mine follows)
        //  "Don't reduce the form heigt, because if the form is at the
        //  very bottom of the screen, everything would jump downwards
        //  when the browser window shrinks."
        //  [[later: Jump downwards, and vanish outside the browser window?
        //  was that what happened?]]
        // And: (another old hard to understand comment)
        //  "jQuery UI shows the panels before the `show' event is triggered,
        //  so unless the other panels are resized *before* one of them is
        //  shown, that other panel might be smaller than the current one,
        //  causing the window to shrink and everything to jump downwards
        //  (if you're viewing the bottom of the page).
        //  So change the height of all panels — then they won't shrink
        //  later, when shown."  }}}
        if (!codeMirrorEditor) {
          if (minPanelHeight < $panel.height())
            minPanelHeight = $panel.height();
          else
            $panels.height(minPanelHeight);
        }
      }
    });

    // Prevent tab float drop.
    // If the $editForm is narrow, the tabs will float drop. Since they're
    // placed below the form, they'll actually float drop *upwards*, and
    // be hidden below the form. One way to avoid this, is making
    // the .tabs-nav very wide. (This is a stupid fix — it'll break
    // should you add perhaps two more tabs.)
    var $tabsNav = $editTabs.children('.ui-tabs-nav');
    $tabsNav.css('min-width', '300px');

    // Flip rounded corner placement — because tabs placed below contents.
    // (See jqueryui.com/demos/tabs/#bottom)
    $tabsNav.children().andSelf()
        .removeClass('ui-corner-all ui-corner-top')
        .addClass('ui-corner-bottom');

    // Show help info.
    // It might not be obvious that you can scroll down and click a Save
    // button. (Neither my mom nor dad found it! when it was off screen.)
    // For now, simply write a tips if it perhaps is off screen.
    if ($editForm.height() > 650)
      $editForm.children('.dw-f-e-inf-save').show();

    // When clicking the Save button, open a login dialog, unless logged in.
    $submitBtn.each($loginSubmitOnClick(function(event, userName) {
      var text = userName ?  'Save as '+ userName : 'Save as ...';  // i18n
      $(this).val(text);
    }));

    // Redraw SVG arrows, since the edit form is larger than the post.
    $post.each(SVG.$drawParents);

    // Ajax-post edit on submit, and update the page with all recent changes.
    $editForm.submit(function() {
      // Ensure any text edited with CodeMirror gets submitted.
      if (codeMirrorEditor) codeMirrorEditor.save();

      $.post('?edit='+ postId +'&view='+ rootPostId, $editForm.serialize(),
          'html')
          .fail(showErrorEnableInputs($editForm))
          .done(function(newDebateHtml) {
        slideAwayRemove($editForm);
        // If the edit was a *suggestion* only, the post body has not been
        // changed. Unless we make it visible again, it'll remain hidden
        // because mergeChangesIntoPage() ignores it (since it hasn't changed).
        $postBody.show();
        d.i.mergeChangesIntoPage(newDebateHtml);
      });

      disableSubmittedForm($editForm);
      return false;
    });

    // Provide an interface to internal stuff.
    $editForm.data("dwEditFormInterface", {
      focusEditor: focusEditor
    });

    // Finally,
    d.i.activateShortcutReceiver($editForm);
    focusEditor();
    scrollPostIntoView();
  });
}

// Call on a .dw-f-e, to update the diff tab.
function $updateEditFormDiff() {
  // Find the closest post
  var $editForm = $(this).closest('.dw-f-e');
  var $editTab = $(this).find('div.dw-e-tab[id^="dw-e-tab-edit"]');
  var $diffTab = $(this).find('div.dw-e-tab[id^="dw-e-tab-diff"]');
  var $textarea = $editTab.find('textarea');

  // Find the current draft text, and the old post text.
  var newSrc = $textarea.val();
  var oldSrc = $editForm.data('dw-e-src-old');

  // Run new diff.
  var diff = diffMatchPatch.diff_main(oldSrc, newSrc);
  diffMatchPatch.diff_cleanupSemantic(diff);
  var htmlString = prettyHtmlFor(diff);
  // Remove any old diff.
  $diffTab.children('.dw-p-diff').remove();
  // Show the new diff.
  $diffTab.append('<div class="dw-p-diff">'+ htmlString +'</div>\n');
}

// Call on a .dw-f-e, to update the preview tab.
function $updateEditFormPreview() {
  var $i = $(this);
  var $editForm = $i.closest('.dw-f-e');
  var $editTab = $editForm.find('div.dw-e-tab[id^="dw-e-tab-edit"]');
  var $previewTab = $editForm.find('div.dw-e-tab[id^="dw-e-tab-prvw"]');
  var $textarea = $editTab.find('textarea');
  var $selectedMarkup =
    $editForm.find('select[name="dw-fi-e-mup"] > option:selected');
  var markupType = $selectedMarkup.val();
  var markupSrc = $textarea.val();
  var htmlSafe = '';
  var $post = $i.closest('.dw-p');
  var isForTitle = $post.is('.dw-p-ttl');
  var sanitizerOptions = {
    allowClassAndIdAttr: $post.dwIsArticlePost(),
    allowDataAttr: $post.dwIsArticlePost()
  };

  switch (markupType) {
    case "para":
      // Convert to paragraphs, but for now simply show a <pre> instead.
      // The Scala implementation changes \n\n to <p>...</p> and \n to <br>.
      htmlSafe = $(isForTitle ? '<h1></h1>' : '<pre></pre>').text(markupSrc);
      break;
    case "dmd0":
      // Debiki flavored Markdown version 0.
      if (isForTitle) markupSrc = '<h1>'+ markupSrc +'</h1>';
      var hostAndPort = location.origin.replace(/https?:\/\//, '');
      htmlSafe = markdownToSafeHtml(markupSrc, hostAndPort, sanitizerOptions);
      break;
    case "code":
      // (No one should use this markup for titles, insert no <h1>.)
      htmlSafe = $('<pre class="prettyprint"></pre>').text(markupSrc);
      break;
    case "html":
      if (isForTitle) markupSrc = '<h1>'+ markupSrc +'</h1>';
      htmlSafe = sanitizeHtml(markupSrc, sanitizerOptions);
      break;
    default:
      die("Unknown markup [error DwE0k3w25]");
  }

  $previewTab.children('.dw-p-bd-blk').html(htmlSafe);
}


// ------- Edit suggestions and history

function $showEditsDialog() {
  var $thread = $(this).closest('.dw-t');
  var $post = $thread.children('.dw-p');
  var $postBody = $post.children('.dw-p-bd');
  var postId = $post.dwPostId();

  $.get('?viewedits='+ postId +'&view='+ rootPostId, 'text')
      .fail(showServerResponseDialog)
      .done(function(editsHtml) {
    var $editDlg = $(editsHtml).filter('form#dw-e-sgs'); // filter out text node
    var buttons = {
      Cancel: function() {
        $(this).dialog('close');
      }
    };
    if ($editDlg.is('.dw-e-sgs-may-edit')) buttons.Save = function() {
      // COULD show "Saving..." dialog and close when done.
      // Otherwise the new html might arrive when the user has started
      // doing something else.
      $(this).submit().dialog('close');
    };
    $editDlg.dialog($.extend({}, d.i.jQueryDialogDefault, {
      width: 1000,
      height: 600,
      buttons: buttons,
      close: function() {
        // Need to remove() this, so ids won't clash should a new form
        // be loaded later.
        $(this).remove();
      }
    }));

    initSuggestions($editDlg); // later:? .find('#dw-e-tb-sgs'));
    // For now, open directly, discard on close and
    // load a new one, if "Edit" clicked again later.
    $editDlg.dialog('open');

    // Don't focus the first checkbox input — jQuery UI's focus color makes
    // it impossible to tell whether it has focus only, or if it's actually
    // selected. TODO change jQuery UI's focus colors — the Theme Roller,
    // change the Clickable: hover state.
    // (By default, jQuery UI focuses the :first:tabbable element in the
    // .ui-dialog-content, rather than the .ui-dialog-buttonpane.)
    $editDlg.parent().find('.ui-dialog-buttonpane :tabbable:first').focus();
  });

  var appdelSeqNo = 0;

  function initSuggestions($form) {
    // Update diff and preview, when hovering a suggestion.
    $form.find('li.dw-e-sg').mouseenter(function() {
      // Compute the text of the post as of when this edit
      // was *suggested*. This shows the *intentions* of the one
      // who suggested the changes.
      // COULD also show the results of applying the patch to
      // the current text (as of now).
      // - When hovering the edit <li>, show the intentions.
      // - But when hovering the Apply/Undo button, show the results
      //   of applying/undoing.
      // - Add tabs at the top of the edit, which one can click,
      //   to decide which diff to show.
      var suggestionDate = $(this).find('.dw-e-sg-dt').attr('title');
      var curSrc = textAsOf(suggestionDate);
      var patchText = $(this).find('.dw-e-text').text();

      // Make a nice html diff.
      // (I don't know how to convert patches to diffs, without
      // actually applying the patch first, and calling diff_main.)
      var patches = diffMatchPatch.patch_fromText(patchText);
      // COULD check [1, 2, 3, …] to find out if the patch applied
      // cleanaly. (The result is in [0].)
      var newSrc = diffMatchPatch.patch_apply(patches, curSrc)[0];
      var diff = diffMatchPatch.diff_main(curSrc, newSrc); // <- how to avoid?
      diffMatchPatch.diff_cleanupSemantic(diff);
      var diffHtml = prettyHtmlFor(diff);

      // Remove any old diff and show the new one.
      var $diff = $form.find('#dw-e-sgs-diff-text');
      $diff.children('.dw-x-diff').remove();
      $diff.append('<div class="dw-x-diff">'+ diffHtml +'</div>\n');
      // Update the preview.
      // COULD make this work with other types of markdown than `dmd0'.
      // See $updateEditFormPreview(), which handles other markup types.
      var html = markdownToSafeHtml(newSrc);
      $form.find('#dw-e-sgs-prvw-html').html(html);
    });

    // Applies all edits up to, but not including, the specified date.
    // Returns the resulting text.
    // Keep in sync with textAsOf in debate.scala (renamed to page.scala?).
    // SHOULD find the markup type in use too. Would require that the
    // markup type be sent by the server.
    // TODO also consider edit suggestions marked for application.
    // TODO consider skipping edit-apps marked for undo.
    // TODO when showing the changes *intended*, take into account
    // edit appls that were not deleted at the point in time when the
    // suggestion was made (but perhaps were deleted later)
    // (Otherwise, if [some patch that was in effect when the suggestion
    // was made] has been reverted, it might not be possible to understand
    // the intention of the patch.)
    function textAsOf(dateIso8601) {
      // The edit apps should already be sorted: most recent first,
      // see html.scala.
      var eapps = $form.find('#dw-e-sgs-applied li').filter(function() {
        var eappDate = $(this).find('.dw-e-ap-dt').attr('title');
        return eappDate < dateIso8601;
      });
      var origText = $form.find('#dw-e-sgs-org-src').text();
      var curText = origText;
      eapps.each(function() {
        var patchText = $(this).find('.dw-e-text').text();
        var patches = diffMatchPatch.patch_fromText(patchText);
        // COULD check [1, 2, 3, …] to find out if the patch applied
        // cleanaly. (The result is in [0].)
        var newText = diffMatchPatch.patch_apply(patches, curText)[0];
        curText = newText;
      });
      return curText;
    }

    $form.find('input').button().click(function() {
      // Update a sequence number at the start of the input value,
      // e.g. change '10-delete-r0m84610qy' to '15-delete-r0m84610qy'.
      var v = $(this).val();
      appdelSeqNo += 1;
      var v2 = v.replace(/^\d*-/, appdelSeqNo +'-');
      $(this).val(v2);
      // TODO update save-diff and preview.
    });

    $form.submit(function() {
      var postData = $form.serialize();
      $.post($form.attr('action'), postData, 'html')
          .fail(showServerResponseDialog)
          .done(function(recentChangesHtml) {
        d.i.mergeChangesIntoPage(recentChangesHtml);
        $form.dialog('close');
      });
      return false;
    });
  }
}


// ------- Editing

// Invoke this function on a textarea or an edit suggestion.
// It hides the closest post text and shows a diff of the-text-of-the-post
// and $(this).val() or .text(). $removeEditDiff shows the post again.
function $showEditDiff() {
  // Find the closest post
  var $post = $(this).closest('.dw-t').children('.dw-p');
  var height = $post.height();
  // Remove any old diff
  var $oldDiff = $post.children('.dw-p-diff');
  $oldDiff.remove();
  // Extract the post's current text.
  var $postBody = $post.children('.dw-p-bd');
  var oldText = $postBody.map($htmlToMarkup)[0]; // TODO exclude inline threads
  // Try both val() and text() -- `this' might be a textarea or
  // an elem with text inside.
  var newText = $(this).val();
  if (newText === '') newText = $(this).text();
  newText = newText.trim() +'\n';  // $htmlToMarkup trims in this way
  // Run diff
  var diff = diffMatchPatch.diff_main(oldText, newText);
  diffMatchPatch.diff_cleanupSemantic(diff);
  var htmlString = prettyHtmlFor(diff);
  // Hide the post body, show the diff instead.
  $postBody.hide();
  $postBody.after('<div class="dw-p-diff">'+ htmlString +'</div>\n');
  // Fix the height of the post, so it won't change when showing
  // another diff, causing everything below to jump up/down.

  // For now, make it somewhat higher than its current height,
  // so there's room for <ins> elems.
  //$post.css('height', '');
  //$post.css('height', $post.height() + 50 +'px');
  //$post.height(height + ($oldDiff.length ? 0 : 75));
  $post.height(height);
  $post.css('overflow-y', 'auto');

  // COULD make inline comments point to marks in the diff.
}

// Removes any diff of the closest post; shows the post text instead.
function $removeEditDiff() {
  var $post = $(this).closest('.dw-t').children('.dw-p');
  $post.children('.dw-p-diff').remove();
  $post.children('.dw-p-bd').show();
  $post.css('overflow-y', 'hidden');
}

// Converts a google-diff-match-patch diff array into a pretty HTML report.
// Based on diff_match_patch.prototype.diff_prettyHtml(), here:
//  http://code.google.com/p/google-diff-match-patch/source/browse/
//    trunk/javascript/diff_match_patch_uncompressed.js
// @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
// @return {string} HTML representation.
function prettyHtmlFor(diffs) {
  var html = [];
  var x, i = 0;
  var pattern_amp = /&/g;
  var pattern_lt = /</g;
  var pattern_gt = />/g;
  var pattern_para = /\n/g;
  for (x = 0; x < diffs.length; x++) {
    var op = diffs[x][0];    // Operation (insert, delete, equal)
    var data = diffs[x][1];  // Text of change.
    var text = data.replace(pattern_amp, '&amp;').replace(pattern_lt, '&lt;')
        .replace(pattern_gt, '&gt;').replace(pattern_para, '¶<br />');
    switch (op) {
      case DIFF_INSERT:
        html[x] = '<ins>' + text + '</ins>';
        break;
      case DIFF_DELETE:
        html[x] = '<del>' + text + '</del>';
        break;
      case DIFF_EQUAL:
        html[x] = '<span>' + text + '</span>';
        break;
    }
    if (op !== DIFF_DELETE) {
      i += data.length;
    }
  }
  return html.join('');
}


// ------- Create page

// This is for the ?create-page (e.g. GET /some/folder/page?create-page).
// COULD REFACTOR: Export $loginSubmitOnClick, and place initCreateForm() in
// debiki-lift.js, so no ?create-page code is in here.
function initCreateForm() {
  var $submitBtn = $('form.dw-f-cr .dw-fi-submit');
  $submitBtn.button().each($loginSubmitOnClick(function(event, userName) {
    var text = userName ? 'Create as '+ userName : 'Create as ...';  // i18n
    $(this).val(text);
  }));
}


// ------- Utterscroll and Tooltips


function initUtterscroll() {
  bugIf(Modernizr.touch);
  // Activate Utterscroll, and show tips if people use the window scrollbars,
  // hide it on utterscroll.
  var hasUtterscrolled = false;
  var $utterscrollTips;
  debiki.Utterscroll.enable({
    scrollstoppers: '.CodeMirror,'+
        ' .ui-draggable, .ui-resizable-handle, .dw-p-hd',
    onMousedownOnWinHztlScrollbar: function() {
      if (hasUtterscrolled || $utterscrollTips)
        return;
      var $tips = $('#dw-tps-utterscroll');
      $tips.show()
          // Place tips in the middle of the viewport.
          // (The tips has position: fixed.)
          .css('top', ($(window).height() - $tips.height()) / 2)
          .css('left', ($(window).width() - $tips.width()) / 2)
          .click(function() { $tips.hide(); });
      $utterscrollTips = $tips;
    },
    onHasUtterscrolled: function() {
      hasUtterscrolled = true;
      if ($utterscrollTips) $utterscrollTips.hide();
    }
  });
}


function $makePostHeadTooltips() {  // i18n
  if (!$.fn.tooltip) return; // tooltips not loaded
  var $postHead = $(this);
  if ($postHead.find('[data-original-title]').length)
    return; // tooltips already added

  // Tooltips explaining '?' and '??' login type indicators.
  $postHead.find('.dw-lg-t-spl').each(function() {
    var tip;
    var $i = $(this);
    if ($i.text() == '??') {
      tip = '<b>??</b> means that the user has not logged in,'+
          ' so <i>anyone</i> can pretend to be this user&nbsp;(!),'+
          ' and not specified any email address.'
      // better?: does not receive email notifications.'
    }
    else if ($i.text() == '?') {
      tip = '<b>?</b> means that the user has not logged in,'+
          ' so <i>anyone</i> can pretend to be this user&nbsp;(!),'+
          ' but has specified an email address.'
        // and receives email notifications.'
    }
    else die();
    $i.tooltip({
      title: tip,
      placement: 'right' // or '?' cursor hides tooltip arrow
    });
  });
}



// ------- Initialization functions


function registerEventHandlersFireLoginOut() {
  $('#dw-a-login').click(showLoginSimple);
  $('#dw-a-logout').click(showLogout);

  // On post text click, open the inline action menu.
  // But hide it on mousedown, so the inline action menu disappears when you
  // start the 2nd click of a double click, and appears first when the 2nd
  // click is completed. Otherwise the inline menu gets in the
  // way when you double click to select whole words. (Or triple click to
  // select paragraphs.)
  $('.debiki').delegate('.dw-p-bd-blk', 'mouseup', $showInlineActionMenu)
      .delegate('.dw-p-bd-blk', 'mousedown', $hideInlineActionMenu);

  // Remove new-reply and rating forms on cancel, but 
  // the edit form has some own special logic.
  $('.debiki').delegate(
      '.dw-fs-re .dw-fi-cancel, ' +
      '.dw-fs-r .dw-fi-cancel',
      'click', $removeClosestForms);

  // Show the related inline reply, on inline mark click.
  $('.debiki').delegate('a.dw-i-m-start', 'click', $showInlineReply);

  // Add tooltips lazily.
  $('.debiki').delegate('.dw-p-hd', 'mouseenter', $makePostHeadTooltips);


  window.onbeforeunload = confirmClosePage;

  // Hide all action forms, since they will be slided in.
  $('#dw-hidden-templates .dw-fs').hide();

  // Show a change diff instead of the post text, when hovering an edit
  // suggestion.
  $('.debiki')
      .delegate('.dw-e-sg', 'mouseenter', function(){
        // COULD move find(...) to inside $showEditDiff?
        // (Don't want such logic placed down here.)
        $(this).find('.dw-e-text').each($showEditDiff);
      })
      .delegate('.dw-e-sgs', 'mouseleave', $removeEditDiff);

  initCreateForm();

  // Fire the dwEvLoggedInOut event, so all buttons etc will update
  // their text with the correct user name.
  // {{{ Details:
  // Firing the dwEvLoggedInOut event causes the user name to be updated
  // to the name of the logged in user, everywhere. This needs to be done
  // in JavaScript, cannot be done only server side — because when the user
  // logs in/out using JavaScript, and uses the browser's *back* button to
  // return to an earlier page, that page might not be fetched again
  // from the server, but this javascript code updates the page to take
  // into account that the user name (and related cookies) has changed
  // (since the user logged in/out).
  // Do this when everything has been inited, so all dwEvLoggedInOut event
  // listeners have been registered. }}}

  $('.dw-loginsubmit-on-click').click($loginThenSubmit);
  $('.dw-loginsubmit-on-mouseenter').mouseenter($loginThenSubmit);
  if (Me.isLoggedIn()) fireLogin();
  else fireLogout();

  // If the user switches browser tab, s/he might logout and login
  // in another tab. That'd invalidate all xsrf tokens on this page,
  // and user specific permissions and ratings info (for this tab).
  // Therefore, when the user switches back to this tab, check
  // if a new session has been started.
  $(window).on('focus', Me.fireLoginIfNewSession);
  //{{{ What will work w/ IE?
  // See http://stackoverflow.com/a/5556858/694469
  // But: "This script breaks down in IE(8) when you have a textarea on the
  // page.  When you click on the textarea, the document and window both
  // lose focus"
  //// IE EVENTS
  //$(document).bind('focusin', function(){
  //    alert('document focusin');
  //});
  //if (/*@cc_on!@*/false) { // check for Internet Explorer
  //  document.onfocusin = onFocus;
  //  document.onfocusout = onBlur;
  //} else {
  //  window.onfocus = onFocus;
  //  window.onblur = onBlur;
  //}
  //
  // http://stackoverflow.com/a/6184276/694469
  //window.addEventListener('focus', function() {
  //  document.title = 'focused';
  //});
  //window.addEventListener('blur', function() {
  //    document.title = 'not focused';
  //});
  //}}}
}


function initAndDrawSvg() {
  // Don't draw SVG until all html tags has been placed, or the SVG
  // arrows might be offset incorrectly.
  // Actually, drawing SVG takes long, so wait for a while,
  // don't do it on page load.
  SVG.initRootSvg();
  SVG.drawEverything();
}


// ------- Actually render the page

// Render the page step by step, to reduce page loading time. (When the first
// step is done, the user should conceive the page as mostly loaded.)

function renderPageEtc() {
  var $posts = $('.debiki .dw-p:not(.dw-p-ttl)');
  function initPostsThreadStep1() {
    $posts.each($initPostsThreadStep1);
    $('html').removeClass('dw-render-actions-pending');
  }
  function initPostsThreadStep2() { $posts.each($initPostsThreadStep2) }
  function initPostsThreadStep3() { $posts.each($initPostsThreadStep3) }
  function initPostsThreadStep4() { $posts.each($initPostsThreadStep4) }

  (d.u.workAroundAndroidZoomBug || function() {})($);

  // IE 6, 7 and 8 specific elems (e.g. upgrade-to-newer-browser info)
  // (Could do this on the server instead, that'd work also with Javascript
  // disabled. But people who know what javascript is and disable it,
  // probably don't use IE 6 and 7? So this'll be fine for now.)
  var $body =  $('body');
  if ($.browser.msie) {
    if ($.browser.version < '8') $body.addClass('dw-ua-lte-ie7');
    if ($.browser.version < '9') $body.addClass('dw-ua-lte-ie8');
  }

  Me.refreshProps();

  // When you zoom in or out, the width of the root thread might change
  // a few pixels — then its parent should be resized so the root
  // thread fits inside with no float drop.
  d.u.zoomListeners.push(resizeRootThread);

  var steps = [];
  steps.push(initPostsThreadStep1);
  steps.push(initPostsThreadStep2);
  steps.push(initPostsThreadStep3);
  // COULD fire login earlier; it's confusing that the 'Login' link
  // is visible for rather long, when you load a *huge* page.
  steps.push(registerEventHandlersFireLoginOut);
  steps.push(initPostsThreadStep4);
  steps.push(initAndDrawSvg);
  steps.push(scrollToUrlAnchorPost);
  // Resize the article, now when the page has been rendered, and all inline
  // threads have been placed and can be taken into account.
  steps.push(function() {
    resizeRootThread();
    $('html').removeClass('dw-render-layout-pending');
    debiki.scriptLoad.resolve();
  });
  if (!Modernizr.touch) steps.push(function() {
    d.i.initKeybdShortcuts($);
    initUtterscroll();
  });

  function runNextStep() {
    steps[0]();
    steps.shift();
    if (steps.length > 0)
      setTimeout(runNextStep, 70);
  }

  setTimeout(runNextStep, 60);
}


// Export stuff.
d.i.$initPostsThread = $initPostsThread;
d.i.$initPost = $initPost;
d.i.$loginThenSubmit = $loginThenSubmit;
d.i.$loginSubmitOnClick = $loginSubmitOnClick;
d.i.$showActions = $showActions;
d.i.$undoInlineThreads = $undoInlineThreads;
d.i.DEBIKI_TABINDEX_DIALOG_MAX = DEBIKI_TABINDEX_DIALOG_MAX;
d.i.disableSubmittedForm = disableSubmittedForm;
d.i.markMyPost = markMyPost;
d.i.Me = Me;
d.i.resizeRootThreadExtraWide = resizeRootThreadExtraWide;
d.i.resizeRootThreadNowAndLater = resizeRootThreadNowAndLater;
d.i.SVG = SVG;
d.i.removeInstantly = removeInstantly;
d.i.rootPostId = rootPostId;
d.i.showAndHighlightPost = showAndHighlightPost;
d.i.showErrorEnableInputs = showErrorEnableInputs;
d.i.showMyRatings = showMyRatings;
d.i.showServerResponseDialog = showServerResponseDialog;
d.i.slideInActionForm = slideInActionForm;
d.i.slideAwayRemove = slideAwayRemove;


// Dont render page, if there is no root post, or some error happens,
// which kills other Javascript that runs on page load.
if (rootPostId) renderPageEtc();


//----------------------------------------
   }); // end jQuery onload
//----------------------------------------
//========================================
   }()); // end Debiki module
//========================================


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
