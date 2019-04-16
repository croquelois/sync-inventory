/* jshint esversion:6, loopfunc:true, undef: true, unused: true, sub:true */
/* globals jQuery, MessageListener, DataStorage */

// This Credential class is here just for Demo prupose
// in real life, this should contain the token of the client
// and the group is determined on server side
class Credential {
  constructor(grpId){
    this.grpId = grpId;
  }
  applyUrl(url){ 
    return "/"+this.grpId+"/"+url; 
  }
  applyBody(req){ 
    req.grpId = this.grpId;
    req.src = this.src;
    return req; 
  }
  setSourceId(srcId){
    this.src = srcId;
  }
}
    
(function($){
  $(function(){

    $('.button-collapse').sideNav();
    $('.parallax').parallax();
    
    if($("table").length != 1)
      return;

    let credential = new Credential("demo");
    let stream = new MessageListener(credential);
    stream.init().then(function(){
      new DataStorage("", stream, $("table").attr("data-source"),$("table"),$("#detail"),$("#new"));
      stream.start();
    });

  });
})(jQuery);
