/* jshint esversion:6, loopfunc:true, undef: true, unused: true, sub:true */
/* globals EventSource, console */
/* exported messageListener */
let messageListener = (function(){
"use strict";

return function(url, me, onMsg){
  (new EventSource(url+(me?"?src="+me:""))).addEventListener('message', function(e){
    let data = JSON.parse(e.data);
    if(me && data.src == me) 
      return;
    console.log(data);
    onMsg(data.type, data.id || (data.data && data.data.id), data.data, data.lock);
  }, false);
};
})();
