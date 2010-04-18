// vim: fdm=marker et ts=2 sw=2
$(document).ready(function(){

$(".edit").hover(
  function(event){ $(this).append($("#edit-menu")); },
  function(event){ $("#hidden-menus").append($("#edit-menu")); }
  );

$(".rate").hover(
  function(event){ $(this).append($("#rate-menu")); },
  function(event){ $("#hidden-menus").append($("#rate-menu")); }
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
