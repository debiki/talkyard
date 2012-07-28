
/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


d.i.makeThreadResizableForPost = function(post) {
  var $thread = $(post).dwCheckIs('.dw-p').closest('.dw-t');

  // Make replies to the root thread resizable horizontally. (Takes
  // perhaps 100 ms on my 6 core 2.8 GHz AMD, 24 depth-1 reply columns.)
  // (But skip inline replies; they expand eastwards regardless.)
  // $makeThreadEastResizable must be called before $makePostResizable (not in
  // use though!), or $makeThreadEastResizable has no effect. No idea
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
    }).each($makeThreadEastResizable);
};


// Makes [threads layed out vertically] horizontally resizable.
function $makeThreadEastResizable() {
  $(this).resizable({
    resize: function() {
      d.i.resizeRootThreadExtraWide();
      d.i.SVG.$drawParentsAndTree.apply(this);
    },
    handles: 'e',
    stop: function(event, ui) {
      // jQuery has added `height: ...' to the thread's style attribute.
      // Unless removed, the therad won't resize itself when child
      // threads are opened/closed.
      $(this).css('height', '');
      d.i.resizeRootThreadNowAndLater();
    }
  });
};


d.i.$threadToggleFolded = function() {
  // In case the thread will be wider than the summary, prevent float drop.
  d.i.resizeRootThreadExtraWide();
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
    $childrenToFold.each(d.i.$slideDown);
    $thread.removeClass('dw-zd');
    $foldLink.text('[–]'); // not a '-', but an en dash, \u2013,
  } else {
    // Fold thread.
    var postCount = $thread.find('.dw-p').length;
    $childrenToFold.each(d.i.$slideUp).queue(function(next) {
      $foldLink.text('[+] Click to show '+  // COULD add i18n
          postCount +' posts');
      $thread.addClass('dw-zd');
      next();
    });
  }
  return false; // don't follow any <a> link
};


// Makes the root thread wide enough to contain all its child posts.
// Is this not done e.g. when child posts are resized or stacked eastwards,
// or a reply/rate/edit form is shown/resized, the east-most threads
// will float-drop below the other threads.
d.i.resizeRootThread = function() {
  resizeRootThreadImpl();
};


// Resizes the root thread so it becomes extra wide.
// This almost avoids all float drops, when quickly resizing an element
// (making it larger).
d.i.resizeRootThreadExtraWide = function() {
  resizeRootThreadImpl(true);
};


// After an elem has been resized, the root thread is resized by
// a call to resizeRootThread(). However, it seems the browser
// (Google Chrome) calls that function before all elements
// are in their final position, in some weird manner, causing
// floats to drop, as if resizeRootThread() had not been called.
// This can be fixed by calling resizeRootThread() again,
// after a while when the browser is (probably) done
// doing its layout stuff.
d.i.resizeRootThreadNowAndLater = (function(){
  var handle;
  return function() {
    d.i.resizeRootThread();
    if (handle) clearTimeout(handle);
    handle = setTimeout(d.i.resizeRootThread, 1500);
  };
}());


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
};


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
