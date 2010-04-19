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
});
