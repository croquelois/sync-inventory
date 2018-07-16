(function($){
  $(function(){

    $('.button-collapse').sideNav();
    $('.parallax').parallax();
    if($("table").length == 1)
      new DataStorage("",$("table").attr("data-source"),$("table"),$("#detail"),$("#new"));

  }); // end of document ready
})(jQuery); // end of jQuery name space
