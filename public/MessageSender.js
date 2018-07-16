/* jshint esversion:6, loopfunc:true, undef: true, unused: true, sub:true */
/* globals $, setTimeout, console */
/* exported MessageSender */
let MessageSender = (function(){
"use strict";

let MessageSender = function(url){
  this.url = url || "";
  this.src = "";
};

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

MessageSender.prototype.init = function(cb){
  this.getId((err,id) => cb(err, this.src=id));
};

MessageSender.prototype.send = function(data, cb){
  cb = fakeDelayCb(cb);
  $.ajax({
      type: "POST",
      url: this.url + "/send",
      data: JSON.stringify({data,src:this.src}),
      contentType: "application/json; charset=UTF-8",
      processData: false
  }).done(function(ret){ cb(null,ret); })
   .fail(wrapFail(cb));
};

MessageSender.prototype.delete = function(id, cb){
  cb = fakeDelayCb(cb);
  $.ajax({
      type: "POST",
      url: this.url + "/del",
      data: JSON.stringify({id,src:this.src}),
      contentType: "application/json; charset=UTF-8",
      processData: false
  }).done(function(ret){ cb(null,ret); })
   .fail(wrapFail(cb));
};

MessageSender.prototype.getId = function(cb){
  //cb = fakeDelayCb(cb);
  $.ajax({
      type: "POST",
      url: this.url + "/getId",
      contentType: "application/json; charset=UTF-8",
      processData: false
  }).done(function(ret){ cb(null,ret.id); })
   .fail(wrapFail(cb));
};

MessageSender.prototype.lock = function(id, cb){
  cb = fakeDelayCb(cb);
  $.ajax({
      type: "POST",
      url: this.url + "/lock",
      data: JSON.stringify({id,src:this.src}),
      contentType: "application/json; charset=UTF-8",
      processData: false
  }).done(function(ret){ cb(null,ret); })
   .fail(wrapFail(cb));
};

MessageSender.prototype.unlock = function(id, cb){
  cb = fakeDelayCb(cb);
  $.ajax({
      type: "POST",
      url: this.url + "/unlock",
      data: JSON.stringify({id,src:this.src}),
      contentType: "application/json; charset=UTF-8",
      processData: false
  }).done(function(ret){ cb(null,ret); })
   .fail(wrapFail(cb));
};

return MessageSender;
})();
