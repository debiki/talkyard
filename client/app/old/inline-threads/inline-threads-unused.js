/* Creates inline comments. Currently disabled (not in use).
 * Copyright (C) 2010 - 2012 Kaj Magnus Lindberg (born 1979)
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



var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


// Moves inline child threads back to the thread's list of child threads,
// and removes inline marks and undoes wrapping of -bd contents into
// -bd-blk:s. That is, undoes $placeInlineMarks and $splitBodyPlaceInlines.
// Call on posts.
d.i.$undoInlineThreads = function() {
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
};


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
    d.u.bugIf($bodyBlock.length !== 1, 'error DwE6kiJ08');
    var tagDogText = tagDog.sniffHtml($bodyBlock);
    var loc = 10; // COULD be included in the data attr
    if (markStartText.length > d.i.diffMatchPatch.maxMatchLength) {
      // Avoid a `Pattern too long for this browser' error (in case
      // corrupt/too-long matches were sent by the server, the whole
      // page would otherwise be messed up).
      markStartText = markStartText.substr(
          0, d.i.diffMatchPatch.maxMatchLength);
    }
    var match = d.i.diffMatchPatch.match_main(tagDogText, markStartText, loc);
    var arrow = $parentThread.filter('.dw-hz').length ?
        'ui-icon-arrow-1-e' : 'ui-icon-arrow-1-s';
    // COULD: When possible to mark a text range: Underline matched text?
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
};


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
}());



// Splits the single .dw-p-bd-blk into many -bd-blk:s,
// and places inline threads inbetween, in <ol .dw-i-ts> tags.
// Call on posts.
d.i.$splitBodyPlaceInlines = function() {
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
        // COULD change from <li> to <div>
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
        // COULD fix // For now, simply set the height to accHeight / numInlines.
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
        var $inline = $(this.hash); // COULD change from <li> to <div>
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
    var $placeFun = $(this).closest('.dw-t').filter('.dw-hz').length ?
        $placeToTheRight : $placeInside;
    $placeFun.apply(this);
    // Now there should be one <div .dw-p-bd-blk> with many
    // <div .dw-p-bd-blk> and <div .dw-i-ts> inside. Unwrap that single
    // parent <div .dw-p-bd-blk>.
    $(this).replaceWith($(this).contents());
  });
};


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
  d.i.showAndHig hlightPost($post);
  return false;
};


d.i.placeInlineThreadsForPost = function(post) {
  // If this post has any inline thread, place inline marks and split
  // the single .dw-p-bd-blk into many blocks with inline threads
  // inbetween.
  // (This takes rather long (120 ms for 110 posts, of which 20 are inlined,
  // on my 6 core 2.8 GHz AMD) but should nevertheless be done quite early,
  // because it rearranges threads and posts, and that'd better not happen
  // after a while when the user thinks the page has already finished
  // loading.)
  var $post = $(post);
  if ($post.parent().children('.dw-res').children('.dw-i-t').length) {
    $placeInlineMarks.call(post);
    d.i.$splitBodyPlaceInlines.call(post);
  }

  // When hovering an inline mark or thread, highlight the corresponding
  // thread or mark.
  // COULD avoid removing highlighting, until hovering something else?
  //  So one can follow the svg path to the inline thread.
  // When hovering an inline thread, highlight the mark.
  // COULD highlight arrows when hovering any post, not just inline posts?
  $post.find('> .dw-p-bd')
      .find('> .dw-p-bd-blk .dw-i-m-start')
        .hover($inlineMarkHighlightOn, $inlineMarkHighlightOff)
      .end()
      .find('> .dw-i-ts > .dw-i-t > .dw-p')
        .hover($inlineThreadHighlightOn, $inlineThreadHighlightOff);
};


function $inlineMarkHighlightOn() {
  var threadId = this.hash.substr(1, 999); // drops '#'
  toggleInlineHighlight(threadId, true);
};


function $inlineMarkHighlightOff() {
  var threadId = this.hash.substr(1, 999); // drops '#'
  toggleInlineHighlight(threadId, false);
};


function $inlineThreadHighlightOn() {
  var threadId = $(this).closest('.dw-t').attr('id');
  toggleInlineHighlight(threadId, true);
};


function $inlineThreadHighlightOff() {
  var threadId = $(this).closest('.dw-t').attr('id');
  toggleInlineHighlight(threadId, false);
};


function toggleInlineHighlight(threadId, on) {
  var inlineMarkId = 'dw-i-m_'+ threadId; // i.e. 'dw-i-m_dw-t-<thread-id>'
  var svgCurveId = 'dw-svg-c_'+ inlineMarkId;
  var $markAndPost = $('#'+ inlineMarkId +", #"+ threadId +" > .dw-p");
  var $arrow = $('#'+ svgCurveId);
  if (on) {
    $markAndPost.addClass('dw-highlight');
    $arrow.each(d.i.SVG.$highlightOn);
  } else {
    $markAndPost.removeClass('dw-highlight');
    $arrow.each(d.i.SVG.$highlightOff);
  }
};


// Show the related inline reply, on inline mark click.
$(function() {
  $('.debiki').delegate('a.dw-i-m-start', 'click', $showInlineReply);
});


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
