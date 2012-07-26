/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


 --- Not in use ---


    // From $initPostsThreadStep2,
    // inside the on mouseenter callback: (which also each($showActions))
    // ---
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
    // ---


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


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
