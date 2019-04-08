/* jshint esversion:6, loopfunc:true, undef: true, unused: true, sub:true */
/* globals jQuery, MessageListener, DataStorage */

(function($){
  $(function(){

    $('.button-collapse').sideNav();
    $('.parallax').parallax();
    
    if($("table").length != 1)
      return;
    
    let grpId = "demo";
    let stream = new MessageListener(grpId);
    stream.init().then(function(){
      new DataStorage("", stream, $("table").attr("data-source"),$("table"),$("#detail"),$("#new"));
      stream.start();
    });

  });
})(jQuery);
