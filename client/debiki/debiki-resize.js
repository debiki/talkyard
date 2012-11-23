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
      d.i.SVG.$drawParentsAndTree.apply(this);
    },
    handles: 'e',
    stop: function(event, ui) {
      // jQuery has added `height: ...' to the thread's style attribute.
      // Unless removed, the therad won't resize itself when child
      // threads are opened/closed.
      $(this).css('height', '');
    }
  });
};


d.i.$threadToggleFolded = function() {
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


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
