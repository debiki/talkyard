// vim: fdm=marker et ts=2 sw=2

threadHovered = null;

$(function() {

$(".post, .thread-summary").hover(
  function(event){
    var nextThread = $(this).closest('.thread');

    if (threadHovered && threadHovered[0] == nextThread[0])
      return;

    // Fade last summary, unless thread collapsed.
    if (threadHovered && !threadHovered.hasClass('collapsed')) {
      threadHovered.children('.thread-summary')
                      .stop(true, true).fadeTo(1000, 0);
      threadHovered.stop(true, true).removeClass('demarcated', 1000);
    }
    // Show summary for current thread.
    nextThread.children('.thread-summary').stop(true, true).fadeTo(600, 1);
    nextThread.stop(true, true).addClass('demarcated', 600);
    threadHovered = nextThread;
  },
  function(event){
  });

$(".thread-summary").click(function() {
  $(this).closest(".thread")
    .children(":not(.thread-summary)").stop(true,true).slideToggle(800)
    .end()
    .stop(true, true)
    .toggleClass('collapsed')
    .toggleClass('collapsed-fx', 600);
});

/*
$(".vote-summary").click(function() {
  $(this).closest(".thread").children(".post")
      .children(":not(.vote-summary)").slideToggle(200);
}); */

$(".post").resizable({ autoHide: true });

$(".edit").hover(
  function(event){ $(this).append($("#edit-menu")); },
  function(event){ $("#hidden-menus").append($("#edit-menu")); }
  );

$(".vote").hover(
  function(event){ $(this).append($("#vote-menu")); },
  function(event){ $("#hidden-menus").append($("#vote-menu")); }
  );

/*
$(".reply").hover(
  function(event){ $(this).append($("#reply-menu")); },
  function(event){ $("#hidden-menus").append($("#reply-menu")); }
  );
*/

$(".reply").click(function() {
  var post = $(this).closest(".post");
  var reply = $("#hidden-menus .reply-template").clone(true);
  var postId = post.attr('id').substr(5, 999); // drop initial "post-"
  reply.find("input[name='parent']").attr('value', postId);
  reply.find("input[name='author']").attr('value', 'Author unknown');
  post.after(reply);
  //$(this).closest(".post").after(reply);
});

$("#hidden-menus button.cancel").click(function() {
  $(this).closest('.thread.reply.preview').remove();
});

  //function(event){
  //  $(this).append($(
  //      "<ul class='menu'>"+
  //        "<li>Edit</li>"+
  //        "<li>Copy&#160;&amp;&#160;edit</li>"+
  //        "<li>Delete</li>"+
  //        "<li>Move</li>"+
  //      "</ul>"));
  //},
  //function(event){
  //  $(this).remove(".menu");
  //});

// Don't show the crosshair cursor for menu items that trigger no action.
$(".menu li:has(.sub.menu)").css("cursor", "default");

// Highlight the parent post when hovering over a reference.
$(".parent-ref").hover(
  function(event){
    $(this).closest(".thread").parent().closest(".thread").
            children(".post").addClass("highlight");
  },
  function(event){
    $(this).closest(".thread").parent().closest(".thread").
            children(".post").removeClass("highlight");
  });

// When the .reply.preview is not inside the #hidden-menu,
// but under a real .thread, leave it visible after hovering.
$(".thread. .reply.preview").hover(
  function(event){
    $(this).parents().css("overflow", "visible");
  },
  function(event){
    // leave overflow visible for now.
    // (It's (perhaps) annoying if the reply-textarea
    // is overflow-hidden, since the outline around it
    // will be cropped in a usually ugly manner.)
  });

});
