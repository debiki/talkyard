// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

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

}}}*/

Debiki = {};  // TODO: Error handling?
Debiki.v0 = {};

//========================================
   (function(){
//========================================
"use strict";

var UNTESTED; // Indicates that a piece of code has not been tested.

//----------------------------------------
//  Helpers
//----------------------------------------

function trunc(number) {
  return number << 0;  // bitwise operations convert to integer
}

function isBlank(str) {
  return !str || !/\S/.test(str);
  // (!/\S/ is supposedly much faster than /^\s*$/,
  // see http://zipalong.com/blog/?p=287)
}

// Converts markdown to sanitized html.
function markdownToSafeHtml(markdownSrc, hostAndPort) {
  function urlX(url) {
    if (/^https?:\/\//.test(url)) { return url; }
  }
  function idX(id) {
    return id;
  }

  var converter = new Showdown.converter();
  var htmlTextUnsafe = converter.makeHtml(markdownSrc, hostAndPort);
  var htmlTextSafe = html_sanitize(htmlTextUnsafe, urlX, idX);
  return htmlTextSafe;
}

//----------------------------------------
// jQuery object extensions
//----------------------------------------

jQuery.fn.dwDisable = function() {
  return this.each(function(){ jQuery(this).prop('disabled', true); });
};

jQuery.fn.dwEnable = function() {
  return this.each(function(){ jQuery(this).prop('disabled', false); });
};

jQuery.fn.dwLastChange = function() {
  var maxDate = '0';
  this.children('.dw-p-hdr').find('.dw-date').each(function(){
    var date = jQuery(this).attr('title'); // creation or last modification date
    if (date > maxDate)
      maxDate = date;
  });
  return maxDate;
};

// The user id of the author of a post.
jQuery.fn.dwAuthorId = function() {
  var uid = this.find('> .dw-p-hdr > .dw-p-by').attr('data-dw-u-id');
  return uid;
};

//----------------------------------------
// Customizable functions: Default implementations
//----------------------------------------

var Settings = {};

Settings.makeEditUrl = function(debateId, postId) {
  // Default:
  return debateId +'/edits/proposed/post/'+ postId +'.html';
};

Settings.makeRatePostUrl = function(debateId, postId) {
  // Default:
  // (Firefox doesn't accept an Ajax post request "" (i.e. the same page);
  // nsIXMLHttpRequest.open fails with NS_ERROR_ILLEGAL_VALUE.)
  return '?';
};

Settings.makeReplyUrl = function(debateId, postId) {
  return '?';
};

Settings.replyFormLoader = function(debateId, postId, complete) {
  // Simply clone a hidden reply form template.
  var $replyForm = jQuery('#dw-hidden-templates .dw-fs-re').clone(true);
  complete($replyForm);
};

Settings.replyFormSubmitter = function(debateId, postId, complete) {
  // This worked with JSPWiki:
  // $.post(Settings.makeReplyUrl(debateId, postId),
  //    $replyForm.children('form').serialize(), complete, 'html');
  // By default, post no reply.
  alert("Cannot post reply. [debiki_error_85ei23rnir]");
};

Settings.editFormLoader = function(debateId, postId, complete) {
  alert('Edits not implemented. [debiki_error_239sx8]');
};

Settings.editFormSubmitter = function(debateId, postId, complete) {
  // This worked with JSPWiki:
  // $.post(Settings.makeReplyUrl(debateId, postId),
  //    $replyForm.children('form').serialize(), complete, 'html');
  // By default, post no reply.
  alert("Edits not implemented. [debiki_error_19x3g35]");
};

Settings.draggableInternal =
    '.dw-res, .dw-i-ts, .dw-t, .dw-t-vspace, '+
    '.dw-p, .dw-p-bdy, .dw-hor-a, .dw-fs, '+
    '.dw-debate, .dw-debate svg, path, '; // (draggableCustom appended)
Settings.draggableCustom = '';

//----------------------------------------
// Customizable functions: Export setters
//----------------------------------------

// A function that builds the GET line to download edit suggestions
// for a certain post.
Debiki.v0.setEditUrl = function(urlBuilder) {
  Settings.makeEditUrl = urlBuilder;
};

Debiki.v0.setRatePostUrl = function(urlBuilder) {
  Settings.makeRatePostUrl = urlBuilder;
};

Debiki.v0.setReplyUrl = function(urlBuilder) {
  Settings.makeReplyUrl = urlBuilder;
};

Debiki.v0.setReplyFormLoader = function(loader) {
  Settings.replyFormLoader = loader;
};

Debiki.v0.setReplyFormSubmitter = function(submitter) {
  Settings.replyFormSubmitter = submitter;
};

Debiki.v0.setEditFormLoader = function(loader) {
  Settings.editFormLoader = loader;
};

Debiki.v0.setEditFormSubmitter = function(submitter) {
  Settings.editFormSubmitter = submitter;
};

Debiki.v0.makeDragscrollable = function(selectors) {
  Settings.draggableCustom = selectors;
};

// Onload
//----------------------------------------
   jQuery.noConflict()(function($){
//----------------------------------------

// ------- Variables

var diffMatchPatch = new diff_match_patch();
diffMatchPatch.Diff_Timeout = 1; // seconds
diffMatchPatch.Match_Distance = 100*1000; // for now

var didResize = false;
// Set to true if a truncated post was clicked and expanded.
var didExpandTruncated = false;
var rateFormTemplate = $("#dw-hidden-templates .dw-fs-rat");
var debateId = $('.debiki').attr('id');
// When forms are loaded from the server, they might have ID fields.
// If the same form is loaded twice (e.g. to reply twice to the same comment),
// their ids would clash. So their ids are made unique by appending a form no.
var idSuffixSequence = 0;

var $lastInlineMenu = $();

// Remembers which .dw-login-on-click button (e.g. "Post as...")
// was clicked when a login dialog is shown.
var loginOnClickBtnClicked = null;

// Reset all per click state variables when a new click starts.
$.event.add(document, "mousedown", function() {
  didExpandTruncated = false;
  //didResize = false; -- currently handled in another mousedown
});

// SVG Web's Flash renderer won't do; we need native browser support,
// or we'll use images instead of SVG graphics.
var nativeSvgSupport =
    window.svgweb && window.svgweb.getHandlerType() === 'native';

var SVG = nativeSvgSupport && document.URL.indexOf('svg=false') === -1 ?
    makeSvgDrawer() : makeFakeDrawer();

var Me = makeCurUser();


// ------- Zoom event

var zoomListeners = [];

(function(){
  // Poll the pixel width of the window; invoke zoom listeners
  // if the width has been changed.
  var lastWidth = 0;
  function pollZoomFireEvent() {
    var i;
    var widthNow = jQuery(window).width();
    if (lastWidth === widthNow) return;
    lastWidth = widthNow;
    // Length changed, user must have zoomed, invoke listeners.
    for (i = zoomListeners.length - 1; i >= 0; --i) {
      zoomListeners[i]();
    }
  }
  setInterval(pollZoomFireEvent, 100);
}());


// ------- Open/close

function $threadOpen() {
  // In case the thread will be wider than the summary, prevent float drop.
  resizeRootThreadExtraWide();
  // Replace the summary line with the thread, and slide it in.
  var $summary = $(this);
  var $thread = $summary.data('dw_$thread');
  $summary.removeData('dw_$thread').each($slideUp).queue(function() {
    // Need to dequeue() the thread. Why? Perhaps jQuery suspends
    // animations when an elem is detach()ed?
    $thread.replaceAll($summary).each($slideDown).dequeue();
  });
}

function $threadClose() {
  // Slide the thread away and replace it with a summary line. This summary
  // line is a copy of the thread's <li>, emptied. Then the summary
  // line will keep the position and ID and css classes of the actual thread.
  var $thread = $(this).closest('.dw-t');
  var postCount = $thread.find('.dw-p').length;
  var $summary = $thread.clone().empty()
      .append($('<span class="dw-z-open">[+] Click to show '+  // COULD add i18n
          postCount +' posts</span>'))
      .click($threadOpen);
  $thread.each($slideUp).queue(function() {
    $thread.before($summary).detach();
    $summary.data('dw_$thread', $thread)
        .each($makeEastResizable)
        .each($slideDown);
  });
}


// ------- Outlining

// Outline new posts
/*
(function(){
  var myLastVersion = $.cookie('myLastPageVersion'); // cookie no longer exists
  if (!myLastVersion) return;
  var newPosts = posts.filter(function(index){ // BUG?…
    //… relied on posts = $('.debiki .dw-p-bdy') but use '*.dw-p' instead?
    return $(this).dwLastChange() > myLastVersion;
  })
  newPosts.closest('.dw-t').addClass('dw-m-t-new');
  // TODO: sometimes .dw-m-p-edited instead of -new
})()
*/


// ------- Resizing

// Makes the root thread wide enough to contain all its child posts.
// Is this not done e.g. when child posts are resized or stacked eastwards,
// or a reply/rate/edit form is shown/resized, the east-most threads
// will float-drop below the other threads.
function resizeRootThreadImpl(extraWidth) {
  if (extraWidth === true) extraWidth = 1000; // 3 x reply/edit form width
  else {
    // If a user drag-resizes a form quicker than this amount of pixels
    // per browser refresh, div-drop might happen anyway, because
    // this function isn't invoked until after the
    // browser has decided to float-drop the divs?
    // Also, zooming in/out might cause float drop (it seems all elems
    // aren't scaled exactly in the same way), if too small.
    // Hence it's a rather wide value. (Otherwise = 50 would do.)
    extraWidth = 200;
  }
  var width = 0;
  var $root = $('.dw-depth-0');
  if (!$root.length) $root = $('.dw-debate'); // there's no root reply
  $root.find('> .dw-res > li, > .dw-fs, > .dw-a').each(function(){
    width += $(this).outerWidth(true);
  });

  var maxInlineWidth = $root.map($findMaxInlineWidth)[0];
  width = Math.max(width, maxInlineWidth);
  width += extraWidth;

  // Set the min width to something wider than the max width of a
  // .dw-p-bdy <p>, so paragaphs won't expand when child threads or
  // reply forms are added below the root post.
  // TODO: Use e.g. http://www.bramstein.com/projects/jsizes/ to find the
  // max-width of a .dw-p-bdy p. Or specify the <p> max width in px:s not em:s.
  // Or use http://jquery.lukelutman.com/plugins/px/jquery.px.js, mentioned
  // here: http://www.mail-archive.com/jquery-en@googlegroups.com/msg13257.html.
  width = Math.max(width, 650); // today <p> max-width is 50 em and 650 fine
  $root.css('min-width', width +'px');
}

// Finds the width of the widest [paragraph plus inline threads].
function $findMaxInlineWidth() {
  var accWidth = 0;
  var maxWidth = 0;
  $(this).find('> .dw-p > .dw-p-bdy').children(':not(svg)').each(function(){
    if ($(this).filter('.dw-p-bdy-blk').length) {
      // New block, reset width
      accWidth = 0;
    }
    // This elem floats-left to the right of the previous block.
    accWidth += $(this).outerWidth(true);
    if (accWidth > maxWidth) maxWidth = accWidth;
  });
  return maxWidth;
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

// Make posts and threads resizable.
// Currently not in use, except for when I test to resize posts.
//   $('.dw-p').each($makePostResizable);
// Fails with a TypeError on Android: Cathching it and ignoring it.
// (On Android, posts and threads won't be resizable.)
function $makePostResizable() {
  var arrowsRedrawn = false;
  function drawArrows(where) {
    if (arrowsRedrawn) return;
    SVG.$drawParentsAndTree.apply(where);
    arrowsRedrawn = true;
  }
  var $expandSouth = function() {
    // Expand post southwards on resize handle click. But not if
    // the resize handle was dragged and the post thus manually resized.
    if (didResize) return;
    $(this).closest('.dw-p')
        .css('height', '').removeClass('dw-p-rez-s');
    drawArrows(this);
  };
  var $expandEast = function() {
    // Expand post eastwards on resize east handle click.
    if (didResize) return;
    $(this).closest('.dw-p')
        .css('width', '').removeClass('dw-p-rez-e');
    drawArrows(this);
  };
  var $expandSouthEast = function() {
    $expandSouth.apply(this);
    $expandEast.apply(this);
  };

  try {
  // Indicate which posts are cropped, and make visible on click.
  $(this)
    .filter('.dw-x-s')
    .append(
      '<div class="dw-x-mark">. . . truncated</div>')
    // Expand truncated posts on click.
    .click(function(){
      if ($(this).filter('.dw-x-s').length > 0) {
        // This post is truncated (because it is rather long).
        if (didExpandTruncated) {
          // Some other nested post (an inline comment thread?) has already
          // handled this click, and expanded itself. Ignore click.
          // SHOULD let the outer thread consume the first click. Hardly
          // matters though, since nested posts are rarely visible when the
          // parent post is cropped.
        }
        else {
          $(this).removeClass('dw-x-s')
              .children('.dw-x-mark').remove();
          didExpandTruncated = true;
          $(this).closest('.dw-t').each(SVG.$drawParentsAndTree);
        }
      }
    })
  .end()
  .resizable({  // TODO don't make non-root-thread inline posts resizable-e.
      autoHide: true,
      start: function(event, ui) {
        // Remember that this post is being resized, so heigh and width
        // are not removed on mouse up.
        didResize = true;
      },
      resize: function(event, ui) {
        $(this).closest('.dw-t').each(SVG.$drawParentsAndTree);
      },
      stop: function(event, ui) {
        // Add classes that draw east and south borders, so one can tell
        // from looking at the post that its size has been fixed by the user.
        $(this).closest('.dw-p').addClass('dw-p-rez-e dw-p-rez-s');
      }
     })
  .find('.ui-resizable-se')
    // Make the resize grip larger.
    .removeClass('.ui-icon-gripsmall-diagonal-se')  // exchange small grip...
    .addClass('ui-icon-grip-diagonal-se')  // ...against the normal one
  .end()
  // Expand east/south/southeast on east/south/southeast resize handle
  // *clicks*, by removing height and width restrictions on mouse *up* on
  // resize handles.  (These triggers are shortcuts to reveal the whole post
  // - only triggered if *clicking* the resize handle, but not dragging it.)
  .find('.ui-resizable-e').mouseup($expandEast).end()
  .find('.ui-resizable-s').mouseup($expandSouth).end()
  .find('.ui-resizable-se').mouseup($expandSouthEast).end()
  .find('.ui-resizable-handle')
    .mousedown(function(){
      arrowsRedrawn = false;
      didResize = false;
    })
  .end();
  }
  catch (e) {
    if (e.name === 'TypeError') console.log(e.name +': Failed to make '+
        'post resizable. Ignoring error (this is a smartphone?)');
    else throw e;
  }
}

// ------- Update

// Finds new/updated versions of posts/edits in newDebateHtml,
// adds them / replaces [the currently displayed but out-of-date versions].
// Highlights the changes done.
// Does not reorder elems currently shown (even if their likeability have
// changed significantly), to avoid surprising the user (by
// shuffling everything around).
// {{{ COULD include SHA1:s of each thread, and avoid reloading threads whose
// SHA1 is the same in the server's reply. The server need not upload
// those threads at all — that would require the server to generate
// unique replies to each client.
// The server COULD check SHA1:s from the client, and find all threads
// that has been changed (since the client got its version), and add
// all those threads in an <ul> and upload it. The client would then
// replace threads with the never versions in the <ul> — but keeping old
// subtrees whose SHA1 hadn't been changed.
// The server COULD include a <del data-what='thread-id, thread-id, ...'></del>
// but perhaps not needed — [the parent of each deleted thread] will have
// a new SHA1 and it'll be reloaded automatically.
// }}}
function updateDebate(newDebateHtml) {
  // Need to rewrite:
  // 1. Find all new **threads** (ancestors only, don't count subthreads
  //    of new threads).
  // X. Find all recently deleted posts. Threads?! Could ignore for now?
  //    only delete threads on reload?
  // 2. Find all old edited posts.
  // 3. Find all old posts that the user has just rated.
  // 4. Init all new threads. Redraw exactly all SVG arrows?
  //    Or $drawTree for each new thread, and find the union of all
  //    their ancestor threads and redraw them.
  // Y. Also find new flags. (Could ignore for now, only show new flags
  //    on complete reload.)
  // 5. Mark edits, mark own ratings.
  var $curDebate = $('.dw-debate');
  var $newDebate = buildTagFind(newDebateHtml, '.dw-debate');
  $newDebate.find('.dw-t').each(function(){
      var $i = $(this);
      var parentId = $i.parents('.dw-t').attr('id');
      var $oldParent = parentId ? $curDebate.find('#'+ parentId) : $curDebate;
      var $oldThis = $curDebate.find('#'+ this.id);
      var isNewThread = $oldThis.length === 0;
      var isSubThread = !$oldParent.length;  // BUG, $oldParent might be a
      // recently added *new* thread, but if this is a sub thread of another
      // *new* thread, isSubThread should be true.
      // Effect: new sub threads aren't inited properly it seems, or inits
      // their parents many times.
      var isInline = $i.filter('.dw-i-t').length === 1;
      var $oldPost = $oldThis.children('.dw-p');
      var $newPost = $i.children('.dw-p');
      var oldDate = $oldPost.dwLastChange();
      var newDate = $newPost.dwLastChange();
      var isPostEdited = !isNewThread && newDate > oldDate;
      var oldRatsModTime =
          $oldPost.find('> .dw-p-hdr > .dw-p-ra-all').attr('data-mtime');
      var newRatsModTime =
          $newPost.find('> .dw-p-hdr > .dw-p-ra-all').attr('data-mtime');
      var hasNewRatings =
          (!oldRatsModTime ^ !newRatsModTime) ||
          (newRatsModTime > oldRatsModTime);
      if (isPostEdited) {
        $newPost
          .replaceAll($oldPost)
          .addClass('dw-m-p-edited'); // outlines it
        // BUG? New/edited child posts aren't added? Can't simply replace
        // them with newer versions — what would then happen if the user
        // has opened an edit form for those posts?
        $newPost.each($initPost);
      }
      else if (isNewThread && !isSubThread) {
        // (A thread that *is* a sub-thread of another new thread, is added
        // automatically when that other new thread is added.)
        // BUG: isSubThread might be false, although the thread is a sub
        // thread of a new thread. So below code is sometimes (depending on
        // which thread is first found) incorrectly run
        // on sub threads.
        var $res = $oldParent.children('.dw-res');
        if (!$res.length) {
          // This is the first reply; create the reply list.
          $res = $("<ol class='dw-res'/>").appendTo($oldParent);
        }
        $i.addClass('dw-m-t-new') // outlines all posts in thread
              // COULD highlight arrows too? To new replies / one's own reply.
          .prependTo($res);
        if (isInline) {
          // Place this inline thread inside its parent, by
          // undoing the parent's inline thread placement and doing
          // it again, with the new thread included.
          $oldParent.children('.dw-p')  // BUG $oldParent might be a new thread
            .each($undoInlineThreads)   // (see below)
            .each($initPost);
          // BUG: $oldParent might be a new thread, because when
          // 
          // BUG add an inline reply to an inline child post (i.e. add an
          // inline grandchild), and then $oldParent won't be redrawn.
        }
        // COULD avoid redrawing the same posts over and over again,
        // by inserting stuff to redraw in a map? and remove from the
        // map all posts whose parents are already in the map.
        // (Currently e.g. arrows from the root post are redrawn once
        // per new thread, since $drawParents is used below.)
        $i.each(SVG.$drawTree); // not $drawPost; $i might have child threads
        $newPost.each($initPostsThread);
        // Draw arrows from the parent post to its new child post,
        // *after* $newPost has been initialized, because $newPost' size
        // changes somewhat when it's inited. If some parent is an inline
        // post, *its* parent might need to be redrawn. So redraw all parents.
        $newPost.each(SVG.$drawParents);
      } else if (hasNewRatings) {
        // Update rating info for this post.
        // - All branches above automatically update ratings.
        // - The old post might have no rating info at all (if there were
        //   no ratings). So don't attempt to replace old elems with new
        //   ones; instead remove any old elems and append the new ones to
        //   the post creation timestamp, .dw-p-at, which exists for sure.
        // - Show() the new .dw-p-ra-all, so the user notices his/her own
        //   ratings, highlighted.
        var $newHdr = $newPost.children('.dw-p-hdr');
        $oldPost.children('.dw-p-hdr')
            .children('.dw-p-ra-top, .dw-p-ra-all').remove().end()
            .children('.dw-p-at').after(
                $newHdr.children('.dw-p-ra-top, .dw-p-ra-all').show());
      }
      else {
        // This post has not been changed, keep it as is.
      }

      // BUG $initPost is never called on child threads (isSubThread true).
      // So e.g. the <a ... class="dw-as">React</a> link isn't replaced.
      // BUG <new-post>.click($showReplyForm) won't happen
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
  // COULD rewrite-rename to initThread, which handles whole subtrees at once.
  // Then, $(".debiki .dw-p").each($initPost)
  // would be changed to $('#dw-root').each($initThread).

  var $thread = $(this).closest('.dw-t');

  // Add action buttons.
  var $actions = $('#dw-action-menu')
        .clone()
        .removeAttr('id')
        .css('visibility', 'hidden');
  $thread.find('> .dw-as').replaceWith($actions);
  // {{{ On delegating events for reply/rate/edit.
  // Placing a jQuery delegate on e.g. .debiki instead, entails that
  // these links are given excessively low precedence on Android:
  // on a screen touch, any <a> nearby that has a real click event
  // is clicked instead of the <a> with a delegate event. The reply/
  // reply/rate/edit links becomes virtually unclickable (if event
  // delegation is used instead). }}}
  $actions.children('.dw-a-reply').click($showReplyForm);
  $actions.children('.dw-a-rate').click($showRatingForm);
  $actions.children('.dw-a-more').click(function() {
    $(this).remove();
    $actions.children(
        '.dw-a-link, .dw-a-edit, .dw-a-flag, .dw-a-delete').show();
  });
  //$actions.children('.dw-a-link').click($showLinkForm); — not implemented
  $actions.children('.dw-a-edit').click($showEditForm2);
  $actions.children('.dw-a-flag').click($showFlagForm);
  $actions.children('.dw-a-delete').click($showDeleteForm);
  //$actions.children('.dw-a-edit').click($showEditSuggestions); — broken

  // For the root thread.
  $thread.children('.dw-hor-a').children('.dw-a-reply').click($showReplyForm);

  // Open/close threads if the thread-info div is clicked.
  $thread.children('.dw-z').click($threadClose);

  // Initially, hide edit suggestions.
  $thread.children('.dw-ess, .dw-a-edit-new').hide();
}

// Things that can be done a while after page load.
function $initPostsThreadStep2() {
  var $thread = $(this).closest('.dw-t');
  var $paras = $thread.filter(':not(.dw-depth-0)').children('.dw-p');

  // When hovering a post, show actions, and make it resizable.
  // But always show the leftmost Reply, at depth-0, that creates a new column.
  // (Better avoid delegates for frequent events such as mouseenter.)
  $paras.mouseenter(function() {
    var $i = $(this);
    // If actions are already shown for an inline child post, ignore event.
    // (Sometimes the mouseenter event is fired first for an inline child
    // post, then for its parent — and then actions should be shown for the
    // child post; the parent should ignore the event.)
    if (!$i.find('#dw-p-as-shown').length)
      $i.each($showActions);

    // {{{ Resizing of posts — disabled
    // This takes really long (700 ms on my 6 core 2.8 GHz AMD) if done
    // for all posts at once. Don't do it at all, unless hovering post.
    // (Resizing of posts oesn't work on touch devices (Android), and
    // the resize handles steal touch events.)
    // But! If done like this, when you hover a post, jQuery UI won't show
    // the resize handles until the mouse *leaves* the post an enters it
    // *again*. So this doesn't work well. I think I might as well disable
    // resizing of posts. It isn't very useful, *and* it does not work on
    // mobile devices (Android). If I disable it, then browsers will work
    // like mobile devices do and I will automatically build something
    // that works on mobile devices.
    //
    // If you comment in this code, please note:
    // $makeEastResizable must be called before $makePostResizable,
    // or $makeEastResizable has no effect. Search for
    // "each($makeEastResizable)" to find more info.
    //
    // if (!Modernizr.touch && !$i.children('.ui-resizable-handle').length)
    //   $i.each($makePostResizable);
    // }}}
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
    $thread.filter('.dw-depth-1:not(.dw-i-t)').each($makeEastResizable);
}

// Inits a post, not its parent thread.
function $initPost() {
  $initPostStep1.apply(this);
  $initPostStep2.apply(this);
}

function $initPostStep1() {
  var $i = $(this),
      $hdr = $i.find('.dw-p-hdr'),
      $postedAt = $hdr.children('.dw-p-at'),
      postedAtTitle = $postedAt.attr('title'),
      postedAt = Date.parse(postedAtTitle), // number, no Date, fine
      $editedAt = $hdr.find('> .dw-p-hdr-ed > .dw-p-at'),
      editedAtTitle = $editedAt.attr('title'),
      editedAt = Date.parse(editedAtTitle),
      now = new Date();  // COULD cache? e.g. when initing all posts

  // If this post has any inline thread, place inline marks and split
  // the single .dw-p-bdy-blk into many blocks with inline threads
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
    return $('<abbr title="'+ title +'"> '+ prettyTimeBetween(then, now) +
        '</abbr>');
  };

  // Show pretty how-long-ago info. (The $posted/editedAt are already hidden.)
  $postedAt.before(timeAgoAbbr(postedAtTitle, postedAt, now));
  $editedAt.before(timeAgoAbbr(editedAtTitle, editedAt, now));

  // If one clicks the header, show detailed timestamps and rating info.
  $hdr.css('cursor', 'crosshair').click(function(event) {
    if ($(event.target).is('a'))
      return;  // don't expand header on link click
    $(this)
        .css('cursor', null)
        .find('> .dw-p-at, > .dw-p-flgs-all, > .dw-p-ra-all, ' +
              '> .dw-p-hdr-ed > .dw-p-at').show()
        .end()
        // This might have expanded the post, so redraw arrows.
        .closest('.dw-p').each(SVG.$drawParents);
  });

  // Mark the user's own posts. COULD mark her edits too? (of others' posts)
  if (Me.getUserId() === $i.dwAuthorId())
    $i.addClass('dw-m-p-mine');

  // When hovering an inline mark or thread, highlight the corresponding
  // thread or mark.
  // TODO don't remove the highlighting until hovering something else?
  //  So one can follow the svg path to the inline thread.
  // When hovering an inline thread, highlight the mark.
  // COULD highlight arrows when hovering any post, not just inline posts?
  $('> .dw-p-bdy', this)
      .find('> .dw-p-bdy-blk .dw-i-m-start')
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
// and removes inline marks and undoes wrapping of -bdy contents into
// -bdy-blk:s. That is, undoes $placeInlineMarks and $splitBodyPlaceInlines.
// Call on posts.
function $undoInlineThreads() {
  // Remove inline marks and unwrap block contents.
  var $post = $(this);
  var $body = $post.children('.dw-p-bdy');
  // The post body contents is placed in various <div .dw-p-bdy-blk>
  // with inline threads, <div .dw-i-ts>, inbetween.
  // Move the contents back to a single <div .dw-p-bdy-blk>,
  // and also remove inline marks.
  var $bodyBlock = $('<div class="dw-p-bdy-blk"></div>');
  $body.children('.dw-p-bdy-blk').each(function() {
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
// TagDog unnecessarily much (it'd be confused by the -bdy-blk:s).
// Call on posts.
function $placeInlineMarks() {
  $(this).parent().find('> .dw-res > .dw-i-t', this).each(function(){
    // Search the parent post for the text where this mark starts.
    // Insert a mark (i.e. an <a/> tag) and render the parent post again.
    var markStartText = $(this).attr('data-dw-i-t-where');
    var $parentThread = $(this).parent().closest('.dw-t');
    var $bodyBlock = $parentThread.find(
        '> .dw-p > .dw-p-bdy > .dw-p-bdy-blk');
    bugIf($bodyBlock.length !== 1, 'debiki_error_6kiJ08');
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
        ['<div class="dw-p-bdy-blk">',
          tagDog.barkHtml(tagDogTextWithMark),
          '</div>'].join('');
    $bodyBlock.replaceWith(blockWithMarks);

    // Or simply:
    // var htmlWithMark = tagDogsniffAndMark(markStartText, $bodyBlock);
    // $bodyBlock.replace($(htmlWithMark));
  });
}

// Splits the single .dw-p-bdy-blk into many -bdy-blk:s,
// and places inline threads inbetween, in <ol .dw-i-ts> tags.
// Call on posts.
function $splitBodyPlaceInlines() {
  // Groups .dw-p-bdy child elems in groups around/above 200px high, and
  // wrap them in a .dw-p-bdy-blk. Gathers all inline threads for each
  // .dw-p-bdy-blk, and places them in an <ol> to the right of the
  // .dw-p-bdy-blk.
  var $placeToTheRight = function() {
    // Height calculation issue:
    //  After a .dw-p-bdy-blk and an <ol> have been added, there are
    //  elems before [the current block to wrap in a .dw-p-bdy-blk] that
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
      // wrap them in a .dw-p-bdy-blk, and any inline replies to them will
      // float to the right of that -body-block.
      var $block = $('<div class="dw-p-bdy-blk"></div>').insertBefore(elems[0]);
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
      // If the inline replies <ol> is higher than the -bdy-blk, there'll
      // be empty space between this -bdy-blk and the next one (because a
      // -bdy-blk clears floats). Avoid this, by reducing the height of
      // each inline thread.
      if (accHeightInlines > accHeight) {
        // TODO // For now, simply set the height to accHeight / numInlines.
      }
      accHeight = 0;
      elems = [];
    });
  };

  var $placeInside = function() {
    // There are some .dw-i-m-start that are direct children of this .dw-p-bdy.
    // They are inline marks for which no matching text was found, and are
    // currently placed at the end of this .dw-p-bdy. Wrap them in a single
    // .dw-p-bdy-blk, and their threads in an <ol>.
    var $bdyBlkMatchless = $('<div class="dw-p-bdy-blk"></div>');
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
      var $bdyBlk = $(this).wrap('<div class="dw-p-bdy-blk"></div>').parent();
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
  $(this).find('> .dw-p-bdy > .dw-p-bdy-blk').each(function(){
    var $placeFun = $(this).closest('.dw-t').filter('.dw-hor').length ?
        $placeToTheRight : $placeInside;
    $placeFun.apply(this);
    // Now there should be one <div .dw-p-bdy-blk> with many
    // <div .dw-p-bdy-blk> and <div .dw-i-ts> inside. Unwrap that single
    // parent <div .dw-p-bdy-blk>.
    $(this).replaceWith($(this).contents());
  });
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
  // Later, when finding the closest .dw-p-bdy-blk, we must start searching
  // from a non-text node, because jQuery(text-node) results in TypeError:
  //  Object #<a Text> has no method 'getAttribute'.
  var isTextNode = sel.focusNode.nodeType === 3;  // 3 is text
  var focusText = isTextNode ? sel.focusNode : undefined;
  var $focusNonText = $(isTextNode ? sel.focusNode.parentNode : sel.focusNode);
  var $post = $target.closest('.dw-p');
  var $postBody = $post.children('.dw-p-bdy');

  var placeWhere = (function() {
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
      $postBody.children('.dw-p-bdy-blk').each(function() {
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
        textEnd: justAfterMark
      };
    } else {
      undefined // not implemented. No inline menu will appear.
        // Seems to happen if you select a <li> or <p>,
        // by selecting a line end just before such an elem.
        // Or if you release the mouse button inside a .dw-i-m-start.
    }
  })();

  if (!placeWhere)
    return;

  // To have somewhere to place the reply form, split the block into
  // smaller .dw-p-bdy-blk:s, and add .dw-i-ts, if not already
  // done (which is the case if this post has no inline replies).
  if (!$postBody.children('.dw-i-ts').length) {
    // This rearranging of elems destroys `sel', e.g. focusNode becomes null.
    $post.each($splitBodyPlaceInlines);
  }

  sel = null; // fail fast, it *might* be broken here

  // Find out where to place the relevant form.
  placeWhere.elem = $focusNonText.closest('.dw-p-bdy-blk')
        .dwBugIfEmpty('debiki_error_6u5962rf3')
        .next('.dw-i-ts')
        .dwBugIfEmpty('debiki_error_17923xstq');

  // Entitle the edit button `Suggest Edit' or `Edit', depending on
  // whether or not it's the user's post.
  var authorId = $post.dwAuthorId();
  var curUserId = Me.getUserId();
  var editTitle = curUserId === authorId ?
      'Edit' : '<i>Suggest</i> Edit';  // i18n

  // Open a menu, with Edit, Reply and Cancel buttons. CSS: '-i' means inline.
  $menu = $(  // TODO i18n
      '<ul class="dw-as-inline">' +
        '<li><a class="dw-a-edit-i">'+ editTitle +'</a></li>' +
        '<li><a class="dw-a-reply-i">Reply inline</a></li>' +
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

  // Bind actions.
  $menu.find('.dw-a-edit-i').click(function(){
    $thread.each($showEditForm2);
    $menu.remove();
  });
  $menu.find('.dw-a-reply-i').click(function(){
    $showReplyForm.apply(this, [event, placeWhere]);
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
  var editCount = $('.dw-f-ed:visible').length;
  var msg = replyCount + editCount > 0 ?
    'You have started writing. Really close page?' :  // i18n
    undefined;  // don't return null, or IE asks roughly `confirm null?'
  return msg;
}

// Shows actions for the current post, or the last post hovered.
function $showActions() {
  // Hide any action links already shown; show actions for one post only.
  // IE9 and svgweb bug: $('#dw-p-as-shown') calls
  //  doc.setProperty('SelectionLanguage', 'XPath');  (in svg.js)
  // which fails: Object doesn't support property or method 'setProperty'
  // (line 1 column 319 in the minified svg.js) *if* the ID searched
  // for does *not* exist. Workaround: $('body').find('#...').
  $('body').find('#dw-p-as-shown')
      .css('visibility', 'hidden')
      .removeAttr('id');
  // Show links for the the current post.
  $(this).closest('.dw-t').children('.dw-as')
    .css('visibility', 'visible')
    .attr('id', 'dw-p-as-shown');
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

// Action <form> cancel button -- won't work for the Edit form...?
function slideAwayRemove($form) {
  // Slide away <form> and remove it.
  var $thread = $form.closest('.dw-t');
  function rm(next) {
    $form.remove();
    resizeRootThread();
    next();
  }
  // COULD elliminate dupl code that determines whether to fold or slide.
  if ($thread.filter('.dw-depth-0, .dw-debate').length &&
      !$form.closest('ol').filter('.dw-i-ts').length) {
    $form.each($foldOutLeft).queue(rm);
  }
  else {
    $form.each($slideUp).queue(rm);
  }
}

function $removeClosestForms() {  // COULD rewrite and remove .dw-fs everywhere
  var fs = $(this).closest('.dw-fs, .dw-f');
  slideAwayRemove(fs);
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
  if ($where.filter('.dw-depth-0, .dw-debate').length &&
      !$form.closest('ol').filter('.dw-i-ts').length) {
    $form.each($foldInLeft);
  } else {
    $form.each($slideDown);
  }

  // Cancel extra width. Or add even more width, to prevent float drops
  // -- needs to be done also when sliding downwards, since that sometimes 
  // makes the root thread child threads wider.
  $form.queue(function(next){
      resizeRootThreadNowAndLater();
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

// Constructs and shows a dialog, from a servers html response,
// which should contain certain html elems and classes — if not,
// a HTTP status code dialog with the response as plain text is shown.
function showServerResponseDialog(jqXhrOrHtml, opt_errorType,
                                  opt_httpStatusText) {
  var $html = $(jqXhrOrHtml.responseText || jqXhrOrHtml).filter('.dw-dlg-rsp');
  var title = $html.children('.dw-dlg-rsp-ttl').text();
  var width = 400;
  if (!$html.length) {
    // No html elems found. This is probably a plain text error response.
    // Set title to something like "403 Forbidden", and show the
    // text message inside the dialog.
    title = jqXhrOrHtml.status ?
              (jqXhrOrHtml.status +' '+ opt_httpStatusText) : 'Error'
    $html = $('<pre class="dw-dlg-rsp"></pre>');
    width = 'auto'; // avoids scrollbars in case of any long <pre> line
    // Use text(), not plus (don't: `... + text + ...'), to prevent xss issues.
    $html.text(jqXhrOrHtml.responseText || opt_errorType || 'Unknown error');
  }
  $html.children('.dw-dlg-rsp-ttl').remove();
  $html.dialog({
    title: title,
    autoOpen: true,
    width: width,
    modal: true,
    resizable: false,
    zIndex: 1190,
    buttons: {
      OK: function() {
        $(this).dialog('close');
      }
    }
  });
}


// ------- User properties

// Updates cookies and elements to show the user name, email etc.
// as appropriate. Unless !propsUnsafe, throws if name or email missing.
// Fires the dwEvLoggedInOut event on all .dw-login-on-click elems.
// Parameters:
//  props: {name, email, website}, will be sanitized unless
//  sanitize: unless `false', {name, email, website} will be sanitized.
function fireLogout() {
  Me.refreshProps();
  $('#dw-login-info').hide();
  $('#dw-a-logout').hide();
  $('#dw-a-login').show();

  // Clear all xsrf tokens. They are invalid now after logout, because
  // the server instructed the browser to delete the session id cookie.
  $('input.dw-fi-xsrf').attr('value', '');

  // Let `Post as <username>' etc buttons update themselves:
  // they'll replace <username> with `...', and register an on click
  // handler that shows the login form.
  var oldUserProps = undefined; // for now
  $('.dw-login-on-click')
      .click($showLoginSimple)
      .trigger('dwEvLoggedInOut', [undefined]);
}

function fireLogin() {
  Me.refreshProps();
  $('#dw-login-info').show().find('.dw-login-name').text(Me.getName());
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
  // they'll unregister an on click handler that shows the login form,
  // and they'll replace '...' with the user name.
  $('.dw-login-on-click')
      .unbind('click', $showLoginSimple)
      .trigger('dwEvLoggedInOut', [Me.getName()]);
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

  return {
    // Call whenever the SID changes: on page load, on login and logout.
    refreshProps: parseSidCookie,

    // Warning: Never ever use this name as html, that'd open for
    // xss attacks. E.g. never do: $(...).html(Me.getName()), but the
    // following should be okay though: $(...).text(Me.getName()).
    getName: function() { return userProps.name; },
    isLoggedIn: function() { return userProps.loginId ? true : false; },
    getLoginId: function() { return userProps.loginId; },
    getUserId: function() { return userProps.userId; },
    mayEdit: function($post) {
      return userProps.userId === $post.dwAuthorId(); // for now
      // COULD check page permissions, e.g. edit-all-posts.
    },
  };
}

// ------- Logout

// COULD refactor jQuery UI dialog usage: a function that creates a default
// Debiki dialog. E.g. hide the submit input, and set defaut properties.

function showLogout() {
  initLogout();
  $('#dw-fs-logout').dialog('open');
}

function initLogout() {
  var $logout = $('#dw-fs-logout');
  if ($logout.is('.ui-dialog-content'))
    return; // already inited

  var $logoutForm = $logout.find('form');
  $logout.find('input').hide(); // Use jQuery UI's dialog buttons instead
  $logout.dialog({
    autoOpen: false,
    height: 260,
    width: 350,
    modal: true,
    resizable: false,
    zIndex: 1190,  // the default, 1000, is lower than <form>s z-index
    buttons: {
      Cancel: function() {
        $(this).dialog('close');
      },
      'Log out': function() {
        $(this).dialog('close');
        $logoutForm.submit();
      }
    }
  });
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

function showLoginOkay() {
  initLoginResultForms();
  $('#dw-fs-login-ok-name').text(Me.getName());
  $('#dw-fs-login-ok').dialog('open');
}

function showLoginFailed(errorMessage) {
  initLoginResultForms();
  $('#dw-fs-login-failed-errmsg').text(errorMessage);
  $('#dw-fs-login-failed').dialog('open');
}

function initLoginResultForms() {
  if ($('#dw-fs-login-ok.ui-dialog-content').length)
    return; // login-ok and -failed already inited

  var $loginResult = $('#dw-fs-login-ok, #dw-fs-login-failed');
  var $loginResultForm = $loginResult.find('form');
  $loginResult.find('input').hide(); // Use jQuery UI's dialog buttons instead
  $loginResult.dialog({
    autoOpen: false,
    autoResize: true,
    modal: true,
    resizable: false,
    zIndex: 1190,
    buttons: {
      'OK': function() {
        $(this).dialog('close');
      }
    }
  });
}


// ------- Login, simple

function initLoginSimple() {
  var $login = $('#dw-fs-login-simple');
  if ($login.is('.ui-dialog-content'))
    return; // already inited

  var $loginForm = $login.find('form');
  $login.find('.dw-fi-submit').hide();  // don't show before name known
  $login.dialog({
    autoOpen: false,
    width: 580,
    modal: true,
    resizable: false,
    zIndex: 1190,  // the default, 1000, is lower than <form>s z-index
    buttons: {
      Cancel: function() {
        $(this).dialog('close');
      },
      OK: function() {
        $loginForm.submit();
      }
    },
    close: function() {
      // Perhaps reset form? Something like this:
      // allFields.val('').removeClass('ui-state-error');
    }
  });

  $loginForm.submit(function() {
    // COULD show a "Logging in..." message — the roundtrip
    // might take a second if the user is far away?
    $.post($loginForm.attr("action"), $loginForm.serialize(), 'html')
        .done(function(data) {
          // Warning: Somewhat dupl code, see Debiki.handleLoginResponse.
          // User info is now available in cookies.
          $login.dialog('close');
          fireLogin();
          showServerResponseDialog(data);
          continueAfterLoginOnClick();
        })
        .fail(showServerResponseDialog)
        .always(function() {
          // COULD hide any "Logging in ..." dialog.
        });
    return false;
  });

  $login.find('.dw-a-login-openid')
      .button().click($showLoginOpenId);
}

function $loginOnClick(loginEventHandler) {
  return function() {
    var $i = $(this);
    $i.addClass('dw-login-on-click').bind('dwEvLoggedInOut', loginEventHandler);
    if (!Me.isLoggedIn()) $i.click($showLoginSimple)
  };
}

// Invoke on a .login-on-click submit <input>. After the login
// has been completed, the button will be submitted, see
// continueAfterLoginOnClick().
function $showLoginSimple() {
  loginOnClickBtnClicked = this;
  showLoginSimple();
  return false;  // skip default action
}

function continueAfterLoginOnClick() {
  // The user has logged in, and if the login was initiated via
  // a click on a .dw-login-on-click button, continue the submit
  // process that button is supposed to start.
  $(loginOnClickBtnClicked).closest('form').submit();
  loginOnClickBtnClicked = null;
}

function showLoginSimple() {
  initLoginSimple();
  $('#dw-fs-login-simple').dialog('open');  // BUG Tag absent unless…
          //… a debate is shown, so the dw-hidden-templates included.
}

// ------- Login, OpenID

function initLoginOpenId() {
  var $openid = $('#dw-fs-openid-login');
  if ($openid.is('.ui-dialog-content'))
    return; // already inited

  openid.img_path = '/classpath/0/lib/openid-selector/images/';
  openid.submitInPopup = submitLoginInPopup;
  // Keep default openid.cookie_expires, 1000 days
  // — COULD remove cookie on logout?
  openid.init('openid_identifier');

  $openid.dialog({
    autoOpen: false,
    height: 410,
    width: 720,
    modal: true,
    resizable: false,
    zIndex: 1200,  // the default, 1000, is lower than <form>s z-index
    buttons: {
      Cancel: function() {
        $(this).dialog('close');
      }
    },
    close: function() {
      // Perhaps reset form? Something like this:
      // allFields.val('').removeClass('ui-state-error');
    }
  });
}

function $showLoginOpenId() {
  initLoginOpenId();
  $('#dw-fs-openid-login').dialog('open');
  return false;  // skip default action
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
    if (Debiki.handleLoginResponse !== null) {
      Debiki.handleLoginResponse({status: 'LoginFailed'});
    }
    if (waitCallback !== null) {
      window.clearInterval(waitCallback);
      waitCallback = null;
    }
  }

  // This callback is called from the return_to page:
  Debiki.handleLoginResponse = function(result) {
    Debiki.handleLoginResponse = null;
    var errorMsg;
    if (/openid\.mode=cancel/.test(result.queryString)) {
      // This seems to happen if the user clicked No Thanks in some
      // login dialog; when I click "No thanks", Google says:
      // "openid.mode=cancel&
      //  openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0"
      errorMsg = 'You cancelled the login process? [debiki_error_89k5gwJm43]';
    } else if (result.status === 'LoginFailed') {
      // User closed popup window?
      errorMsg = 'You closed the login window? [debiki_error_5k33rs83k0]';
    } else if (result.status !== 'LoginOk') {
      errorMsg = 'Unknown login problem [debiki_error_3kirsrts12d]';
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
      $('#dw-fs-login-simple').dialog('close');
      fireLogin();
      showLoginOkay();
      continueAfterLoginOnClick();
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


// ------- Rating

function $showRatingForm() {
  var thread = $(this).closest('.dw-t');
  clearfix(thread); // ensures the rating appears nested inside the thread
  var $post = thread.children('.dw-p');
  var $rateForm = rateFormTemplate.clone(true); // TODO: Rename to $formWrap?
  var postId = $post.attr('id').substr(8, 999); // drop initial 'dw-post-'

  // The rating-value inputs are labeled checkboxes. Hence they
  // have ids --- which right now remain the same as the ids
  // in the rateFormTemplate. Make the cloned ids unique:
  makeIdsUniqueUpdateLabels($rateForm);

  // Enable submit button when ratings specified
  $rateForm.find("input[type='checkbox']").click(function(){
    $rateForm.find("input[type='submit']").button("option", "disabled", false);
  });

  // Need to be logged in when submitting ratings, or there might
  // be no xsrf token — the server would say Forbidden.
  $rateForm.find('input[type="submit"]').each(
      $loginOnClick(function(event, userName) {
    // Could change the submit button title to `Submit as <username>',
    // but that'd make this not-so-very-important button rather large?
  }));

  // Ajax-post ratings on submit.
  //  - Disable form until request completed.
  //  - When completed, highlight the user's own ratings.
  $rateForm.submit(function(){
    // Find selected rating tags, so they can be highlighted later.
    var ratedTags = $rateForm.find("input:checked").map(function(){
      return $(this).val().toLowerCase();
    }).get();

    $.post(Settings.makeRatePostUrl(debateId, postId),
          $rateForm.children('form').serialize(), function(recentChangesHtml) {
        updateDebate(recentChangesHtml);
        // Highligt the user's ratings.
        var $newPost = $('#dw-post-' + postId);
        $newPost.find('.dw-rats .dw-rat').each(function(){
            // .dw-rat text is e.g. " interesting 80% ". Make lowercase,
            // and drop " 80% ", so tag-name comparison works.
            var $rating = $(this);
            var text = $rating.text().toLowerCase().replace(/ \d+% /, '');
            $.each(ratedTags, function(ix, val) {
              UNTESTED; // rewrote from for-in
              if ($.trim(text) === val) {
                $rating.addClass('dw-you-rated');
                return false;
              }
            });
          });
        slideAwayRemove($rateForm);
      }, 'html');

    $rateForm.find('input').dwDisable();
    return false;
  });

  // Fancy fancy
  // Seems this must be done *after* the rateFormTemplate has been
  // copied --- otherwise, if the Cancel button is clicked,
  // the rateFormTemplate itself has all its jQueryUI markup removed.
  // (Is that a jQuery bug? Only the *clone* ought to be affected?)
  $rateForm.find('.dw-rat-tag-set input, .dw-submit-set input').button();
  // Disable the submit button (until any checkbox clicked)
  $rateForm.find("input[type='submit']").button("option", "disabled", true);
  $rateForm.find('.dw-show-more-rat-tags').
    button().addClass('dw-ui-state-default-linkified');
  // Reveal the form
  slideInActionForm($rateForm, thread);
}

function $showMoreRatingTags() {
  $(this).hide().
      closest('form').find('.dw-more-rat-tags').show();
}


// ------- Flagging

// warning: dupl code, see initDeleteForm,
// and initLogout/initLoginSimple/initLoginOpenId etc.
// COULD break out some common dialog init/show functions?
function initFlagForm() {
  var $form = $('#dw-f-flg');
  var $parent = $form.parent();
  if ($parent.is('.ui-dialog-content'))
    return; // already inited

  $form.find('.dw-submit-set input').hide(); // use jQuery UI's buttons instead
  $form.find('.dw-f-flg-rsns').buttonset();
  $parent.dialog({
    autoOpen: false,
    width: 580,
    modal: true,
    resizable: false,
    zIndex: 1190,  // the default, 1000, is lower than <form>s z-index
    buttons: {
      'Cancel': function() {
        $(this).dialog('close');
      },
      'Submit': function() {
        // COULD ensure details specified if "Others" reason selected.
        // COULD show a "Submitting..." message.
        if (!Me.isLoggedIn())
          $form.each($showLoginSimple) // ask who are you
        else
          $form.submit();
      }
    },
    /* buttons: [ // {{{ weird, this results in button titles '0' and '1'
      { text: 'Cancel', click: function() {
        $(this).dialog('close');
      }},
      { id: 'dw-fi-flg-submit', text: 'Submit', disabled: 'disabled',
          click: function() {
        // COULD ensure details specified if "Others" reason selected.
        // COULD show a "Submitting..." message.
        if (!Me.isLoggedIn())
          $form.each($showLoginSimple) // ask who are you
        else
          $form.submit();
      }}],   }}} */
    close: function() {
      // TODO reset form.
      // allFields.val('').removeClass('ui-state-error');
    }
  });

  // {{{ How to enable the submit button on radio button click?
  // Below button(option ...) stuff results in:
  //    Uncaught TypeError: Object function () {
  //       $('#dw-fi-flg-submit').button('option', 'disabled', false);
  //     } has no method 'split'
  //$('#dw-fi-flg-submit').button('option', 'disabled', true);
  //$form.find('.dw-f-flg-rsns label').one(function() {
  //  $('#dw-fi-flg-submit').button('option', 'disabled', false);
  //});
  // }}}

  $form.submit(function() {
    $.post($form.attr("action"), $form.serialize(), 'html')
        .done(function() {
          $parent.dialog('close');
          // TODO updateDebate, in some manner
        })
        .fail(showServerResponseDialog);
    return false;
  });
}

// warning, dupl code, see $showDeleteCommentForm.
function $showFlagForm() {
  initFlagForm();
  var $i = $(this);
  var $t = $i.closest('.dw-t');
  var $post = $t.children('.dw-p');
  var postId = $post.attr('id').substr(8, 999); // drop initial "dw-post-"
  var $flagForm = $('#dw-f-flg');
  $flagForm
      .attr('action', '?flag='+ postId)
      .parent().dialog('open');  //parent().position({
      //my: 'center top', at: 'center bottom', of: $post, offset: '0 40'});
}


// ------- Replying

// Shows a reply form, either below the relevant post, or inside it,
// if the reply is an inline comment -- whichever is the case is determined
// by event.target.
function $showReplyForm(event, opt_where) {
  // Warning: Some duplicated code, see .dw-rat-tag and
  // dw-a-edit-new click() above.
  var $thread = $(this).closest('.dw-t');
  var $post = $thread.children('.dw-p');
  clearfix($thread); // ensures the reply appears nested inside the thread
  var postId = $post.attr('id').substr(8, 999); // drop initial "dw-post-"
  // Create a reply form, or Ajax-load it (depending on the Web framework
  // specifics).
  Settings.replyFormLoader(debateId, postId, function($replyFormParent) {
    var $replyForm = $replyFormParent.children('form');
    makeIdsUniqueUpdateLabels($replyForm);
    $replyForm.resizable({
        alsoResize: $replyForm.find('textarea'),
        resize: function() {
          resizeRootThreadExtraWide(); // TODO rm textarea width?
          $post.each(SVG.$drawParents);
        },
        stop: resizeRootThreadNowAndLater,
        minHeight: 180,  // or lower parts of form might overflow
        minWidth: 210  // or Cancel button might float drop
      });

    var $submitBtn = $replyForm.find('.dw-fi-submit');
    var setSubmitBtnTitle = function(event, userName) {
      var text = userName ?  'Post as '+ userName : 'Post as ...';  // i18n
      $submitBtn.val(text);
    }
    setSubmitBtnTitle(null, Me.getName());
    $submitBtn.each($loginOnClick(setSubmitBtnTitle));

    // Ajax-post reply on submit.
    $replyForm.submit(function() {
      Settings.replyFormSubmitter($replyForm, debateId, postId)
        .done(function(newDebateHtml) {
          // The server has replied. Merge in the data from the server
          // (i.e. the new post) in the debate, and remove the form.
          updateDebate(newDebateHtml);
          slideAwayRemove($replyFormParent);
        })
        .fail(function(jqXHR, errorType, httpStatusText) {
          // Show error info and enable submit/cancel buttons again.
          var $submitBtns = $replyForm.find('.dw-submit-set');
          var err = jqXHR.status ? (jqXHR.status +' '+ httpStatusText) : 'Error'
          var msg = (jqXHR.responseText || errorType || 'Unknown error');
          $submitBtns.after(notifErrorBox$(err, msg))
          $thread.each(SVG.$drawParentsAndTree); // because of the notification
          $replyForm.find('input, button').prop('disabled', false);
        });
      // Disable the form; it's been submitted.
      $replyForm.find('input').dwDisable();
      return false;
    });

    // Fancy fancy
    $replyForm.find('.dw-submit-set input').button();
    $replyForm.find('label').addClass(
      // color and font matching <input> buttons
      'dw-ui-state-default-color dw-ui-widget-font');

    if (opt_where) {
      // The user replies to a specific piece of text inside the post.
      // Place the reply inline, and fill in the `where' form field with
      // the text where the click/selection was made.
      $replyFormParent.prependTo(opt_where.elem);
      $replyForm.find('input[id^="dw-fi-reply-where"]')
          .val(opt_where.textStart);
    } else {
      // Place the form below the post, in the .dw-res list.
      var $res = $thread.children('.dw-res');
      if (!$res.length) {
        // This is the first reply; create the reply list. // TODO: DUPL CODE
        $res = $("<ol class='dw-res'/>").appendTo($thread);
      }
      $res.prepend($replyFormParent.hide());
    }
    $replyFormParent.each(SVG.$drawPost);
    slideInActionForm($replyFormParent);
  });
}

// ------- Inline edits

// Shows the edit form.
function $showEditForm2() {
  var $thread = $(this).closest('.dw-t');
  var $post = $thread.children('.dw-p');
  var $postBody = $post.children('.dw-p-bdy');
  var postId = $post.attr('id').substr(8, 999); // drop initial "dw-post-"

  // COULD move function to debiki-lift.js:
  var editFormLoader = function(debateId, postId, complete) {
    // see comments in setReplyFormLoader above on using datatype text
    $.get('?edit='+ postId, function(editFormText) {
      // Concerning filter(…): [0] and [2] are text nodes.
      var $editForm = $(editFormText).filter('form');
      makeIdsUniqueUpdateLabels($editForm, '#dw-ed-tab-');
      complete($editForm)
    }, 'text');
  };

  function $showPreviewBtnHideSave() {
    // A submit button click doesn't submit, but shows the preview tab,
    // unless the preview tab is already visible — then it submits.
    $(this).find('input.dw-fi-submit').hide().end()
      .find('input.dw-fi-ed-preview').show();
  }

  // If the edit form has already been opened, but hidden by a Cancel click,
  // reuse the old hidden form, so any edits aren't lost.
  var $oldEditForm = $post.find('.dw-f-ed');
  if ($oldEditForm.length) {
    $oldEditForm.each($showPreviewBtnHideSave);
    $oldEditForm.tabs('select' , 0);  // selects the textarea tab
    $oldEditForm.show();
    $postBody.hide();
    return;
  }

  editFormLoader(debateId, postId, function($editForm) {
    var $panels = $editForm.find('.dw-ed-tab');
    var $editPanel = $panels.filter('[id^="dw-ed-tab-edit"]');
    var $diffPanel = $panels.filter('[id^="dw-ed-tab-diff"]');
    var $previewPanel = $panels.filter('[id^="dw-ed-tab-preview"]');
    var $previewBtn = $editForm.find('input.dw-fi-ed-preview');
    var $submitBtn = $editForm.find('input.dw-fi-submit');
    var $cancelBtn = $editForm.find('input.dw-fi-cancel');

    $previewBtn.button();
    $submitBtn.button().hide();  // you need to preview before submit
    $cancelBtn.button();

    $editForm.insertBefore($postBody);
    $postBody.hide();
    $cancelBtn.click(function() {
      $postBody.show();
      $editForm.hide();
      $post.each(SVG.$drawParents);
    });

    // Notify the user if s/he is making an edit suggestion only.
    var hideOrShow = Me.mayEdit($post) ? 'hide' : 'show';
    $editForm.find('.dw-f-ed-sugg-info')[hideOrShow]();

    // Find the post's current (old) source text, and store in
    // .dw-ed-src-old, so it's easily accessible to $updateEditFormDiff(…).
    if (!$editForm.data('dw-ed-src-old')) {
      var oldSrc = $editForm.find('.dw-ed-src-old');
      if (oldSrc.length) {
        oldSrc = oldSrc.text();
      }
      else {
        // html.scala excluded .dw-ed-src-old, if the textarea's text
        // is identical to the old src. (To save bandwidth.)
        oldSrc = $editPanel.find('textarea').val();
      }
      $editForm.data('dw-ed-src-old', oldSrc);
    }

    var showSaveBtnHidePreview = function() {
      $submitBtn.show();
      $previewBtn.hide();
    }

    // This makes the edit form at least as high as the post.
    var lastPanelHeight = $postBody.height();

    $editForm.tabs({
      selected: 0,
      show: function(event, ui) {
        $editForm.each($showPreviewBtnHideSave);

        // Update the tab to be shown.
        var $panel = $(ui.panel);
        var $fun = $.noop;
        switch (ui.panel.id) {
          case $editPanel.attr('id'):
            break;
          case $diffPanel.attr('id'):
            $fun = $updateEditFormDiff;
            break;
          case $previewPanel.attr('id'):
            $fun = $updateEditFormPreview;
            showSaveBtnHidePreview();
            break;
          default: die('[debiki_error_4krERS]');
        };
        $(this).each($fun);

        // Don't reduce the form heigt, because if the form is at the
        // very bottom of the screen, everything would jump downwards
        // when the browser window shrinks.
        $panel.height('auto');
        if (lastPanelHeight > $panel.height()) {
          // jQuery UI shows the panels before the `show' event is triggered,
          // so unless the other panels are resized *before* one of them is
          // shown, that other panel might be smaller than the current one,
          // causing the window to shrink and everything to jump downwards
          // (if you're viewing the bottom of the page).
          // So change the height of all panels — then they won't shrink
          // later, when shown.
          // (COULD make this work also if a panel is resized dynamically,
          // whilst open — right now the other panels won't be resized.)
          $panels.height(lastPanelHeight);
        } else {
          lastPanelHeight = $panel.height();
        }
      }
    });

    // Show the preview tab on 'Preview and save ...' click.
    $previewBtn.click(function() {
      $editForm.tabs('select', 2);
      showSaveBtnHidePreview();
      return false;
    });

    // When clicking the Save button, open a login dialog, unless logged in.
    $submitBtn.each($loginOnClick(function(event, userName) {
      var text = userName ?  'Save as '+ userName : 'Save as ...';  // i18n
      $(this).val(text);
    }));

    // Redraw SVG arrows, since the edit form is larger than the post.
    $post.each(SVG.$drawParents);

    // Ajax-post edit on submit, and update the page with all recent changes.
    $editForm.submit(function() {
      Settings.editFormSubmitter($editForm, debateId, postId,
          function(newDebateHtml){
        slideAwayRemove($editForm);
        // If the edit was a *suggestion* only, the post body has not been
        // changed. Unless we make it visible again, it'll remain hidden
        // because updateDebate ignores it (since it hasn't changed).
        $postBody.show();
        updateDebate(newDebateHtml);
      });
      // Disable the form; it's been submitted.
      $editForm.find('input').dwDisable();
      return false;
    });

  });
}

// Call on a .dw-f-ed, to update the diff tab.
function $updateEditFormDiff() {
  // Find the closest post
  var $editForm = $(this).closest('.dw-f-ed');
  var $editTab = $(this).find('div.dw-ed-tab[id^="dw-ed-tab-edit"]');
  var $diffTab = $(this).find('div.dw-ed-tab[id^="dw-ed-tab-diff"]');
  var $textarea = $editTab.find('textarea');

  // Find the current draft text, and the old post text.
  var newSrc = $textarea.val();
  var oldSrc = $editForm.data('dw-ed-src-old');

  // Run new diff.
  var diff = diffMatchPatch.diff_main(oldSrc, newSrc);
  diffMatchPatch.diff_cleanupSemantic(diff);
  var htmlString = prettyHtmlFor(diff);
  // Remove any old diff.
  $diffTab.children('.dw-p-diff').remove();
  // Show the new diff.
  $diffTab.append('<div class="dw-p-diff">'+ htmlString +'</div>\n');
}

// Call on a .dw-f-ed, to update the preview tab.
function $updateEditFormPreview() {
  var $editForm = $(this).closest('.dw-f-ed');
  var $editTab = $editForm.find('div.dw-ed-tab[id^="dw-ed-tab-edit"]');
  var $previewTab = $editForm.find('div.dw-ed-tab[id^="dw-ed-tab-preview"]');
  var $textarea = $editTab.find('textarea');

  var markdownSrc = $textarea.val();
  var html = markdownToSafeHtml(markdownSrc);
  $previewTab.html(html);
}


// ------- Editing

// Shows edit suggestions and a new-suggestion button.
function $showEditSuggestions() {
  $(this).closest('.dw-t').children('.dw-ess, .dw-a-edit-new')
      .stop(true,true)
      .each($slideToggle);
}

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
  var $postBody = $post.children('.dw-p-bdy');
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
  $post.children('.dw-p-bdy').show();
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

// Shows a new edit suggestion form.
function $showEditForm() {
  var $thread = $(this).closest('.dw-t');
  clearfix($thread); // makes edit area appear inside $thread
  var $post = $thread.children('.dw-p');
  // Create a div into which to load the edit <form>s -- the div class should
  // match the edit form div's class, so the action-menu won't be displayed
  // again until the request has completed and the edit form has been closed.
  var $formWrap = $("<div class='dw-fs'></div>").insertAfter(
      $thread.children('.dw-a:last'));//TODO: use $.get & update() instead
  $formWrap.hide(); // slide in later
  var postId = $post.attr('id').substr(8, 999); // drop initial "dw-post-"

  Settings.editFormLoader(debateId, postId, function($editFormParent) {
    var $editForm = $editFormParent.children('form');
    $formWrap.prepend($editFormParent);

    // (Need not make ids unique; the post id was known when html generated.)

    var $editDiv = $formWrap.find('.dw-fs-ed').hide(); // TODO? Remove `find'?
    var $accordions = $editDiv.find('.dw-edits');

    var $editsPendingForm = $editDiv.find('.dw-f-ed-others');
    var $editsYoursForm = $editDiv.find('.dw-f-ed-new');
    var $editsAppliedForm = $editDiv.find('.dw-f-ed-applied');

    var $showEditsPendingBtn = $editDiv.find('.dw-f-ed-btn-show-pending');
    var $showNewEditBtn = $editDiv.find('.dw-f-ed-btn-new-edit');
    var $showEditsAppliedBtn = $editDiv.find('.dw-f-ed-btn-show-applied');

    var $forms = $editsPendingForm.add($editsYoursForm).add($editsAppliedForm);
    var $showBtns = $showEditsPendingBtn.add($showNewEditBtn).
                                                    add($showEditsAppliedBtn);
    var $editTextArea = $editsYoursForm.find('textarea');

    $forms.addClass('ui-helper-clearfix');

    // If there are any edits suggested, show them (or people will
    // never understand they're supposed to vote them up/down).
    // Otherwise, show the new-edit-suggestion form.
    if ($editsPendingForm.length) $editsYoursForm.hide();
    else $showNewEditBtn.hide();
    $editsAppliedForm.hide();

    // Unwrap, since the form must be a thread child (not grandchild)
    // or the action menu will appear if hovering the post.
    $editDiv.unwrap();

    // Copy post text to edit-suggestion textarea.
    var curText = '';
    $post.find('.dw-p-bdy p').each(function(){
          curText += $(this).text() + '\n\n'; });
    $editTextArea.val(curText.trim() + '\n');

    // Show and update a diff of the edits suggested.
    // Remove the diff when the form loses focus.
    var showDiff = function(){
      $editTextArea.each($showEditDiff);
    };
    $editTextArea.bind('change keyup', showDiff); // updates diff
    $editForm.mouseenter(showDiff);
    // COULD: Hide diff when the form loses focus.
    // But: mouseleave fires when focusing the textarea, although it's placed
    // inside the form. So, right now, with the below line commented in,
    // the diff will flicker visible/hidden annoyingly frequently.
    //$editForm.mouseleave(function(){ $post.each($removeEditDiff); });

    // On cancel, remove the diff.
    $editForm.find('.dw-fi-cancel').click($removeEditDiff);

    // Make forms and accordions resizable
    $editsYoursForm.resizable({
        alsoResize: $editTextArea,
        resize: function(){
          // (Need not resizeRootThread,
          // since the $editDiv is not resized.)
          $post.each(SVG.$drawParents);
        }
      });
    $accordions.wrap("<div class='dw-resize-accordion' />");
    $accordions.each(function(){
      var $this = $(this);
      var $accwrap = $this.parent();
      $this.closest('form').resizable({
          alsoResize: $accwrap,
          resize: function(){ $this.accordion("resize"); },
          // (Need not resizeRootThread,
          // since the $editDiv is not resized.)
          minHeight: 100
        });
    });

    // Adjust dimensions.
    var width = Math.min(400, $post.outerWidth()); // root post very wide
    width = Math.max(250, width); // deeply nested posts too thin
    $editDiv.css('width', '' + width + 'px');
    $accordions.parent().css('height', '300px');

    $showEditsPendingBtn.button().hide().click(function(){
      $(this).slideUp();
      $editsPendingForm.slideDown();
      $accordions.accordion("resize"); // new element was made visible
    });

    $showNewEditBtn.button().click(function(){
      $(this).slideUp();
      $editsYoursForm.slideDown();
    });

    $showEditsAppliedBtn.button().click(function(){
      $(this).slideUp();
      $editsAppliedForm.slideDown();
      $accordions.accordion("resize");
    });

    // Close forms, and show open-form buttons, on Cancel click.
    // Remove the whole edit <div> if all forms are closed (not visible).
    $forms.each(function(ix){
      $(this).find('.dw-fi-cancel').click(function(){
        $showBtns.slice(ix,ix+1).slideDown();
        // results in weird bugs:
        // $(this).closest('form').each($slideUp).queue(function(next){
        $(this).closest('form').slideUp().queue(function(next){
            if ($editsPendingForm.is(':visible') +
                $editsYoursForm.is(':visible') +
                $editsAppliedForm.is(':visible') === 0) {
              slideAwayRemove($editDiv);
            }
            next();
          });
      });
    });

    // Fancy fancy
    $editDiv.find(
        "input[type='button'], input[type='submit'], input[type='radio']").
        button();
    $editDiv.find('label').addClass(
      // color and font matching <input> buttons
      'dw-ui-state-default-color dw-ui-widget-font');

    // Reveal the form.
    // Must be done before accordion() is invoked (below) otherwise
    // jQuery UI (as of 1.8.2) will make it very small.
    slideInActionForm($editDiv);

    // Cannot use autoHeight, since other people's edit suggestions
    // might be arbitrary long?
    $accordions.each(function(){
        var numElems = $(this).find('h4').length;
        $(this).accordion(
        { collapsible: true, active: (numElems === 1 ? 0 : false),
          autoHeight: false, fillSpace: true, icons: false });
      });
  });
}

// ------- Edit anything, attempt 0

// When clicking text, open a textarea, so the user can modify the text
// and submit an edit suggestion.

// TODO Fix font size, make edit area reasonably large.
// TODO Add http://code.google.com/p/google-caja/wiki/JsHtmlSanitizer
//   ?? via ttp://google-caja.googlecode.com/svn/maven/caja/caja/*/caja-*.jar
// TODO Don't close textarea on click outside.
// TODO Merge 2 textareas if they're next to each other.
/*
<script type="text/javascript" src="/classpath/0/js/jquery.jeditable.js" />

$('.debiki p').editable('http://www.example.com/save.php', {
  type      : 'textarea',
  cancel    : 'Cancel',
  submit    : 'Submit suggestion',
  indicator : '<img src="img/indicator.gif">',
  tooltip   : 'Click to edit...'
});
*/


// ------- Delete comments

// warning: dupl code, see initFlagForm.
function initDeleteForm() {
  var $form = $('#dw-f-dl');
  var $parent = $form.parent();
  if ($parent.is('.ui-dialog-content'))
    return; // already inited

  $form.find('.dw-submit-set input').hide(); // use jQuery UI's buttons instead
  // Don't make a button of -tree, because then it's a tiny bit
  // harder to realize wethere it's checked or not, and this is a
  // rather important button.
  // Skip: $form.find('#dw-fi-dl-tree').button();
  $parent.dialog({
    autoOpen: false,
    width: 580,
    modal: true,
    resizable: false,
    zIndex: 1190,  // the default, 1000, is lower than <form>s z-index
    buttons: {
      Cancel: function() {
        $(this).dialog('close');
      },
      Delete: function() {
        // COULD ensure details specified if "Others" reason selected.
        // COULD show a "Submitting..." message.
        if (!Me.isLoggedIn())
          $form.each($showLoginSimple) // ask who are you
        else
          $form.submit();
      }
    },
    close: function() {
      // TODO reset form.
      // allFields.val('').removeClass('ui-state-error');
    }
  });

  $form.submit(function() {
    $.post($form.attr("action"), $form.serialize(), 'html')
        .done(function() {
          $parent.dialog('close');
          // TODO updateDebate, in some manner
        })
        .fail(showServerResponseDialog);
    return false;
  });
}

// warning: dupl code, see $showFlagForm.
function $showDeleteForm() {
  initDeleteForm();
  var $i = $(this);
  var $t = $i.closest('.dw-t');
  var $post = $t.children('.dw-p');
  var postId = $post.attr('id').substr(8, 999); // drop initial "dw-post-"
  var $deleteForm = $('#dw-f-dl');
  $deleteForm
      .attr('action', '?delete='+ postId)
      .parent().dialog('open');  //.parent().position({
      //my: 'center top', at: 'center bottom', of: $post, offset: '0 40'});
}


// ------- Create page

// This is for the ?create page (e.g. GET /some/folder/page?create).
// COULD REFACTOR: Export $loginOnClick, and place initCreateForm() in
// debiki-lift.js, so no ?create page code is in here.
function initCreateForm() {
  var $submitBtn = $('form.dw-f-cr .dw-fi-submit');
  $submitBtn.button().each($loginOnClick(function(event, userName) {
    var text = userName ? 'Create as '+ userName : 'Create as ...';  // i18n
    $(this).val(text);
  }));
}


// ------- SVG

/* {{{ SVG commands

See e.g. http://tutorials.jenkov.com/svg/path-element.html

Cmd Params          Name      Description
M   x,y             moveto    Moves pen to x,y without drawing.
m   x,y             moveto    Relative coordinates (to current pen location).

L   x,y             lineto    Draws a line from current pen location to x,y.
l   x,y             lineto    Relative coordinates.

C   x1,y1 x2,y2 x,y curveto   Draws a cubic Bezier curve from current pen point
                              to x,y. x1,y1 and x2,y2 are start and end control
                              points of the curve, controlling how it bends.
c   x1,y1 x2,y2 x,y curveto   Relative coordinates.

}}} */

// Returns an object with functions that draws SVG arrows between threads,
// to illustrate their relationships. The arrows are drawn in whitespace
// between threads, e.g. on the visibility:hidden .dw-t-vspace elems.
function makeSvgDrawer() {
  function $createSvgRoot() {
    // See:
    // http://svgweb.googlecode.com/svn/trunk/docs/UserManual.html#dynamic_root
    var svg = document.createElementNS(svgns, 'svg');  // need not pass 'true'
    // {{{ appendChild takes long
    // 199ms (100 posts, 2.8 GHz 6 core AMD), in svg.js,
    // because it invokes _processSVGScript, in svg.js:45, which takes 130ms
    // (for a page wit h100 posts and my 2.8 GHz 6 core AMD).
    // Using <empty-svg-node>.cloneNode() has no effect. }}}
    svgweb.appendChild(svg, $(this).get(0));
    $(this).addClass('dw-svg-parent');
  }

  function initRootSvg() {
    // Poll for zoom in/out events, and redraw arrows if zoomed,
    // because svg and html are not resized in the same manner: Unless
    // arrows redrawn, their ends are incorrectly offsett.
    zoomListeners.push(drawEverything);

    // (In the future, here will probably be created a global full window SVG
    // that can draw arrows between any elems.)
  }

  function $initPostSvg() {
    // Create root for contextual replies.
    // An inline thread is drawn above its parent post's body,
    // so an SVG tag is needed in each .dw-p-bdy with any inline thread.
    // (For simplicity, create a <svg> root in all .dw-p-bdy:s.)
    $(this).children('.dw-p-bdy').each($createSvgRoot);

    // Create root for whole post replies.
    var $p = $(this).parent();
    if ($p.hasClass('dw-hor')) {
      // Place the root in the .dw-t-vspace before the reply list.
      $p.addClass('dw-svg-gparnt')
          .children('.dw-t-vspace').each($createSvgRoot);
    } else {
      $p.each($createSvgRoot);
    }
  }

  function findClosestRoot($elem) {
    var $root = $elem.closest('.dw-svg-parent').children('svg');
    if (!$root.length)
      $root = $elem.closest('.dw-svg-gparnt').find('> .dw-svg-parent > svg');
    dieIf(!$root.length, 'No SVG root found [debiki_error_84362qwkghd]');
    return $root;
  }

  // Draws an arrow from a mark to an inline thread.
  function arrowFromMarkToInline($mark, $inlineThread, cache) {
    // COULD make use of `cache'. See arrowFromThreadToReply(…).
    var $bdyBlk = $mark.closest('.dw-p-bdy-blk');
    var $thread = $bdyBlk.closest('.dw-t');
    var horizontalLayout = Boolean($thread.filter('.dw-hor').length);
    var $svgRoot = findClosestRoot($mark);
    // Do not use $svgRoot.offset() as offset, because that seems to be the
    // offset of the northwest-most SVG element in the <svg> tag. Instead,
    // use the parent elem's offset, which works fine since the <svg> has
    // position:absolute, and top = left = 0.
    // Details: When the first <path> is added to the $svgRoot, (at least)
    // Chrome and FireFox change the offset of the <svg> tag to the offset
    // of the <path>. Is that weird?
    var svgOffs = $svgRoot.parent().offset();
    var from = $mark.offset();
    var to = $inlineThread.offset();
    var r = document.createElementNS(svgns, 'path');
    var xs = from.left - svgOffs.left; // start
    var ys = from.top - svgOffs.top;
    var xe = to.left - svgOffs.left; // end
    var ye = to.top - svgOffs.top;
    var strokes;
    if (horizontalLayout) {
      // Change x-start to the right edge of the .dw-p-bdy-blk in which
      // the mark is placed, so the curve won't be drawn over the -blk itself.
      xs = $bdyBlk.offset().left - svgOffs.left + $bdyBlk.outerWidth(false);
      // Move the curve a bit downwards, so it starts and ends in the middle
      // of the lines of text (12-13 px high).
      ys += 9;
      ye += 6;
      // Leave some space between the -blk and the curve, and the curve and
      // the iniline thread.
      xs += 10;
      xe -= 10;
      var dx = 60;
      strokes = 'M '+ xs +' '+ ys +
               ' C '+ (xe-dx) +' '+ (ys) +  // draw     --.
                 ' '+ (xe-dx) +' '+ (ye) +  // Bezier      \
                 ' '+ (xe) +' '+ (ye) +     // curve,       `--
               ' l -6 -6 m 6 6 l -6 6';     // arrow end:  >
    } else {
      // Move y-start to below the .dw-p-bdy-blk in which the mark is placed.
      ys = $bdyBlk.offset().top - svgOffs.top + $bdyBlk.outerHeight(false) + 3;
      // Always start the curve at the same x position, or arrows to
      // different inline threads might overlap (unless the inline threads are
      // sorted by the mark's x position — but x changes and wraps around when
      // the thread width changes).
      xs = $bdyBlk.offset().left - svgOffs.left + 30;
      // Leave space between the arrow head and the inline thread.
      xe -= 13;
      // Make arrow point at middle of [-] (close/open thread button).
      ye += 9;
      // Arrow starting below the .dw-p-bdy-blk, pointing on the inline thread.
      strokes = 'M '+ xs +' '+ ys +
               ' C '+ (xs) +' '+ (ye) +     // draw        |
                 ' '+ (xs+1) +' '+ (ye) +   // Bezier      \
                 ' '+ (xe) +' '+ (ye) +     // curve,       `-
               ' l -6 -6 m 6 6 l -6 6';     // arrow end:  >
    }
    r.setAttribute('d', strokes);
    // The mark ID includes the thread ID. The curve ID will be:
    // 'dw-svg-c_dw-i-m_dw-t-<thread-id>'.
    r.setAttribute('id', 'dw-svg-c_'+ $mark.attr('id'));
                                        // +'_'+ $inlineThread.attr('id'));
    $svgRoot.append(r);
    r = false;
  }

  function arrowFromThreadToReply($thread, $to, cache) {
    // Performance note: It seems the very first call to offset() is very
    // slow, but subsequent calls are fast. So caching the offsets only
    // helps a few percent.
    if (cache.is === undefined) {
      cache.is = 'filled';
      cache.$svgRoot = findClosestRoot($thread);
      // Do not use $svgRoot.offset() — see comment somewhere above, search
      // for "$svgRoot.offset()". COULD merge this somewhat duplicated code?
      cache.svgOffs = cache.$svgRoot.parent().offset();
      cache.horizontalLayout = $thread.filter('.dw-hor').length > 0
      cache.from =
        (cache.horizontalLayout ? $thread.children('.dw-t-vspace') : $thread)
        .offset();
    }
    var to = $to.offset();
    var r = document.createElementNS(svgns, 'path');
    var xs = cache.from.left - cache.svgOffs.left; // start
    var ys = cache.from.top - cache.svgOffs.top;
    var xe = to.left - cache.svgOffs.left; // end
    var ye = to.top - cache.svgOffs.top;
    var strokes;
    if (cache.horizontalLayout) {
      // Thread laid out horizontally, so draw west-east curve:  `------.
      // There's a visibility:hidden div that acts as a placeholder for this
      // curve, and it's been resized properly by the caller.
      xs = cache.from.left - cache.svgOffs.left + 10;
      ys = cache.from.top - cache.svgOffs.top + 3;

      // All curves start in this way.
      var curveStart = function(xs, ys, dx, dy) {
        return 'M '+ xs +' '+ ys +             // draw Bezier   |
              ' C '+ (xs+ 8) +' '+ (ys+dy) +   // curve start   \
                ' '+ (xs+dx) +' '+ (ys+dy);    //                `
      };

      if (xe < xs) {
        // $to is placed to the left of the arrow start. This happens e.g.
        // for [the arrow to the Reply button of the root post].
        // Draw a special north-south curve, that starts just like the west-east
        // curve in the `else' block just below.
        xe += $to.width() * 0.67;
        ye -= 13;
        var dx = 40 - 10;
        var dy = 28;
                                                // draw         \
        strokes = curveStart(xs, ys, dx, dy) +  // Bezier        |
                 ' '+ xe +' '+ ye +             // curve        /
                 ' l -5 -7 m 5 7 l 8 -4';   // arrow end       v
      } else {
        // $to is placed to the right of $thread. Draw west-east curve.
        xe += 10;
        ye -= 13;
        var dx = 40;
        var xm = (xe - xs - dx) / 2;
        var dy = 28;
        var dx2 = 70;
        if (dx2 > xe - xs - dx) {
          // The second Bezier curve would start to the left of where
          // the first one ends. Adjust dx and dx2.
          dx2 = xe - xs - dx + 10;
          dx -= 10;
        }

        strokes = curveStart(xs, ys, dx, dy) +// Bezier   \
                 ' '+ (xs+dx) +' '+ (ys+dy) + // curve     `--
               ' C '+ (xe-dx2) +' '+ (ys+dy+5) +  // 2nd curve
                 ' '+ (xe-9) +' '+ (ye-55) +  //             ------.
                 ' '+ xe +' '+ ye +           //                    \
               ' l -7 -4 m 8 4 l 5 -7'; // arrow end: _|             v
      }
    } else {
      // Draw north-south curve.
      var ym = (ys + ye) / 2;
      strokes = 'M '+ (xs+5) +' '+ (ys+30) +
               ' C '+ xs +' '+ ym +            // curve to child post  |
                 ' '+ xs +' '+ (ye-30) +       //                      \
                 ' '+ (xe-7) +' '+ (ye + 4) +  //                       \
               ' l -8 -1 m 9 1 l 0 -8'; // arrow end: _|                 `>
    }
    r.setAttribute('d', strokes);
    r.setAttribute('id', 'dw-svg-c_'+ $thread.attr('id') +'_'+ $to.attr('id'));
    cache.$svgRoot.append(r);
    r = false;
  }

  function $drawParentsAndTree() {
    $drawParents.apply(this);
    $drawTree.apply(this);
  }

  function $drawParents() {
    $(this).parents('.dw-t').each(function() {
      $drawPost.apply(this);
    });
  }

  // Draw curves from threads to children
  function $drawTree() {
    $('.dw-t', this).add(this).each($drawPost);
  }

  function $drawPost() {
    // This function is a HOTSPOT (shows the Chrome profiler).
    // {{{ Performance notes
    // - $elem.width(…) .height(…) are slow, so <svg> elems are
    //   made excessively wide, in the .css file, so there's no need
    //   to resize them, even if their parent elem is expanded.
    // - The :has filter is slow, so I rewrote to find(...).parent() instead.
    // - The :hidden filter is slow, so I removed it — don't think it's
    //   needed now when arrows are placed in a per thread/post <svg>.
    // - arrowFrom...() are SLOW! because they use $.offset.
    // }}}
    var $i = $(this);
    var $bdy = $('> .dw-p > .dw-p-bdy', this);
    // Remove old curves
    $i.add('> .dw-t-vspace', this).add($bdy).children('svg').each(function() {
      $(this).find('path').remove();
    });
    // Draw arrows to whole post replies, and, for horizontal layout,
    // to the Reply button.
    var $replyBtn = $i.children('.dw-hor-a');
    var $wholePostReplies = $i.find('> .dw-res > .dw-t');
    var cache = {};
    $replyBtn.add($wholePostReplies).each(function(){
      arrowFromThreadToReply($i, $(this), cache);
    });
    // To inline replies.
    $bdy.children('.dw-p-bdy-blk').each(function() {
      var cache = {};
      $(this).find('.dw-i-m-start').each(function() {
        var $mark = $(this);
        var $inlineThread = $(this.hash);
        if ($inlineThread.length) {
          arrowFromMarkToInline($mark, $inlineThread, cache);
        }
      });
    });
  }

  function drawEverything() {
    $('.dw-debate').each(SVG.$drawTree);
  }

  function $highlightOn() {
    // Add highlighting from the SVG path. However, addClass doesn't work
    // with SVG paths, so I've hardcoded the styling stuff here, for now.
    // COULD define dummy invisible SVG tags, with and w/o highlight.
    // And read the values of those tags here. Then I could still specify
    // all CSS stuff in the CSS file, instead of duplicating & hardcoding
    // styles here.
    this.style.stroke = '#f0a005';
    this.style.strokeWidth = 4;
  }

  function $highlightOff() {
    // Remove highlighting from the SVG path.
    // WARNING dupl code: the stroke color & width below is also in debiki.css.
    // See $highlightOn() for more info.
    this.style.stroke = '#dde';
    this.style.strokeWidth = 3;
  }

  return {
    // DO NOT FORGET to update the fake SVG drawer too!
    // And test both with and without SVG enabled.
    initRootSvg: initRootSvg,
    $initPostSvg: $initPostSvg,
    $drawPost: $drawPost,
    $drawTree: $drawTree,
    $drawParents: $drawParents,
    $drawParentsAndTree: $drawParentsAndTree,
    drawEverything: drawEverything,
    $highlightOn: $highlightOn,
    $highlightOff: $highlightOff
  };
}

function makeFakeDrawer() {
  // No SVG support. The svgweb Flash renderer seems far too slow
  // when resizing the Flash screen to e.g. 2000x2000 pixels.
  // And scrolldrag stops working (no idea why). Seems easier
  // to add these images of arrows instead.

  function initialize() {
    // North-south arrows: (for vertical layout)
    $('.dw-depth-0 .dw-t:has(.dw-t)').each(function(){
      $(this).prepend("<div class='dw-svg-fake-varrow'/>");
      $(this).prepend("<div class='dw-svg-fake-varrow-hider-hi'/>");
      $(this).prepend("<div class='dw-svg-fake-varrow-hider-lo'/>");
    });
    $('.dw-depth-1 .dw-t:not(.dw-i-t)').each(function(){
      var hider = $(this).filter(':last-child').length ?
                    ' dw-svg-fake-arrow-hider' : '';
      $(this).prepend('<div class="dw-svg-fake-vcurve-short'+ hider +'"/>');
    });
    $('.dw-depth-1 .dw-t:not(.dw-i-t):last-child').each(function(){
      $(this).prepend("<div class='dw-svg-fake-varrow-hider-left'/>");
    });
    // TODO: Inline threads:  .dw-t:not(.dw-hor) > .dw-i-ts > .dw-i-t
    // TODO: First one:  .dw-t:not(.dw-hor) > .dw-i-ts > .dw-i-t:first-child
    // TODO: Root post's inline threads:  .dw-t.dw-hor > .dw-i-ts > .dw-i-t

    // West-east arrows: (for horizontal Layout)
    var $threads = $('.dw-hor');
    // Arrow start, for horizontal layout, and arrow to reply link.
    $threads.find('> .dw-hor-a > .dw-a').each(function(){
      $(this).before('<div class="dw-svg-fake-hcurve-start"/>');
    });
    // To root post replies
    $threads.find('> .dw-res > li').each($initPostSvg);
    // To inline root post replies
    $threads.find('> .dw-p > .dw-p-bdy > .dw-i-ts > .dw-i-t').each(
        $initPostSvg);
  }

  // Arrows to each child thread.
  function $initPostSvg() {
    var $parentThread = $(this).closest('.dw-t').parent().closest('.dw-t');
    if ($parentThread.filter('.dw-hor').length) {
      // horizontal arrow
      $(this).filter(':not(:last-child)').each(function(){
        $(this).prepend("<div class='dw-svg-fake-harrow'/>");
        $(this).prepend("<div class='dw-svg-fake-harrow-end'/>");
      });
      $(this).prepend('<div class="dw-svg-fake-hcurve"/>');
    } else {
      // vertical arrow, already handled above.
      // TODO not handled above, for *new* threads, no arrows to them :(
      // BUG arrows should be drawn here, for replies to inline threads.
    }
  }

  function $drawParentsAndTree() {}  // ?? do I need to do something?

  function $drawParents() {}  // ?? do I need to do something?

  function $drawTree() {} // TODO

  function $drawPost() {
    // TODO: If any SVG native support: draw arrows to inline threads?
    // Or implement via fake .png arrows?
  }

  function drawEverything() {}

  function $highlightOn() {
    // TODO replace arrow image with a highlighted version
  }

  function $highlightOff() {
    // TODO replace arrow image with a highlighted version
  }

  return {
    initRootSvg: initialize,
    $initPostSvg: $initPostSvg,
    $drawPost: $drawPost,
    $drawTree: $drawTree,
    $drawParents: $drawParents,
    $drawParentsAndTree: $drawParentsAndTree,
    drawEverything: drawEverything,
    $highlightOn: $highlightOn,
    $highlightOff: $highlightOff
  };
}


// ------- Miscellaneous

function die(message) {
  throw new Error(message);
}

function dieIf(test, message) {
  if (test) throw new Error(message);
}

function bugIf(test, errorGuid) {
  if (test) throw new Error('Internal error ['+ errorGuid +']');
}

jQuery.fn.dwBugIfEmpty = function(errorGuid) {
  bugIf(!this.length, errorGuid);
  return this;
};

// Applies the clearfix fix to `thread' iff it has no child threads.
function clearfix(thread) {
  if (!thread.find(':has(.dw-t)').length) {
    thread.addClass('ui-helper-clearfix');
  }
}

// Finds all tags with an id attribute, and (hopefully) makes
// the ids unique by appending a unique (within this Web page) number to
// the ids. Updates any <label> `for' attributes to match the new ids.
// If hrefStart specified, appends the unique number to hrefs that starts
// with hrefStart.  (This is useful e.g. if many instances of a jQuery UI
// widget is to be instantiated, and widget internal stuff reference other
// widget internal stuff via ids.)
function makeIdsUniqueUpdateLabels(jqueryObj, hrefStart) {
  var seqNo = '_sno-'+ (++idSuffixSequence);
  jqueryObj.find("*[id]").each(function(ix) {
      $(this).attr('id', $(this).attr('id') + seqNo);
    });
  jqueryObj.find('label').each(function(ix) {
      $(this).attr('for', $(this).attr('for') + seqNo);
    });
  jqueryObj.find('*[href^='+ hrefStart + ']').each(function(ix) {
    $(this).attr('href', this.hash + seqNo);
  });
}

function buildTagFind(html, selector) {
  if (selector.indexOf('#') !== -1) die('Cannot lookup by ID: '+
      'getElementById might return false, so use buildTagFindId instead');
  // From jQuery 1.4.2, jQuery.fn.load():
  var $wrap =
      // Create a dummy div to hold the results
      jQuery('<div />')
      // inject the contents of the document in, removing the scripts
      // to avoid any 'Permission Denied' errors in IE
      .append(html.replace(/<script(.|\s)*?\/script>/gi, ''));
  var $tag = $wrap.find(selector);
  return $tag;
}

// Builds HTML tags from `html' and returns the tag with the specified id.
// Works also when $.find('#id') won't (because of corrupt XML?).
function buildTagFindId(html, id) {
  if (id.indexOf('#') !== -1) die('Include no # in id [debiki_error_985x2jh]');
  var $tag = buildTagFind(html, '[id="'+ id +'"]');
  return $tag;
}

// `then' and `now' can be Date:s or milliseconds.
// Consider using: https://github.com/rmm5t/jquery-timeago.git, supports i18n.
function prettyTimeBetween(then, now) {  // i18n
  var thenMillis = then.getTime ? then.getTime() : then;
  var nowMillis = now.getTime ? now.getTime() : now;
  var diff = nowMillis - thenMillis;
  var second = 1000;
  var minute = second * 60;
  var hour = second * 3600;
  var day = hour * 24;
  var week = day * 7;
  var month = day * 31 * 30 / 2;  // integer
  var year = day * 365;
  // I prefer `30 hours ago' to `1 day ago', but `2 days ago' to `50 hours ago'.
  if (diff > 2 * year) return trunc(diff / year) +" years ago";
  if (diff > 2 * month) return trunc(diff / month) +" months ago";
  if (diff > 2 * week) return trunc(diff / week) +" weeks ago";
  if (diff > 2 * day) return trunc(diff / day) +" days ago";
  if (diff > 2 * hour) return trunc(diff / hour) +" hours ago";
  if (diff > 2 * minute) return trunc(diff / minute) +" minutes ago";
  if (diff > 1 * minute) return "1 minute ago";
  if (diff > 2 * second) return trunc(diff / second) +" seconds ago";
  if (diff > 1 * second) return "1 second ago";
  return "0 seconds ago";
}


// ------- Initialization functions

function enableDragScroll() {
  // This takes perhaps 70 ms (on my 2.8 GHz 6 core AMD)
  // and should thus not be done on page load. (jQuery takes long
  // when finding all elements that match the selectors.)
  var selectors = Settings.draggableInternal + Settings.draggableCustom;
  $('body').debiki_dragscrollable({
            dragSelector: selectors, scrollable: selectors });
}

function registerEventHandlers() {
  $('#dw-a-login').click(showLoginSimple);
  $('#dw-a-logout').click(showLogout);

  // On post text click, open the inline action menu.
  // But hide it on mousedown, so the inline action menu disappears when you
  // start the 2nd click of a double click, and appears first when the 2nd
  // click is completed. Otherwise the inline menu gets in the
  // way when you double click to select whole words. (Or triple click to
  // select paragraphs.)
  $('.debiki').delegate('.dw-p-bdy-blk', 'mouseup', $showInlineActionMenu)
      .delegate('.dw-p-bdy-blk', 'mousedown', $hideInlineActionMenu);

  // Remove new-reply and rating forms on cancel, but 
  // the edit form has some own special logic.
  $('.debiki').delegate(
      '.dw-fs-re .dw-fi-cancel, ' +
      '.dw-fs-rat .dw-fi-cancel',
      'click', $removeClosestForms);

  window.onbeforeunload = confirmClosePage;

  // Hide all action forms, since they will be slided in.
  $('#dw-hidden-templates .dw-fs').hide();

  // Show more rating tags when clicking the "More..." button.
  rateFormTemplate.find('.dw-show-more-rat-tags').click($showMoreRatingTags);


  // Show a change diff instead of the post text, when hovering an edit
  // suggestion.
  $('.debiki')
      .delegate('.dw-es', 'mouseenter', function(){
        // COULD move find(...) to inside $showEditDiff?
        // (Don't want such logic placed down here.)
        $(this).find('.dw-ed-text').each($showEditDiff);
      })
      .delegate('.dw-ess', 'mouseleave', $removeEditDiff);

  $('.debiki').delegate('.dw-a-edit-new', 'click', $showEditForm);

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
  if (Me.isLoggedIn()) fireLogin();
  else fireLogout();
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

(function() {
  var $posts = $(".debiki .dw-p");
  function initPostsThreadStep1() { $posts.each($initPostsThreadStep1) }
  function initPostsThreadStep2() { $posts.each($initPostsThreadStep2) }
  function initPostsThreadStep3() { $posts.each($initPostsThreadStep3) }
  function initPostsThreadStep4() { $posts.each($initPostsThreadStep4) }

  $('body').addClass('dw-pri');
  resizeRootThread();
  Me.refreshProps();

  var steps = [];
  steps.push(initPostsThreadStep1);
  if (!Modernizr.touch) steps.push(enableDragScroll);
  steps.push(initPostsThreadStep2);
  steps.push(initPostsThreadStep3);
  steps.push(registerEventHandlers);
  steps.push(initAndDrawSvg);
  steps.push(initPostsThreadStep4);

  function runNextStep() {
    steps[0]();
    steps.shift();
    if (steps.length > 0)
      setTimeout(runNextStep, 100);
  }

  setTimeout(runNextStep, 100);
})();


//----------------------------------------
   }); // end jQuery onload
//----------------------------------------

//========================================
   }()); // end Debiki module
//========================================

