// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

// In this file:
// - jQuery extension functinos, prefixed with "dw_" to avoid name clashes
// - The implementation of the Debiki module
// - A jQuery onload handler

//"use strict;"

Debiki = {};  // TODO: Error handling?
Debiki.v0 = {};

//========================================
   (function(){
//========================================

//----------------------------------------
// jQuery object extensions
//----------------------------------------

jQuery.fn.dw_disable = function() {
  return this.each(function(){ jQuery(this).attr('disabled', 'disabled'); });
};

jQuery.fn.dw_enable = function() {
  return this.each(function(){ jQuery(this).removeAttr('disabled'); });
};

jQuery.fn.dw_postModTime = function() {
  return this.find(
      '.dw-post-info .dw-last-changed .dw-date').attr('title');
};

//----------------------------------------
// Customizable functions: Default implementations
//----------------------------------------

var Settings = {};

Settings.makeEditUrl = function(debateId, postId) {
  // Default:
  return debateId +'/edits/proposed/post/'+ postId +'.html'
};

Settings.makeRatePostUrl = function(debateId, postId) {
  // Default:
  // (Firefox doesn't accept an Ajax post request "" (i.e. the same page);
  // nsIXMLHttpRequest.open fails with NS_ERROR_ILLEGAL_VALUE.)
  return '?';
};

Settings.makeReplyUrl = function(debateId, postId) {
  return '?';
}

Settings.replyFormLoader = function(debateId, postId, complete) {
  // Simply clone a hidden reply form template.
  var $replyForm = jQuery('#dw-hidden-templates .dw-fs-re').clone(true);
  $replyForm.find("input[name='dw-fi-post']").attr('value', postId);
  complete($replyForm);
}

Settings.replyFormSubmitter = function(debateId, postId, complete) {
  // This worked with JSPWiki:
  // $.post(Settings.makeReplyUrl(debateId, postId),
  //    $replyForm.children('form').serialize(), complete, 'html');
  // By default, post no reply.
  alert("Cannot post reply. [debiki_error_85ei23rnir]");
}

Settings.editFormLoader = function(debateId, postId, complete) {
  alert('Edits not implemented. [debiki_error_239sx8]');
}

Settings.editFormSubmitter = function(debateId, postId, complete) {
  // This worked with JSPWiki:
  // $.post(Settings.makeReplyUrl(debateId, postId),
  //    $replyForm.children('form').serialize(), complete, 'html');
  // By default, post no reply.
  alert("Edits not implemented. [debiki_error_19x3g35]");
}

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

// Onload
//----------------------------------------
   jQuery.noConflict()(function($){
//----------------------------------------

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
var idSuffixSequence = 0

// Reset all per click state variables when a new click starts.
$.event.add(document, "mousedown", function() {
  didExpandTruncated = false;
  //didResize = false; -- currently handled in another mousedown
});


// ------- Zoom event

var zoomListeners = [];

(function(){
  // Poll the pixel width of the window; invoke zoom listeners
  // if the width has been changed.
  var lastWidth = 0;
  function pollZoomFireEvent() {
    var widthNow = jQuery(window).width();
    if (lastWidth == widthNow) return;
    lastWidth = widthNow;
    // Length changed, user must have zoomed, invoke listeners.
    for (i = zoomListeners.length - 1; i >= 0; --i) {
      zoomListeners[i]();
    }
  }
  setInterval(pollZoomFireEvent, 100);
})();

// ------- Open/close

// Open/close threads if the thread-info div is clicked.
$('.debiki').delegate('.dw-z', 'click', function() {
  var thread = $(this).closest(".dw-t");
  resizeRootThreadExtraWide();
  thread.
    find('> :not(.dw-p, .dw-z, .dw-svg-fake-vcurve-short, '+
        '.dw-svg-fake-harrow, .dw-svg-fake-harrow-end, '+
        '.dw-svg-fake-hcurve, .dw-svg-fake-hcurve-start), '+
        '> .dw-p > .dw-p-bdy, '+
        '> .dw-a').
      //add(thread.find('> .dw-p > .dw-p-bdy')).
      stop(true,true).
      slideToggle(800).
      //queue(function(next){
      //    thread
      //      .toggleClass('dw-zd')
      //      .toggleClass('dw-zd-fx', 600);
      //    next();
      //  }).
      queue(function(next){ resizeRootThreadNowAndLater(); next(); }).
    end().
    children(".dw-z").
      each(function(){
        // The – is not a - but an &endash;.
        var newText = $(this).text().indexOf('+') == -1 ? '[+]' : '[–]';
        $(this).text(newText);
      });
});


// ------- Outlining

// Outline new posts
/*
(function(){
  var myLastVersion = $.cookie('myLastPageVersion');
  if (!myLastVersion) return;
  var newPosts = posts.filter(function(index){ // BUG?…
    //… relied on posts = $('.debiki .dw-p-bdy') but use '*.dw-p' instead?
    return $(this).dw_postModTime() > myLastVersion;
  })
  newPosts.closest('.dw-t').addClass('dw-post-new');
  // TODO: sometimes .dw-post-edited instead of -new
})()
*/


// ------- Resizing

// Makes the root thread wide enough to contain all its child posts.
// Is this not done e.g. when child posts are resized or stacked eastwards,
// or a reply/rate/edit form is shown/resized, the east-most threads
// will float-drop below the other threads.
var resizeRootThreadImpl = function(extraWidth){
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

  // Something has been resized, so parent-->child thread bezier curves
  // might need to be redrawn.
  SVG.drawRelationships();
}

// Finds the width of the widest [paragraph plus inline threads].
function $findMaxInlineWidth(){
  var accWidth = 0;
  var maxWidth = 0;
  $(this).find('> .dw-p > .dw-p-bdy').children().each(function(){
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
var resizeRootThread = function(){
  resizeRootThreadImpl();
}

// Resizes the root thread so it becomes extra wide.
// This almost avoids all float drops, when quickly resizing an element
// (making it larger).
var resizeRootThreadExtraWide = function() {
  resizeRootThreadImpl(true);
}

// Export resize functions, for debugging.
// (Otherwise too late to export from here, inside onload event?)
Debiki.v0.resizeRootThread = resizeRootThread;
Debiki.v0.resizeRootThreadExtraWide = resizeRootThreadExtraWide;

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
  }
})();

// Makes [threads layed out vertically] resizable.
function $makeEastResizable() {
  $(this).resizable({
    resize: resizeRootThreadExtraWide,
    handles: 'e',
    stop: function(event, ui) {
      // jQuery has added `height: ...' to the thread's style attribute.
      // Unless removed, the therad won't resize itself when child
      // threads are opened/closed.
      $(this).css('height', null);
      resizeRootThreadNowAndLater();
    }
  });
}

// Make posts and threads resizable.
// Fails with a TypeError on Android: Cathching it and ignoring it.
// (On Android, posts and threads won't be resizable.)
function $makePostResizable() {
  var $expandSouth = function() {
    // Expand post southwards on resize handle click. But not if
    // the resize handle was dragged and the post thus manually resized.
    if (didResize) return;
    $(this).closest('.dw-p')
        .css('height', null).removeClass('dw-p-rez-s');
  }
  var $expandEast = function() {
    // Expand post eastwards on resize east handle click.
    if (didResize) return;
    $(this).closest('.dw-p')
        .css('width', null).removeClass('dw-p-rez-e');
  }
  var $expandSouthEast = function() {
    $expandSouth.apply(this);
    $expandEast.apply(this);
  }

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
        }
      }
    })
  .end()
  .resizable({
      autoHide: true,
      start: function(event, ui) {
        $post = $(this).closest('.dw-p');
        // Remember that this post is being resized, so heigh and width
        // are not removed on mouse up.
        didResize = true;
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
      didResize = false;
    })
  .end();
  }
  catch (e) {
    if (e.name == 'TypeError') console.log(e.name +': Failed to make '+
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
function updateDebate(newDebateHtml) {
  var $curDebate = $('.dw-debate');
  var $newDebate = buildTagFind(newDebateHtml, '.dw-debate');
  $newDebate.find('.dw-t').each(function(){
      var parentId = $(this).parents('.dw-t').attr('id');
      var $oldParent = parentId ? $curDebate.find('#'+ parentId) : $curDebate;
      var $oldThis = $curDebate.find('#'+ this.id);
      var isNewThread = $oldThis.length == 0;
      var isSubThread = !$oldParent.length;
      var isPostEdited = !isNewThread &&
              $oldThis.children('.dw-p').dw_postModTime() <
              $(this).children('.dw-p').dw_postModTime();
      // TODO: Some more jQuery should be registered below, e.g. resizing.
      if (isPostEdited) {
        $(this).children('.dw-p')
          .replaceAll($oldThis.children('.dw-p'))
          .addClass('dw-post-edited'); // outlines it - TODO: Add to cmt not cmt-bdy
      }
      else if (isNewThread && !isSubThread) {
        // (A thread that *is* a sub-thread of another new thread, is added
        // automatically when that other new thread is added.)
        var $res = $oldParent.children('.dw-res');
        if (!$res.length) {
          // This is the first reply; create the reply list.
          $res = $("<ol class='dw-res'/>").appendTo($oldParent);
        }
        $(this)
          .addClass('dw-post-new') // outlines it, and its sub thread posts
          .prependTo($res)
          .each(SVG.$updateThreadGraphics);
      }
      else
        return;
      $(this).each($initPost);
    })
}

// ------- Tag Dog

// The tag dog searches text inside html tags, without being so very
// confused by tags and attributes.
var tagDog = (function(){
  var sniffAndMem;
  return {
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
})();

// ------- Posts

// Replace .dw-as links with reply/edit/rate links (visible on hover).
$(".debiki .dw-p").each($initPost);

function $initPost(){
  // TODO rewrite-rename to initThread, which handles whole subtrees at once.
  // Then, $(".debiki .dw-p").each($initPost)
  // would be changed to $('#dw-root').each($initThread).
  // And call $placeInlineMarks and $placeInlineThreads from here.

  var $thread = $(this).closest('.dw-t');
  $thread.find('> .dw-as').replaceWith(
      $('#dw-action-menu > .dw-a')
        .clone()
        .css('visibility', 'hidden'));
  // Initially, hide edit suggestions.
  $thread.children('.dw-ess, .dw-a-edit-new').hide();

  // $makeEastResizable must be called before $makePostResizable,
  // or $makeEastResizable has no effect. No idea why -- my guess
  // is some jQuery code does something similar to `$.find(..)',
  // and finds the wrong resizable stuff,
  // if the *inner* tag is made resizable before the *outer* tag.
  // (Note that $makePostResizable is invoked on a $thread *child*.)
  $thread.filter('.dw-depth-1').each($makeEastResizable);
  // Show actions when hovering post.
  // But always show the leftmost Reply, at depth-0, that creates a new column.
  // (Better avoid delegates for frequent events such as mouseenter.)
  $thread.filter(':not(.dw-depth-0)').children('.dw-p')
    .mouseenter($showActions)
    .each($makePostResizable);
  updateAuthorInfo($thread, $.cookie('dwUserName'));
}

// Extracts markup source from html.
function $htmlToMarkup() {
  var mup = '';
  $(this).find('p').each(function(){ mup += $(this).text() +'\n\n'; });
  return mup.trim() +'\n';
}

// Places marks where inline threads are to be placed.
// This is a mark:  <a class='dw-i-m-start' href='#dw-t-(thread_id)' />
function $placeInlineMarks() {
  $('.dw-i-t', this).each(function(){
    // Search the parent post for the text where this mark starts.
    // Insert a mark (i.e. an <a/> tag) and render the parent post again.
    var markStartText = $(this).attr('data-dw-i-t-where');
    var $parentPostBody =
        $(this).parent().closest('.dw-t').find('> .dw-p > .dw-p-bdy');
    var tagDogText = tagDog.sniffHtml($parentPostBody);
    var loc = 10; // TODO should be included in the data attr
    var match = diffMatchPatch.match_main(tagDogText, markStartText, loc);
    var mark = // TODO underline matched text? or something
        '<a class="dw-i-m-start" href="#'+ this.id +'">[IM]</a>'; // for now
    if (match == -1) {
      // Text not found. Has the parent post been edited since the mark
      // was set? Should diffMatchPatch.Match_Distance and other settings
      // be tweaked?
      // TODO How to indicate that no match was found?
      $parentPostBody.prepend(mark.replace('[IM]', '[??]')); // for now
      return;
    }
    var beforeMatch = tagDogText.substring(0, match);
    var afterMatch = tagDogText.substring(match, 999999);
    var tagDogTextWithMark = [beforeMatch, mark, afterMatch].join('');
    var bodyWithMark =
        ['<div class="dw-p-bdy">',
          tagDog.barkHtml(tagDogTextWithMark),
          '</div>'].join('');
    $parentPostBody.replaceWith(bodyWithMark);

    // Or simply:
    // var htmlWithMark = tagDogsniffAndMark(markStartText, $parentPostBody);
    // $parentPostBody.replace($(htmlWithMark));
  });
}

// Places inline threads at the relevant inline marks, so the threads
// become inlined.
function $placeInlineThreads() {
  // For each inline-thread mark start (-i-m-start), move the
  // relevant post from the reply list to after the paragraph in
  // which the anchor is placed. (We cannot place the inline thread
  // in the <p> itself, since a <p> cannot contain block-level elements.)
  // The inline thread already has a CSS class that place it to the right of,
  // or below, the <p>.
  $('.dw-i-m-start', this).each(function(){
    var threadRef = $(this).attr('href'); // will be '#dw-t-<id>'
    $inlineThread = $(threadRef); // TODO change from <li> to <div>
    $(this).closest('p').after($inlineThread);
  });

  // Wrap all body elems in <div>s. In debiki.css, these divs are
  // placed to the left and the inline threads to the right.
  // COULD tag each dw-p-bdy child with a .dw-p-bdy-blk, and skip
  // the extra  <div>?
  // WOULD include the .dw-p-bdy-blk in the server generated html,
  // hadn't I been concerned about bandwidth usage — lots of paragraphs?
  $('.dw-p-bdy', this).each(function() {
    $(this).children(':not(.dw-i-t)').wrap(
      '<div class="dw-p-bdy-blk"></div>'
    );
  });
}

$('.dw-depth-0').each($placeInlineMarks);
$('.dw-depth-0').each($placeInlineThreads);


// ------- Inline actions

// On post text click, open a menu with Inline Reply and
// Edit endries.
// For now: Don't open a menu, assume a click means an inline reply.

$('.debiki').delegate('.dw-p-bdy-blk', 'click', function(event){
  if ($(event.target).closest('.dw-fs').length) {
    // A form was clicked. Ignore click.
    return;
  }
  if (didExpandTruncated) {
    // The post is truncated. This click expands it; don't
    // let the click result in a reply form appearing, too.
    return;
  }
  var sel = window.getSelection();
  if (!sel.baseNode.data ||
      sel.baseNode.data.substr(sel.baseOffset, 1).length == 0) {
    // No text clicked. Ignore.
    return;
  }

  // Find out what piece of text was cliced or selected.
  // See: http://stackoverflow.com/questions/3968520/how-to-use-jquery-prevall-to-select-nearby-text-nodes/3968929#3968929

  // If the user clicked e.g. inside a short <b> tag, the range might be only a 
  // few characters long, and these few characters might occur somewhere else
  // in the same post. This could result in Google's diff-match-patch finding 
  // the wrong occurrance.
  // jQuery(window.getSelection().baseNode).parent().parent().contents()

  // TODO: Find out where to show the menu. And show menu.
  // TODO: Show a mark where the click was? See insertNodeAtCursor here: http://stackoverflow.com/questions/2213376/how-to-find-cursor-position-in-a-contenteditable-div/2213514#2213514
  // Use event.clientX, event.clientY.

  // For now: pretend the user clicked Reply and open an inline reply form.
  $showReplyForm.apply(this, [event]);
});


// ------- Forms and actions

// Shows actions for the current post, or the last post hovered.
var $lastActions = null;
function $showActions() {
  if ($lastActions) {
    $lastActions.closest('.dw-t').children('.dw-a')
      // Leave the new-edit button always visible, since it's
      // placed a bit away from the post, so it wouldn't be obvious
      // that you needed to hover the post to show the action.
      .not('.dw-a-edit-new')
      .css('visibility', 'hidden');
  }
  $lastActions = $(this);
  $lastActions.closest('.dw-t').children('.dw-a')
    .css('visibility', 'visible');
}

// Action <form> cancel button -- won't work for the Edit form...?
function slideAwayRemove($form) {
  // Slide away <form> and remove it.
  var $parent = $form.parent();
  function rm(next) { $form.remove(); resizeRootThread(); next(); }
  if ($parent.filter('.dw-depth-0, .dw-debate').length)
    $form.hide('fold', 800).queue(rm);
  else $form.slideUp(530).queue(rm);
};

// Remove new-reply and rating forms on cancel, but 
// the edit form has some own special logic.
$('.debiki').delegate(
    '.dw-fs-re .dw-fi-cancel, ' +
    '.dw-fs-rat .dw-fi-cancel',
    'click', function(){ slideAwayRemove($(this).closest('.dw-fs')); });

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
  if ($where.filter('.dw-depth-0, .dw-debate').length) $form.show('fold', 800);
  else $form.slideDown(530);
  // Cancel extra width. Or add even more width, to prevent float drops
  // -- needs to be done also when sliding downwards, since that sometimes 
  // makes the root thread child threads wider.
  $form.queue(function(next){
      resizeRootThreadNowAndLater();
      next();
    });
}

// Hide all action forms, since they will be slided in.
$('#dw-hidden-templates .dw-fs').hide();

function dismissActionMenu() {
  $('#dw-action-menu').appendTo($('#dw-hidden-templates'));
}

// ------- User name

// Remembers the user name in a cookie, synchronizes with
// edit/reply forms. Adds .dw-mine class to all posts by someone
// with the new name.
function syncUserName($form) {
  // Match on the start of the id, since makeIdsUniqueUpdateLabels might
  // have appended a unique suffix.
  var $nameInput = $form.find("input[id^='dw-fi-reply-author']");
  $nameInput.val($.cookie('dwUserName') || 'Anonymous');
  $nameInput.blur(function(){
      var name = $nameInput.val();
      $.cookie('dwUserName', name);
      $('.debiki .dw-t').each(function(){
          updateAuthorInfo($(this), name); });
    });
}

function updateAuthorInfo($post, name) {
  var by = $post.find('> .dw-p .dw-p-by').text();
  if (by == name) $post.addClass('dw-mine');
}

// Add .dw-mine class to all .dw-t:s written by this user.
$('.debiki .dw-t').each(function(){
    updateAuthorInfo($(this), $.cookie('dwUserName'));
  });


// ------- Rating

$('.debiki').delegate('.dw-a-rate', 'click', function() {
  // Warning: Some duplicated code, see .dw-a-reply and
  // dw-a-edit-new click() below.
  var thread = $(this).closest('.dw-t');
  clearfix(thread); // ensures the rating appears nested inside the thread
  var $post = thread.children('.dw-p');
  var $rateForm = rateFormTemplate.clone(true); // TODO: Rename to $formWrap?
  var postId = $post.attr('id').substr(8, 999); // drop initial 'dw-post-'
  $rateForm.find("input[name='dw-fi-post']").attr('value', postId);

  // The rating-value inputs are labeled checkboxes. Hence they
  // have ids --- which right now remain the same as the ids
  // in the rateFormTemplate. Make the cloned ids unique:
  makeIdsUniqueUpdateLabels($rateForm);

  // Enable submit button when ratings specified
  $rateForm.find("input[type='checkbox']").click(function(){
    $rateForm.find("input[type='submit']").button("option", "disabled", false);
  });

  // Set user name input.
  $rateForm.find("input[name='dw-fi-by']").val(
      $.cookie('dwUserName') || 'Anonymous');

  // Ajax-post ratings on submit.
  //  - Disable form until request completed.
  //  - When completed, highlight the user's own ratings.
  $rateForm.submit(function(){
    // Find rating tags selected
    var ratedTags = $rateForm.find("input:checked").map(function(){
      return $(this).val().toLowerCase();
    }).get();

    $.post(Settings.makeRatePostUrl(debateId, postId),
          $rateForm.children('form').serialize(), function(data){

        // Find the new version of the post, with new ratings.
        var $wrap =
            // From jQuery 1.4.2, jQuery.fn.load():
            // Create a dummy div to hold the results
            jQuery('<div />')
            // inject the contents of the document in, removing the scripts
            // to avoid any 'Permission Denied' errors in IE
            .append(data.replace(/<script(.|\s)*?\/script>/gi, ''));
        // Don't lookup by id -- won't work for certain documents
        // (at leat not for JSPWiki pages), because somewhere inside
        // jQuery Sizzle, getElementById returns 'false'.
        // Don't: $wrap.find('#'+ $post.attr('id'));
        // This works:
        var $newPost = $wrap.find('.dw-p[id="dw-post-' + postId + '"]');
        $newPost.replaceAll($post);

        // Highligt the user's ratings.
        $newPost.find('.dw-rats .dw-rat').each(function(){
            // .dw-rat text is e.g. " interesting 80% ". Make lowercase,
            // and drop " 80% ", so tag-name comparison works.
            var text = $(this).text().toLowerCase().replace(/ \d+% /, '');
            for (ix in ratedTags) {
              if ($.trim(text) == ratedTags[ix]) {
                $(this).addClass('dw-you-rated');
                break;
              }
            }
          });

        $newPost.each($initPost);
        slideAwayRemove($rateForm);
      }, 'html');

    $rateForm.find('input').dw_disable();
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
  dismissActionMenu();
});

// Show more rating tags when clicking the "More..." button.
rateFormTemplate.find('.dw-more-rat-tags').hide();
rateFormTemplate.find('.dw-show-more-rat-tags').show().
  click(function() {
    $(this).hide().
      closest('form').find('.dw-more-rat-tags').show();
  });


// ------- Replying

$('.debiki').delegate('.dw-a-reply', 'click', $showReplyForm);

// Shows a reply form, either below the relevant post, or inside it,
// if the reply is an inline comment -- whichever is the case is determined
// by event.target.
function $showReplyForm(event) {
  // Warning: Some duplicated code, see .dw-rat-tag and
  // dw-a-edit-new click() above.
  var $post;
  var postId = 'root'; // means is-reply-to-the-article-itself, TODO: 'A'
  var $thread = $(this).closest('.dw-t');
  if ($thread.length) {
    // Change postId to refer to the comment not the article.
    clearfix($thread); // ensures the reply appears nested inside the thread
    $post = $thread.children('.dw-p');
    if ($post.length)
      postId = $post.attr('id').substr(8, 999); // drop initial "dw-post-"
    else {
      // There's no parent post -- leave postId = 'root', which means
      // a reply to the article (e.g. blog post) itself.
    }
  }
  else {
    $thread = $(this).closest('.dw-debate');
  }
  // Create a reply form, or Ajax-load it (depending on the Web framework
  // specifics).
  Settings.replyFormLoader(debateId, postId, function($replyFormParent) {
    var $replyForm = $replyFormParent.children('form');
    syncUserName($replyForm);
    makeIdsUniqueUpdateLabels($replyForm);
    $replyForm.resizable({
        alsoResize: $replyForm.find('textarea'),
        resize: resizeRootThreadExtraWide, // TODO rm textarea width?
        stop: resizeRootThreadNowAndLater
      });

    // Ajax-post reply on submit.
    $replyForm.submit(function() {
      Settings.replyFormSubmitter($replyForm, debateId, postId,
        function(newDebateHtml){
          // The server has replied. Merge in the data from the server
          // (i.e. the new post) in the debate, and remove the form.
          updateDebate(newDebateHtml);
          slideAwayRemove($replyFormParent);
        });
      // Disable the form; it's been submitted.
      $replyForm.find('input').dw_disable();
      return false;
    });

    // Fancy fancy
    $replyForm.find('.dw-submit-set input').button();
    $replyForm.find('label').addClass(
      // color and font matching <input> buttons
      'dw-ui-state-default-color dw-ui-widget-font');

    if ($(event.target).closest('.dw-p-bdy').length) {
      // The post body was clicked, which means the user replies to a specific 
      // piece of text inside the post but not to the whole post.

      // BUG: Triggered if a Reply btn clicked in an inline post.

      if ($(event.target).closest('.dw-fs').length) {
        // Clicks on forms in the post body should not result in this
        // function being called. Bug.
        throw Error('A form was clicked [debiki_error_67xr21]');
      }

      // Place the reply inline, where the textClicked.selection ends.
      var sel = window.getSelection();
      $(sel.extentNode).closest('.dw-p-bdy-blk').after($replyFormParent);
      // Fill in the `where' form field with the text where the
      // click/selection was made. Google's diff-match-patch can match
      // only 32 chars so specify only 32 chars.
      // (All selected text: sel.getRangeAt(0).toString().substr(0,32);
      // but we're interested in the start and end of the selection/click.)
      // TODO Consider using http://code.google.com/p/ierange/, so this stuff
      // works also with IE (6)/7/8.
      var textStart = sel.baseNode.data.substr(sel.baseOffset, 32)
      var textEnd = sel.extentNode.data.substr(sel.extentOffset, 32)
      $replyForm.find('input[id^="dw-fi-reply-where"]').val(textStart);
    }
    else {
      // Place the form below the post, in the .dw-res list.
      var $res = $thread.children('.dw-res');
      if (!$res.length) {
        // This is the first reply; create the reply list. // TODO: DUPL CODE
        $res = $("<ol class='dw-res'/>").appendTo($thread);
      }
      $res.prepend($replyFormParent.hide());
    }
    $replyFormParent.each(SVG.$updateThreadGraphics);
    slideInActionForm($replyFormParent);
  });
  dismissActionMenu();
};

// ------- Editing

// On Edit button click, show edit suggestions, and a new-suggestion button.
$('.debiki').delegate('.dw-a-edit', 'click', function() {
  $(this).closest('.dw-t').children('.dw-ess, .dw-a-edit-new')
      .stop(true,true)
      .slideToggle(500);
});

// Show a change diff instead of the post text, when hovering an edit 
// suggestion.
$('.debiki')
    .delegate('.dw-es', 'mouseenter', function(){
      $(this).find('.dw-ed-text').each($showEditDiff);
    })
    .delegate('.dw-ess', 'mouseleave', $removeEditDiff);

// Hides the closest post text; shows a diff instead,
// of the-text-of-the-post and $(this).val() or .text().
// $removeEditDiff shows the post again.
function $showEditDiff() {
  // Find the closest post
  var $post = $(this).closest('.dw-t').children('.dw-p');
  var height = $post.height();
  // Remove any old diff
  var $oldDiff = $post.children('.dw-p-diff');
  $oldDiff.remove();
  // Extract the post's current text.
  var $postBody = $post.children('.dw-p-bdy');
  var oldText = $postBody.map($htmlToMarkup)[0];
  // Try both val() and text() -- `this' might be a textarea or
  // an elem with text inside.
  var newText = $(this).val();
  if (newText == '') newText = $(this).text();
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
  //$post.css('height', null);
  //$post.css('height', $post.height() + 50 +'px');
  //$post.height(height + ($oldDiff.length ? 0 : 75));
  $post.height(height);
  $post.css('overflow-y', 'auto');
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
  var i = 0;
  var pattern_amp = /&/g;
  var pattern_lt = /</g;
  var pattern_gt = />/g;
  var pattern_para = /\n/g;
  for (var x = 0; x < diffs.length; x++) {
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

// New edit suggestion
$('.debiki').delegate('.dw-a-edit-new', 'click', function() {
  // Warning: Some duplicated code, see .dw-rat-tag and .dw-a-reply click() above.
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
  dismissActionMenu();  // before ajax request, or 2 edit <forms> will
                        // appear if you double click.

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

    syncUserName($editsYoursForm);

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
        alsoResize: $editTextArea
        // (Need not resizeRootThread,
        // since the $editDiv is not resized.)
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
        $(this).closest('form').slideUp().queue(function(next){
            if ($editsPendingForm.is(':visible') +
                $editsYoursForm.is(':visible') +
                $editsAppliedForm.is(':visible') == 0)
              slideAwayRemove($editDiv);
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
        { collapsible: true, active: (numElems == 1 ? 0 : false),
          autoHeight: false, fillSpace: true, icons: false });
      });
  });
});

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

// ------- SVG

// Add more space between a post and its children, if the post is layed out
// horizontally, since then a horizontal arrow will be drawn from the post
// to its child posts.
$('.dw-t-vspace').css('height', '80px')

SVG = {};

if (this.svgweb && svgweb.getHandlerType() == 'native' &&
    document.URL.indexOf('svg=true') != -1) {(function(){
  SVG.$win = $('#dw-svg-win');
  SVG.XML_NS = 'http://www.w3.org/2000/svg';

  SVG.curveTreadToReply = function($thread, $to) {
    var from = $thread.offset(), to = $to.offset(); // from, to
    var r = document.createElementNS(SVG.XML_NS, 'path');
    var xs = from.left - SVG.winoffs.left; // start
    var ys = from.top - SVG.winoffs.top;
    var xe = to.left - SVG.winoffs.left; // end
    var ye = to.top - SVG.winoffs.top;
    var strokes;
    if ($thread.filter('.dw-hor').length) {
      // Thread laid out horizontally, so draw west-east curve:  `------.
      // There's a visibility:hidden div that acts as a placeholder for this
      // curve, and it's been resized properly by the caller.
      from = $thread.children('.dw-t-vspace').offset();
      xs = from.left - SVG.winoffs.left + 30;
      ys = from.top - SVG.winoffs.top + 3;
      xe += 10;
      ye -= 9;
      var dx = 40;
      var xm = (xe - xs - dx) / 2;
      var dy = 28;
      strokes = 'M '+ xs +' '+ ys +
               ' C '+ (xs) +' '+ (ys+dy) +' '+ // draw Bezier curve  \
               '   '+ (xs+dx) +' '+ (ys+dy) +' '+     //              \  
               '   '+ (xs+dx) +' '+ (ys+dy) +' '+     //               `----
               ' C '+ (xe-70) +' '+ (ys+dy+5) +' '+
                      (xe) +' '+ (ye-55) +' '+ //                   ------.
                      xe +' '+ ye +' '+        //                          \
               ' l -7 -1 m 8 1 l 2 -8'; // arrow end: _|                    v
    } else {
      // Draw north-south curve.
      var ym = (ys + ye) / 2;
      strokes = 'M '+ (xs+5) +' '+ (ys+30) +
               ' C '+ xs +' '+ ym +' '+        // Draw curve to child post  |
                      xs +' '+ (ye-30) +' '+   //                           \
                      (xe-7) +' '+ (ye + 4) +  //                            \
               ' l -8 -1 m 9 1 l 0 -8'; // arrow end: _|                      `>
    }
    r.setAttribute('d', strokes);
    r.setAttribute('id', 'dw-curve-'+ $thread.attr('id') +'-'+ $to.attr('id'));
    SVG.$win.append(r);
    r = false;
  }

  // Draw curves from threads to children
  SVG.drawRelationships = function() {
    // Remove old curves
    SVG.$win.find('path').remove();
    // Remember where $win is placed, because Firefox [v3.6.8] changes the
    // offset when the first path is added, so it's not always safe to use
    // the value returned by offset() (but safe now). (The offset is set a bit
    // to the north-west of the path start point, must be a FF bug?)
    SVG.winoffs = SVG.$win.offset();
    // Create new.curves
    $('.dw-t').each(function(){
      var $t = $(this);
      $t.find('> .dw-res > .dw-t:visible').each(function(){
        SVG.curveTreadToReply($t, $(this));
      });
    });
    // The browser internal stylesheet defaults to height: 100%.
    $('#dw-svg-win').height($('.dw-depth-0').height() + 100);
    $('#dw-svg-win').width($('.dw-depth-0').width());
  };

  SVG.$updateThreadGraphics = function() {} // not implemented
})()}
else {(function(){
  // No SVG support. The svgweb Flash renderer seems far too slow
  // when resizing the Flash screen to e.g. 2000x2000 pixels.
  // And scrolldrag stops working (no idea why). Seems easier
  // to add these images of arrows instead.
  //

  // North-south arrows: (for vertical layout)
  $('.dw-depth-0 .dw-t:has(.dw-t)').each(function(){
    $(this).prepend("<div class='dw-svg-fake-varrow'/>");
    $(this).prepend("<div class='dw-svg-fake-varrow-hider-hi'/>");
    $(this).prepend("<div class='dw-svg-fake-varrow-hider-lo'/>");
  });
  $('.dw-depth-1 .dw-t').each(function(){
    var hider = $(this).filter(':last-child').length ?
                  ' dw-svg-fake-arrow-hider' : '';
    $(this).prepend('<div class="dw-svg-fake-vcurve-short'+ hider +'"/>');
  });
  $('.dw-depth-1 .dw-t:last-child').each(function(){
    $(this).prepend("<div class='dw-svg-fake-varrow-hider-left'/>");
  });
  //
  // West-east arrows: (for horizontal Layout)
  //
  // Arrow start, for horizontal layout, and arrow to reply link.
  $('.dw-hor > .dw-a > .dw-a-reply').each(function(){
    $(this).before('<div class="dw-svg-fake-hcurve-start"/>');
  });
  // Arrows to each child thread.
  SVG.$updateThreadGraphics = function() {
    if ($(this).parent().closest('.dw-t').filter('.dw-hor').length) {
      $(this).filter(':not(:last-child)').each(function(){
        $(this).prepend("<div class='dw-svg-fake-harrow'/>");
        $(this).prepend("<div class='dw-svg-fake-harrow-end'/>");
      });
      $(this).prepend('<div class="dw-svg-fake-hcurve"/>');
    } else {
      // vertical arrow
    }
  }
  $('.dw-hor > .dw-res > li').each(SVG.$updateThreadGraphics);
  SVG.drawRelationships = function() {
    // Need do nothing.
  }
})()}

SVG.drawRelationships();

// Poll for zoom in/out events, and redraw arrows if zoomed,
// because svg and html are not resized in the same manner: Unless
// arrows redrawn, their ends are incorrectly offsett.
zoomListeners.push(SVG.drawRelationships);

//$('.dw-t').each(SVG.$curvesToChildren);
Debiki.v0.SVG = SVG; // debug-export: Debiki.v0.SVG.curvesToChildren()


// ------- Miscellaneous

// Applies the clearfix fix to `thread' iff it has no child threads.
function clearfix(thread) {
  if (!thread.find(':has(.dw-t)').length) {
    thread.addClass('ui-helper-clearfix');
  }
}

// Finds all tags with an id attribute, and (hopefully) makes
// the ids unique by appending a unique (within this Web page) number to
// the ids. Updates any <label> `for' attributes to match the new ids.
function makeIdsUniqueUpdateLabels(jqueryObj) {
  var seqNo = '_sno-'+ (++idSuffixSequence);
  jqueryObj.find("*[id]").each(function(ix) {
      $(this).attr('id', $(this).attr('id') + seqNo);
    });
  jqueryObj.find('label').each(function(ix) {
      $(this).attr('for', $(this).attr('for') + seqNo);
    });
}

function buildTagFind(html, selector) {
  if (selector.indexOf('#') != -1) throw Error('Cannot lookup by ID: '+
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
  if (id.indexOf('#') != -1) throw Error('Include no # in id');
  var $tag = buildTagFind(html, '[id="'+ id +'"]');
  return $tag;
}

// Highlight the parent post when hovering over a reference.
$(".dw-parent-ref").hover(
  function(event){
    $(this).closest(".dw-t").parent().closest(".dw-t").
            children(".dw-p").addClass("dw-highlight");
  },
  function(event){
    $(this).closest(".dw-t").parent().closest(".dw-t").
            children(".dw-p").removeClass("dw-highlight");
  });

// ------- Layout

resizeRootThread();

//----------------------------------------
   }); // end jQuery onload
//----------------------------------------

//========================================
   })(); // end Debiki module
//========================================

