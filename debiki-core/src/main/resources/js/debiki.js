// vim: fdm=marker et ts=2 sw=2

// In this file: Implementation of the Debiki module, and
// a jQuery onload handler.

Debiki = {};  // TODO: Error handling?
Debiki.v0 = {};

//========================================
   (function(){
//========================================

//----------------------------------------
// Implement public functions
//----------------------------------------

var Settings = {};

Settings.makeEditUrl = function(debateId, postId) {
  // Default:
  return debateId +'/edits/proposed/post/'+ postId +'.html'
};


//----------------------------------------
// Export functions
//----------------------------------------

// A function that builds the GET line to download edit suggestions
// for a certain post.
Debiki.v0.setEditUrl = function(editUrlBuilder) {
  Settings.makeEditUrl = editUrlBuilder;
};


// Onload
//----------------------------------------
   jQuery.noConflict()(function($){
//----------------------------------------

var threadHovered = null;
var didResize = false;
var posts = $(".debiki .dw-post");
var rateFormTemplate = $("#dw-hidden-templates .dw-rat-template form");
var debateId = $('.debiki').attr('id');

$(".dw-post, .dw-thread-info").hover(
  function(event){
    var nextThread = $(this).closest('.dw-thread');

    if ($(this).hasClass('dw-post')) {
      // Show the #action-menu, unless the thread is closing (A)
      // and unless the thread doesn't already have a reply-form (B)
      // or a rating-form (C) or an edit form child (D).
      // (B, C and D: Better not open many action forms at once.)
      if (!nextThread.hasClass('dw-collapsed') &&  // A
          !nextThread.children().filter( // B, C, D
            '.dw-reply-form, .dw-rat-form, .dw-edit-forms').length) {
        $(this).after($('#dw-action-menu'))
      }
    }
    else if (nextThread.find('#dw-action-menu').length) {
      // This is a .thread-info and it has the #action-menu inside.
      // This is not a safe place for the menu! If this
      // .thread-info is clicked, the thread will
      // collapsed itself, and the #action-menu will be hidden inside
      // the collapsed thread -- the menu becomes buggy gone -- unless
      // moved to somewhere safe.
      $('#dw-hidden-templates').append($('#dw-action-menu'));
    }

    if (threadHovered && threadHovered[0] == nextThread[0])
      return;

    if ($(this).hasClass('dw-thread-info') &&
        !threadHovered.hasClass('dw-collapsed')) {
      // This .thread-info is not visible (it's only visible by default
      // if the thread is collapsed). Don't fade it in, because the user
      // might be navigating the #action-menu, and then we don't want
      // this .thread-info to appear below that menu. Instead,
      // only open the .thread-info if the threaad's *post* is hovered.
      return;
    }

    // Fade last thread-info, unless thread collapsed.
    if (threadHovered && !threadHovered.hasClass('dw-collapsed')) {
      threadHovered.children('.dw-thread-info')
                      .stop(true, true).fadeTo(1000, 0);
      threadHovered.stop(true, true)
          .removeClass('dw-demarcated')
          .removeClass('dw-demarcated-fx', 1000);
    }
    // Show thread-info for current thread.
    nextThread.children('.dw-thread-info').stop(true, true).fadeTo(600, 1);
    nextThread.stop(true, true)
        .addClass('dw-demarcated') // gives functionality instantly
        .addClass('dw-demarcated-fx', 600); // just for class animation effects
    threadHovered = nextThread;
  },
  function(event){
  });

// Open/close threads if the thread-info div is clicked.
$(".dw-thread-info").click(function() {
  var thread = $(this).closest(".dw-thread");
  if (! thread.hasClass('dw-demarcated')) return;
  resizeRootThreadExtraWide();
  thread.
    children(":not(.dw-thread-info)").stop(true,true).slideToggle(800).
    end().
    stop(true, true).
    toggleClass('dw-collapsed').
    toggleClass('dw-collapsed-fx', 600).
    queue(function(next){ resizeRootThreadNowAndLater(); next(); });
});

// Outline new posts
(function(){
  var myLastVersion = $.cookie('myLastPageVersion');
  if (!myLastVersion) return;
  var newPosts = posts.filter(function(index){
    return $(this).find('.dw-date').attr('title') > myLastVersion;
  })
  newPosts.closest('.dw-thread').addClass('dw-new');
})()

// Indicate which posts are cropped.
posts.filter('.dw-cropped-s').append(
    '<div class="dw-cropped-mark">. . . truncated</div>');

// Makes whole post visible on click.
//
posts.filter('.dw-cropped-s').click(function(){
  console.log('click: Removind cropped-s.');
  // (Some rather long posts are cropped, using max-width and -height.
  // Don't remove max-width, or some posts might end up rather wide.)
  $(this).closest('.dw-post').removeClass('dw-cropped-s');
})

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
    extraWidth = 150;
  }
  var width = extraWidth;
  var root = $('.debiki > .dw-thread');
  root.children('.dw-thread, form, .dw-edit-forms').each(function(){
    width += $(this).outerWidth(true);
  });
  root.css('width', width);
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

// Make posts and threads resizable.
// Fails with a TypeError on Android: Cathching it and ignoring it.
// (On Android, posts and threads won't be resizable.)
try {
  posts
  .resizable({
      autoHide: true,
      start: function(event, ui) {
        // Remove max height and width restrictions.
        $(this).closest('.dw-post').removeClass('dw-cropped-s dw-cropped-e');
        didResize = true;
      }
     })
  .find('.ui-resizable-se')
    // Make the resize grip larger.
    .removeClass('.ui-icon-gripsmall-diagonal-se')  // exchange small grip...
    .addClass('ui-icon-grip-diagonal-se')  // ...against the normal one
  .end()
  // Remove max-height and -width when mouse *up* on the resize-e handle.
  // (This is a shortcut to reveal the whole post - only triggered if
  // *clicking* the resize handle, but not dragging it.)
  .find('.ui-resizable-e')
    .mouseup(function(){
      // (Removing only max-width usually results in nothing:
      // The thread usually has a max-width.).
      var post = $(this).closest('.dw-post');
      post.removeClass('dw-cropped-s dw-cropped-e');
      // Expand post eastwards if resize handle was clicked not dragged.
      // (Also expands southwards, but browsers usually expand to east first.)
      if (!didResize) post.css('width', null).css('height', null);
    })
  .end()
  .find('.ui-resizable-s, .ui-resizable-se')
    // Expand post southwards if resize handle was clicked not dragged.
    .mouseup(function(){
      if (!didResize) $(this).closest('.dw-post').css('height', null);
    })
  .end()
  .find('.ui-resizable-handle')
    .mousedown(function(){
      didResize = false;
    })
  .end();

  // Resize threads.
  // Bug: Resizing a thread might toggle it collapsed / expanded, since
  // a click on the .thread-info might happen.
  $('.debiki .dw-thread-info').each(function(index) {
    var thread = $(this).closest('.dw-thread');
    $(this).resizable({
        alsoResize: thread,
        resize: resizeRootThreadExtraWide,
        handles: 'e',
        stop: function(event, ui) {
          // jQuery has added `height: ...' to the thread's style attribute.
          // Unless removed, the therad won't resize itself when child
          // threads are opened/closed.
          thread.css('height', null);
          resizeRootThreadNowAndLater();
        }
      })
      // Add a resize icon.
      .children('.ui-resizable-e')
      .addClass('ui-icon ui-icon-grip-solid-vertical');
  });
}
catch (e) {
  if (e.name == 'TypeError') console.log(e.name +': Failed to make '+
      'post resizable. Ignoring error (this is a smartphone?)');
  else throw e;
}

// ------- Forms and actions

// Action <form> cancel button -- won't work for the Edit form...?
function slideAwayRemove($form) {
  // Slide away <form> and remove it.
  var $parent = $form.parent();
  function rm(next) { $form.remove(); resizeRootThread(); next(); }
  if ($parent.filter('.dw-depth-0').length) $form.hide('fold', 800).queue(rm);
  else $form.slideUp(530).queue(rm);
};

// Remove new-reply and rating forms on cancel, but 
// the edit form has some own special logic.
$('.debiki').delegate(
    '.dw-reply-form .dw-cancel, ' +
    '.dw-rat-form .dw-cancel',
    'click', function(){ slideAwayRemove($(this).closest('form')); });

// Slide in reply, edit and rate forms -- I think it's
// easier to understand how they are related to other elems
// if they slide in, instead of just appearing abruptly.
function slideInActionForm($form, $thread) { 
  if ($thread) $form.insertAfter($thread.children('.dw-post'));
  else $thread = $form.closest('.dw-thread');
  // Extra width prevents float drop.
  resizeRootThreadExtraWide();
  // Slide in from left, if <form> siblings ordered horizontally.
  // Otherwise slide down (siblings ordered vertically).
  if ($thread.filter('.dw-depth-0').length) $form.show('fold', 800);
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
$('#dw-hidden-templates form').hide();

function dismissActionMenu() {
  $('#dw-action-menu').appendTo($('#dw-hidden-templates'));
}

// ------- Rating

$('#dw-action-menu .dw-rate').button().click(function(){
  // Warning: Some duplicated code, see .dw-reply and dw-edit click() below.
  var thread = $(this).closest('.dw-thread');
  clearfix(thread); // ensures the rating appears nested inside the thread
  var post = thread.children('.dw-post');
  var $rateForm = rateFormTemplate.clone(true);
  var postId = post.attr('id').substr(8, 999); // drop initial 'dw-post-'
  $rateForm.find("input[name='dw-fi-post']").attr('value', postId);

  // The rating-value inputs are labeled checkboxes. Hence they
  // have ids --- which right now remain the same as the ids
  // in the rateFormTemplate. Make the cloned ids unique:
  makeIdsUniqueUpdateLabels($rateForm, '-post-'+ postId);

  // Enable submit button when ratings specified
  $rateForm.find("input[type='checkbox']").click(function(){
    $rateForm.find("input[type='submit']").button("option", "disabled", false);
  });
  //
  // Fancy GUI
  // Seems this must be done *after* the rateFormTemplate has been
  // copied --- otherwise, if the Cancel button is clicked,
  // the rateFormTemplate itself has all its jQueryUI markup removed.
  // (Is that a jQuery bug? Only the *clone* ought to be affected?)
  $rateForm.find('.dw-rat-tag-set input, .dw-submit-set input').button();
  // Disable the submit button (until any checkbox clicked)
  $rateForm.find("input[type='submit']").button("option", "disabled", true);
  $rateForm.find('.dw-show-more-rat-tags').
    button().addClass('dw-linkify-ui-state-default');
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

$("#dw-action-menu .dw-reply").button().click(function() {
  // Warning: Some duplicated code, see .dw-rat-tag and dw-edit click() above.
  var thread = $(this).closest('.dw-thread');
  clearfix(thread); // ensures the reply appears nested inside the thread
  var post = thread.children('.dw-post');
  var reply = $("#dw-hidden-templates .dw-reply-template").
                children().clone(true);
  var postId = post.attr('id').substr(8, 999); // drop initial "dw-post-"
  reply.find("input[name='dw-fi-post']").attr('value', postId);
  makeIdsUniqueUpdateLabels(reply, '-post-'+ postId);
  reply.resizable({
      alsoResize: reply.find('textarea'),
      resize: resizeRootThreadExtraWide,
      stop: resizeRootThreadNowAndLater
    });
  // Build fancy jQuery UI widgets
  reply.find('.dw-submit-set input').button();
  reply.find('label').addClass( // color and font that matches <input> buttons
    'dw-color-from-ui-state-default dw-font-from-ui-widget');
  // Reveal the form
  slideInActionForm(reply, thread);
  dismissActionMenu();
});

// ------- Editing

$("#dw-action-menu .dw-edit").button().click(function() {
  // Warning: Some duplicated code, see .dw-rat-tag and .dw-reply click() above.
  var $thread = $(this).closest('.dw-thread');
  clearfix($thread); // makes edit area appear inside $thread
  var $post = $thread.children('.dw-post');
  // Create a div into which to load the edit <form>s -- the div class should
  // match the edit form div's class, so the action-menu won't be displayed
  // again until the request has completed and the edit form has been closed.
  var $formWrap = $("<div class='dw-edit-forms'></div>").insertAfter($post);
  $formWrap.hide(); // slide in later
  var postId = $post.attr('id').substr(8, 999); // drop initial "dw-post-"
  dismissActionMenu();  // before ajax request, or 2 edit <forms> will
                        // appear if you double click.
  $formWrap.load(Settings.makeEditUrl(debateId, postId) + ' .dw-edit-forms',
      function(editFormHtml) {

    // (Need not make ids unique; the post id was known when html generated.)

    var $editDiv = $formWrap.find('.dw-edit-forms').hide();
    var $accordions = $editDiv.find('.dw-edits');

    var $editsPendingForm = $editDiv.find('.dw-edits-others-form'); 
    var $editsYoursForm = $editDiv.find('.dw-new-edit-form'); 
    var $editsAppliedForm = $editDiv.find('.dw-edits-applied-form'); 

    var $showEditsPendingBtn = $editDiv.find('.dw-show-edits-pending-btn');
    var $showNewEditBtn = $editDiv.find('.dw-new-edit-btn');
    var $showEditsAppliedBtn = $editDiv.find('.dw-show-edits-applied-btn');

    var $forms = $editsPendingForm.add($editsYoursForm).add($editsAppliedForm);
    var $showBtns = $showEditsPendingBtn.add($showNewEditBtn).
                                                    add($showEditsAppliedBtn);
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
    $post.find('.dw-text p').each(function(){
          curText += $(this).text() + '\n\n'; });
    $editsYoursForm.find('textarea').val(curText.trim() + '\n');

    // Make forms and accordions resizable
    $editsYoursForm.resizable({
        alsoResize: $editsYoursForm.find('textarea')
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
      $(this).find('.dw-cancel').click(function(){
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
      'dw-color-from-ui-state-default dw-font-from-ui-widget');

    // Reveal the form.
    // Must be done before accordion() is invoked (below) otherwise
    // jQuery UI (as of 1.8.2) will make it very small.
    slideInActionForm($editDiv);

    // Cannot use autoHeight, since other people's edit suggestions
    // might be arbitrary long?
    $accordions.accordion(
        { autoHeight: false, fillSpace: true, icons: false });
  });
});

// ------- Miscellaneous

// Applies the clearfix fix to `thread' iff it has no child threads.
function clearfix(thread) {
  if (!thread.find(':has(.dw-thread)').length) {
    thread.addClass('ui-helper-clearfix');
  }
}

// Finds all tags with an id attribute, and (hopefully) makes
// the ids unique by appending `suffix' to the ids.
// Updates any <label> `for' attributes to match the new ids.
function makeIdsUniqueUpdateLabels(jqueryObj, suffix) {
  jqueryObj.find("*[id]").each(function(ix) {
      $(this).attr('id', $(this).attr('id') + suffix);
    });
  jqueryObj.find('label').each(function(ix) {
      $(this).attr('for', $(this).attr('for') + suffix);
    });
}

// Highlight the parent post when hovering over a reference.
$(".dw-parent-ref").hover(
  function(event){
    $(this).closest(".dw-thread").parent().closest(".dw-thread").
            children(".dw-post").addClass("dw-highlight");
  },
  function(event){
    $(this).closest(".dw-thread").parent().closest(".dw-thread").
            children(".dw-post").removeClass("dw-highlight");
  });

// ------- Layout

resizeRootThread();

//----------------------------------------
   }); // end jQuery onload
//----------------------------------------

//========================================
   })(); // end Debiki module
//========================================


