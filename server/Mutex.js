/* jshint esversion:9, node:true, loopfunc:true, undef: true, unused: true, sub:true */

function unlock(mutex){
  if(mutex.resolveList.length)
    (mutex.resolveList.shift())(() => unlock(mutex));
  else
    mutex.locked = false;
}

class Mutex {
  constructor(){
    this.resolveList = [];
    this.locked = false;
  }
  lock(){
    if(this.locked)
      return new Promise(resolve => this.resolveList.push(resolve));
    this.locked = true;
    return Promise.resolve(() => unlock(this));
  }  
}

module.exports = Mutex;