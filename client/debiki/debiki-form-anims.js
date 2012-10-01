/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


d.i.$slideUp = function() {
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
      $post.each(d.i.SVG.$drawParentsAndTree);
    }
  }).queue(function(next) {
    $i.hide();
    // Clear height etc, so $slideDown works properly.
    $.each(props, function(prop, val) {
      $i.css(prop, '');
    });
    next();
  });
};


d.i.$slideDown = function() {
  // COULD optimize: See $slideUp(…).
  var $i = $(this);
  var $post = $i.closest('.dw-t').children('.dw-p');
  var realHeight = $i.height();
  $i.height(0).show().animate({height: realHeight}, {
    duration: 530,
    step: function(now, fx) {
      $post.each(d.i.SVG.$drawParentsAndTree);
    }
  });
  // Clear height and width, so $i adjusts its size after its child elems.
  $i.queue(function(next) {
    $(this).css('height', '').css('width', '');
    next();
  });
};


function fold($elem, how) {
  var $post = $elem.closest('.dw-t').children('.dw-p');
  $elem.animate(how.firstProps, {
    duration: how.firstDuration,
    step: function(now, fx) {
      $post.each(d.i.SVG.$drawParentsAndTree);
    }
  }).animate(how.lastProps, {
    duration: how.lastDuration,
    step: function(now, fx) {
      $post.each(d.i.SVG.$drawParentsAndTree);
    }
  });
};


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
};


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
};


d.i.removeInstantly = function($form) {
  var $thread = $form.closest('.dw-t');
  $form.remove();
  // Refresh SVG threads. When the last animation step callback was
  // invoked, the $form had not yet been remove()d.
  $thread.each(d.i.SVG.$drawPost).each(d.i.SVG.$drawParents);
  d.i.resizeRootThread();
};


// Action <form> cancel button -- won't work for the Edit form...?
d.i.slideAwayRemove = function($form, opt_complete) {
  // Slide away <form> and remove it.
  var $thread = $form.closest('.dw-t');
  function rm(next) {
    if (opt_complete) opt_complete();
    d.i.removeInstantly($form);
    next();
  }
  // COULD elliminate dupl code that determines whether to fold or slide.
  if ($thread.filter('.dw-hor, .dw-debate').length &&  // COULD rm .dw-debate?
      !$form.closest('ol').filter('.dw-i-ts').length) {
    $form.each($foldOutLeft).queue(rm);
  }
  else {
    $form.each(d.i.$slideUp).queue(rm);
  }
};


function $removeClosestForms() {
  // Sometimes the form is of class .dw-f, sometimes threre's a form parent
  // with class .dw-fs. Remove that parent if possible.
  var $formSetOrForm = $(this).closest('.dw-fs').add($(this).closest('.dw-f'));
  d.i.slideAwayRemove($formSetOrForm.first());
};


// Slide in reply, edit and rate forms -- I think it's
// easier to understand how they are related to other elems
// if they slide in, instead of just appearing abruptly.
// If $where is specified, $form is appended to the thread 
// $where.closest('.dw-t'), otherwise it is assumed that it has
// alread been inserted appropriately.
d.i.slideInActionForm = function($form, $where) {
  if ($where) {
    // Insert before the first .dw-fs, or the .dw-res, or append.
    var $thread = $where.closest('.dw-t');
    var $oldFormOrCmts = $thread.children('.dw-fs, .dw-res').filter(':eq(0)');
    if ($oldFormOrCmts.length) $oldFormOrCmts.before($form);
    else $thread.append($form);
  }
  else $where = $form.closest('.dw-t');
  // Extra width prevents float drop.
  d.i.resizeRootThreadExtraWide();
  // Slide in from left, if <form> siblings ordered horizontally.
  // Otherwise slide down (siblings ordered vertically).
  if ($where.filter('.dw-hor, .dw-debate').length && // COULD rm .dw-debate?
      !$form.closest('ol').filter('.dw-i-ts').length) {
    $form.each($foldInLeft);
  } else {
    $form.each(d.i.$slideDown);
  }

  // Scroll form into view, and cancel extra width.
  // Or add even more width, to prevent float drops
  // -- needs to be done also when sliding downwards, since that sometimes
  // makes the root thread child threads wider.
  $form.queue(function(next){
      d.i.resizeRootThreadNowAndLater();
      $form.dwScrollIntoView();
      next();
    });
};


// Remove new-reply and rating forms on cancel, but 
// the edit form has some own special logic.
$(function() {
  $('.debiki').delegate(
      '.dw-fs-re .dw-fi-cancel, ' +
      '.dw-fs-r .dw-fi-cancel',
      'click', $removeClosestForms);
});


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
