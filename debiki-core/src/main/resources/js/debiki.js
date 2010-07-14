// vim: fdm=marker et ts=2 sw=2

jQuery.noConflict()(function($){

var threadHovered = null;
var didResize = false;
var posts = $(".debiki .dw-post");
var voteFormTemplate = $("#dw-hidden-templates .dw-vote-template form");

$(".dw-post, .dw-thread-info").hover(
  function(event){
    var nextThread = $(this).closest('.dw-thread');

    if ($(this).hasClass('dw-post')) {
      // Show the #action-menu, unless the thread is closing (A)
      // and unless the thread doesn't already have a reply-form (B)
      // or a vote-form child (C).
      // (C and D: Better not open many action forms at once.)
      if (!nextThread.hasClass('dw-collapsed') &&  // A
          !nextThread.children().filter(
            '.dw-reply-form, .dw-vote-form, .dw-edit-form').length) {  // B, C
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

$(".dw-thread-info").click(function() {
  var thread = $(this).closest(".dw-thread");
  if (! thread.hasClass('dw-demarcated')) return;
  thread
    .children(":not(.dw-thread-info)").stop(true,true).slideToggle(800)
    .end()
    .stop(true, true)
    .toggleClass('dw-collapsed')
    .toggleClass('dw-collapsed-fx', 600);
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
        handles: 'e',
        stop: function(event, ui) {
          // jQuery has added `height: ...' to the thread's style attribute.
          // Unless removed, the therad won't resize itself when child
          // threads are opened/closed.
          thread.css('height', null);
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

// Generic cancel button
$("#dw-hidden-templates form .dw-cancel").click(function() {
  $(this).closest('form').remove();
});

// ------- Voting

$('#dw-action-menu .dw-vote').button().click(function(){
  // Warning: Some duplicated code, see .dw-reply and dw-edit click() below.
  var thread = $(this).closest('.dw-thread');
  clearfix(thread); // ensures the vote appears nested inside the thread
  var post = thread.children('.dw-post');
  var vote = voteFormTemplate.clone(true);
  var postId = post.attr('id').substr(8, 999); // drop initial 'dw-post-'
  vote.find("input[name='dw-fi-vote-on']").attr('value', postId);

  // The vote-value inputs are labeled checkboxes. Hence they 
  // have ids --- which right now remain the same as the ids
  // in the voteFormTemplate. Make the cloned ids unique:
  makeIdsUniqueUpdateLabels(vote, '-post-'+ postId);

  post.after(vote);
  // Dismiss action menu
  $('#dw-action-menu').appendTo($('#dw-hidden-templates'));
  // Enable submit button when votes specified
  vote.find("input[type='checkbox']").click(function(){
    vote.find("input[type='submit']").button("option", "disabled", false);
  });
  //
  // Fancy GUI
  // Seems this must be done *after* the voteFormTemplate has been
  // copied --- otherwise, if the Cancel button is clicked,
  // the voteFormTemplate itself has all its jQueryUI markup removed.
  // (Is that a jQuery bug? Only the *clone* ought to be affected?)
  vote.find('.dw-vote-group input, .dw-submit-group input').button();
  // Disable the submit button (until any checkbox clicked)
  vote.find("input[type='submit']").button("option", "disabled", true);
  vote.find('.dw-show-more-votes').
    button().addClass('dw-linkify-ui-state-default');
});

// Show more vote values when clicking the "More..." button.
voteFormTemplate.find('.dw-more-votes').hide();
voteFormTemplate.find('.dw-show-more-votes').show().
  click(function() {
    $(this).hide().
      closest('form').find('.dw-more-votes').show();
  });

// ------- Replying

$("#dw-action-menu .dw-reply").button().click(function() {
  // Warning: Some duplicated code, see .dw-vote and dw-edit click() above.
  var thread = $(this).closest('.dw-thread');
  clearfix(thread); // ensures the reply appears nested inside the thread
  var post = thread.children('.dw-post');
  var reply = $("#dw-hidden-templates .dw-reply-template").
                children().clone(true);
  var postId = post.attr('id').substr(8, 999); // drop initial "dw-post-"
  reply.find("input[name='dw-fi-reply-to']").attr('value', postId);
  makeIdsUniqueUpdateLabels(reply, '-post-'+ postId);
  reply.resizable({ alsoResize: reply.find('textarea') });
  post.after(reply);
  // Dismiss action menu
  $('#dw-action-menu').appendTo($('#dw-hidden-templates'));
  // Build fancy jQuery UI widgets
  reply.find('.dw-submit-group input').button();
  reply.find('label').addClass( // color and font that matches <input> buttons
    'dw-color-from-ui-state-default dw-font-from-ui-widget');
  // Resize the root thread (in case this reply-thread is a new child of it).
  DebikiLayout.resizeRootThread(); // see debiki-layout.js
});

// ------- Editing

$("#dw-action-menu .dw-edit").button().click(function() {
  // Warning: Some duplicated code, see .dw-vote and .dw-reply click() above.
  var $thread = $(this).closest('.dw-thread');
  clearfix($thread); // makes edit area appear inside $thread
  var $post = $thread.children('.dw-post');
  var $editForm = $("#dw-hidden-templates .dw-edit-template").
        children().clone(true);
  var $accordion = $editForm.find('.dw-edit-suggestions');
  var postId = $post.attr('id').substr(8, 999); // drop initial "dw-post-"
  //$editForm.find("input[name='dw-fi-reply-to']").attr('value', postId);
  makeIdsUniqueUpdateLabels($editForm, '-post-'+ postId);

  // Copy the post text to -edit-your tab.
  var curText = '';
  $post.find('.dw-text p').each(
      function(){ curText += $(this).text() + '\n\n'; });
  $editForm.find('textarea').val(curText.trim() + '\n');

  // Make form and accordion resizable
  $accordion.wrap("<div class='dw-resize-accordion' />");
  var $accwrap = $editForm.find('.dw-resize-accordion');
  $editForm.resizable({
      alsoResize: $accwrap,
			resize: function(){ $accordion.accordion("resize"); },
			minHeight: 140
		});

  // Adjust dimensions
  $editForm.css('width', $post.css('width'));
  $accwrap.css('height', '300px');
  $accordion.accordion("resize"); // parent container height changed

  $post.after($editForm);
  
  // jQuery.tabs() must be invoked after above line, weird!
  // Cannot use autoHeight, since other people's edit suggestions
  // might be arbitrary long?
  $accordion.accordion({ autoHeight: false, fillSpace: true });

  // Dismiss action menu
  $('#dw-action-menu').appendTo($('#dw-hidden-templates'));

  $editForm.find('.dw-new-edit-btn').click(function(){
    $(this).remove();
    $editForm.find('.dw-hidden-new-edit').removeClass(
      'dw-hidden-new-edit').addClass(
      'dw-your-edit dw-live-edit dw-your-new-edit');
    $accordion.accordion('activate', '.dw-your-new-edit');
  });

  // Build fancy jQuery UI widgets
  $editForm.find(
      "input[type='button'], input[type='submit'], input[type='radio']").
      button();
  $editForm.find('label, .dw-edit-suggestions-label').addClass(
    // color and font matching <input> buttons
    'dw-color-from-ui-state-default dw-font-from-ui-widget');
  // Resize the root thread (in case this reply-thread is a new child of it).
  DebikiLayout.resizeRootThread(); // see debiki-layout.js
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

});

