/* Draws arrows from comment to replies. Uses SVG.
 * Copyright (C) 2010 - 2013 Kaj Magnus Lindberg (born 1979)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

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
debiki.internal.makeSvgDrawer = function($) {

  var d = { i: debiki.internal, u: debiki.v0.util };
  var svgns = "http://www.w3.org/2000/svg";

  function $createSvgRoot() {
    var svg = document.createElementNS(svgns, 'svg');
    this.appendChild(svg);
    $(this).addClass('dw-svg-parent');
  }

  function initRootSvg() {
    // Poll for zoom in/out events, and redraw arrows if zoomed,
    // because svg and html are not resized in the same manner: Unless
    // arrows redrawn, their ends are incorrectly offsett.
    d.u.zoomListeners.push(drawEverything);

    // (In the future, here will probably be created a global full window SVG
    // that can draw arrows between any elems.)
  }

  function $initPostSvg() {
    var $i = $(this);
    // Do not draw SVG for title posts. (In the future, could create
    // a SVG elem for inline replies only, though.)
    if ($i.is('.dw-p-ttl'))
      return;

    // Create root for contextual replies.
    // An inline thread is drawn above its parent post's body,
    // so an SVG tag is needed in each .dw-p-bd with any inline thread.
    // (For simplicity, create a <svg> root in all .dw-p-bd:s.)
    $i.children('.dw-p-bd').each($createSvgRoot);

    // Create root for whole post replies.
    // (Never do this for title posts, they have no whole post replies.)
    var $p = $i.parent();
    var $vspace = $p.children('.dw-t-vspace');
    if ($vspace.length) {
      // Place the root in the .dw-t-vspace before the reply list.
      $p.addClass('dw-svg-gparnt');
      $vspace.each($createSvgRoot);
    } else {
      $p.each($createSvgRoot);
    }
  }

  function findClosestRoot($elem) {
    var $root = $elem.closest('.dw-svg-parent').children('svg');
    if (!$root.length)
      $root = $elem.closest('.dw-svg-gparnt').find('> .dw-svg-parent > svg');
    d.u.dieIf(!$root.length, 'No SVG root found [error DwE84362qwkghd]');
    return $root;
  }

  // Draws an arrow from a mark to an inline thread.
  function arrowFromMarkToInline($mark, $inlineThread, cache) {
    // COULD make use of `cache'. See arrowFromThreadToReply(…).
    var $bdyBlk = $mark.closest('.dw-p-bd-blk');
    var $thread = $bdyBlk.closest('.dw-t');
    var horizontalLayout = $thread.is('.dw-hz');
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
      // Change x-start to the right edge of the .dw-p-bd-blk in which
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
      // Move y-start to below the .dw-p-bd-blk in which the mark is placed.
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
      // Arrow starting below the .dw-p-bd-blk, pointing on the inline thread.
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
      cache.horizontalLayout = $thread.is('.dw-hz');
      // The root post has a -vspace, in which SVG is drawn.
      cache.from = $thread.children('.dw-t-vspace').add($thread)
          .last() // not first() — $.add() sorts in document order
          .offset();
    }
    var to = $to.offset();
    var r = document.createElementNS(svgns, 'path');
    var xs = cache.from.left - cache.svgOffs.left; // start
    var ys = cache.from.top - cache.svgOffs.top;
    var xe = to.left - cache.svgOffs.left; // end
    var ye = to.top - cache.svgOffs.top;
    var strokes;
    if (cache.horizontalLayout && $thread.is('.dw-depth-0')) {
      // This is the root thread, and it is (always) laid out horizontally,
      // so draw west-east curve:  `------.
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
        // $to is to the left of the arrow start. This happens e.g.
        // for [the arrow to the root post's Reply button].
        // Draw a special north-south curve, that starts just like the west-east
        // curve in the `else' block just below.
        // There might be stuff to the right of $to though,
        // so must start the arrow in the same way as the arrows that
        // point on the stuff to the right.
        xe += Math.min(24, $to.width() * 0.67);
        ye -= 13;
        var dx = 40 - 10;
        var dy = 28;
                                                // draw         \
        strokes = curveStart(xs, ys, dx, dy) +  // Bezier        |
                 ' '+ xe +' '+ ye +             // curve        /
                 ' l -5 -7 m 5 7 l 8 -4';   // arrow end       v
      } else {
        // $to is placed to the right of $thread. Draw west-east curve.
        xe += 10 + 28; // 28 is the child thread's padding-left
        ye -= 12;
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
    } else if (cache.horizontalLayout && cache.itemIndex == 0 &&
        cache.itemCount == 1) {
      // This is an inline thread, which is layed out horizontally,
      // and we're drawing an arrow to the reply button (which is always
      // present), and there are no replies. Draw a nice looking arrow
      // for this special case.
      //
      //       [Here's the post body]
      //       [blah bla...         ]
      //  x0,y0 |
      //        \
      //         \  curve 1, from x0,y0 to x1,y1
      //          |
      //   x1,y1  v
      //       [Here's the  ]      (no replies here, only
      //       [reply button]       the reply button is present)

      var x0 = xs +  8;
      var y0 = ye - 50; // (but not ys + …)
      var x1 = xe + 18;
      var y1 = ye -  8;
      strokes = 'M '+ (x0     ) +' '+ (y0     ) +
               ' C '+ (x0 -  4) +' '+ (y1 - 15) +
                 ' '+ (x1 +  3) +' '+ (y1 - 15) +
                 ' '+ (x1     ) +' '+ (y1     ) +
                 ' l -6 -5 m 7 5 l 6 -7';  // arrow end

    } else if (cache.horizontalLayout) {
      // This is an inline thread, which is layed out horizontally.
      // Draw 2 Bezier curves and an arrow head at the end:
      //
      // x0,y0 [Here's the post body]
      //   /   [...                 ]
      //   |
      //   | curve 1, from x0,y0 to x1,y1
      //   \
      //    `- x1,y1 ------. curve 2      -----------.  (another curve)
      //       |            \                         \
      //       /    arrow    x2,y2                    |
      //      v     head —>  v                        v
      //     [Reply ]       [Here's the reply]       (Another reply)
      //     [button]       [...             ]

      var x0 = xs +  8;
      var y0 = ys + 30;
      var x1 = x0 + 27;
      var y1 = ye - 30;
      var x2 = xe + 35;
      var y2 = ye - 13;

      if (cache.itemIndex == 0) {
        // This is an arrow to the Reply button or a reply that's been
        // nailed as child no. 0 (and the Reply button is somewhere
        // to the right).
        strokes =
                'M '+ (x0     ) +' '+ (y0     ) +  //   /
               ' C '+ (x0 -  4) +' '+ (y1 - 15) +  //   |
                 ' '+ (x0 +  5) +' '+ (y1     ) +  //   \
                 ' '+ (x1     ) +' '+ (y1     );   //    `-
      } else {
        // The first Bezier curve to this reply was drawn when
        // we drew the itemIndex == 0 arrow. Start at x1,y1 instead.
        strokes =
                'M '+ (x1     ) +' '+ (y1     );
      }
      strokes = strokes +
               ' C '+ (x2 - 20) +' '+ (y1     ) +  //    -----.
                 ' '+ (x2     ) +' '+ (y1 -  5) +  //          \
                 ' '+ (x2     ) +' '+ (y2     ) +  //          |
               ' l -7 -4 m 8 4 l 5 -7';  // arrow end: _|      v
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
    //   [2012-02: Hmm, now I just added a :visible filter, will that be
    //   slow too? And in which statement was the :hidden filter included?]
    // - arrowFrom...() are SLOW! because they use $.offset.
    // }}}
    var $i = $(this);
    var $bdy = $('> .dw-p > .dw-p-bd', this);
    // Remove old curves
    $i.add('> .dw-t-vspace', this).add($bdy).children('svg').each(function() {
      $(this).find('path').remove();
    });
    // Draw arrows to whole post replies, and to thread summaries but
    // skip the not :visible summazrized threads. For horizontal layout,
    // draw an arrow to the Reply button (it's an <li>).
    var $childItems = $i.find('> .dw-res > li:visible');
    var cache = { itemCount: $childItems.length };
    $childItems.each(function(index){
      cache.itemIndex = index;
      arrowFromThreadToReply($i, $(this), cache);
    });
    // Draw arrows to inline replies.
    $bdy.children('.dw-p-bd-blk').each(function() {
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
    $('.dw-debate').each($drawTree);
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
    this.style.stroke = '#dbdbdb';
    this.style.strokeWidth = 3;
  }

  function initRootDrawArrows() {
    initRootSvg();
    drawEverything();
  };

  return {
    // DO NOT FORGET to update the fake SVG drawer too!
    // And test both with and without SVG enabled.
    initRootDrawArrows: initRootDrawArrows,
    $initPostSvg: $initPostSvg,
    $drawPost: $drawPost,
    $drawTree: $drawTree,
    $drawParents: $drawParents,
    $drawParentsAndTree: $drawParentsAndTree,
    drawEverything: drawEverything,
    $highlightOn: $highlightOn,
    $highlightOff: $highlightOff
  };
};


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
