/* jshint esversion:6, loopfunc:true, undef: true, unused: true, sub:true */
/* globals EventSource, console, $ */
/* exported MessageListener */
let MessageListener = (function(){
"use strict";

class MessageListener {
  constructor(credential){
    this.listeners = {};
    this.credential = credential;
    this.id = null;
    this.started = false;
    this.initialised = false;
  }
  listen(type, cb){
    if(!this.initialised)
      throw new Error("Too early to listen, it should be called between init and start");
    if(this.started)
      throw new Error("Too late to listen, it should be called between init and start");
    if(!this.listeners[type])
      this.listeners[type] = [];
    this.listeners[type].push(cb);
  }
  init(){
    return new Promise((resolve, reject) => {
      $.get("/id").done(id => {
        this.initialised = true;
        this.id = id;
        this.credential.setSourceId(id);
        resolve(); 
      }).fail(reject);
    });
  }
  start(){
    if(!this.initialised)
      throw new Error("it should be called after the call to init");
    this.started = true;
    (new EventSource(this.credential.applyUrl("stream?src=" + this.id))).addEventListener('message', e => {
      let data = JSON.parse(e.data);
      if(data.src == this.id && data.action != "new" && data.action != "update")
        return;
      if(!this.listeners[data.type])
        return;
      this.listeners[data.type].forEach(f => f(data.action, data.id || (data.data && data.data.id), data.data, data.lock));
    }, false);
  }
}

return MessageListener;
})();
