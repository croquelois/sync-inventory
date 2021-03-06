/* jshint esversion:6, loopfunc:true, undef: true, unused: true, sub:true */
/* globals $, setTimeout, console */
/* exported MessageSender */
let MessageSender = (function(){
"use strict";

function fakeDelayCb(cb){
  return function(err,data){
    setTimeout(function(){ cb(err,data); }, 100 + 50*Math.exp(2*Math.random()));
  };
}

function wrapFail(cb){
  return function(err){
    console.log(err);
    return cb((err && (err.responseText || err.statusText)) || err || "unknow error", null);
  };
}

class MessageSender {
  constructor(credential, url){
    this.url = url || "";
    this.credential = credential;
  }

  send(data, cb){
    //cb = fakeDelayCb(cb);
    let req = this.credential.applyBody({data});
    $.ajax({
      type: "POST",
      url: this.url + "/send",
      data: JSON.stringify(req),
      contentType: "application/json; charset=UTF-8",
      processData: false
    }).done(ret => cb(null,ret)).fail(wrapFail(cb));
  }

  remove(id, cb){
    //cb = fakeDelayCb(cb);
    let req = this.credential.applyBody({id});
    $.ajax({
      type: "POST",
      url: this.url + "/del",
      data: JSON.stringify(req),
      contentType: "application/json; charset=UTF-8",
      processData: false
    }).done(ret => cb(null,ret)).fail(wrapFail(cb));
  }

  getId(cb){
    //cb = fakeDelayCb(cb);
    $.get("/id").done(id => cb(null,id)).fail(wrapFail(cb));
  }
  
  lock(id, cb){
    //cb = fakeDelayCb(cb);
    let req = this.credential.applyBody({id});
    $.ajax({
      type: "POST",
      url: this.url + "/lock",
      data: JSON.stringify(req),
      contentType: "application/json; charset=UTF-8",
      processData: false
    }).done(ret => cb(null,ret)).fail(wrapFail(cb));
  }

  unlock(id, cb){
    //cb = fakeDelayCb(cb);
    let req = this.credential.applyBody({id});
    $.ajax({
      type: "POST",
      url: this.url + "/unlock",
      data: JSON.stringify(req),
      contentType: "application/json; charset=UTF-8",
      processData: false
    }).done(ret => cb(null,ret)).fail(wrapFail(cb));
  }
}

return MessageSender;
})();
