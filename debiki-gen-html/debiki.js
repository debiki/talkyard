// vim: fdm=marker et ts=2 sw=2
$(document).ready(function(){

$(".edit").hover(
  function(event){ $(this).append($("#edit-menu")); },
  function(event){ $("#hidden-menus").append($("#edit-menu")); }
  );

$(".vote").hover(
  function(event){ $(this).append($("#vote-menu")); },
  function(event){ $("#hidden-menus").append($("#vote-menu")); }
  );

$(".reply").hover(
  function(event){ $(this).append($("#reply-menu")); },
  function(event){ $("#hidden-menus").append($("#reply-menu")); }
  );

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

$(".parent-ref").hover(
  function(event){
    $(this).closest(".thread").parent().closest(".thread").
            children(".post").addClass("highlight");
  },
  function(event){
    $(this).closest(".thread").parent().closest(".thread").
            children(".post").removeClass("highlight");
  });

});
