/* jshint esversion:9, node:true, loopfunc:true, undef: true, unused: true, sub:true */
"use strict";
const uuidv4 = require('uuid/v4');

module.exports = function(app, extractUserInfo, clients, type, columns){
  let db = {};
  let onUpdateFct = [];
  let me = uuidv4();
  
  function removeUnexpectedKey(data){
    Object.keys(data).forEach(key => {
      if(!columns[key] || (columns[key].opt && columns[key].opt.readonly))
        delete data[key];
    });
  }
  
  function addDefaultValue(data){
    Object.keys(columns).forEach(key => {
      if(data[key] === undefined || data[key] == ""){
        let dflt = (columns[key].opt||{}).default;
        if(dflt === undefined)
          data[key] = "";
        else if(typeof(dflt) == "function")
          data[key] = dflt();
        else
          data[key] = dflt;
      }
    });
  }
  
  function fillWithPreviousValue(prevData, data){
    Object.keys(columns).filter(key => data[key] === undefined).forEach(key => data[key] = prevData[key]);
  }
  
  clients.onNew(function(client){
    let grpItem = Object.keys(db).map(key => db[key]).filter(val => val.grpId == client.grpId);
    grpItem.forEach(val => client.writeMessage({type, action:"new",id:val.id,data:val.data,lock:val.lock}));
  });
  
  clients.onClose(function(client){
    let ownedLock = Object.keys(db).map(key => db[key]).filter(val => val.lock == client.src);
    ownedLock.forEach(val => {
      db[val.id].lock = false;
      clients.writeMessage(val.grpId, {type, action: "unlock", id: val.id, src: client.src});
    });
  });
  
  async function lock(src, grpId, id){
    if(!db[id])
      throw "unknow id";
    db[id].lock = src;
    clients.writeMessage(grpId, {type, action:"lock",id,src});
  }
  
  async function unlock(src, grpId, id){
    if(!db[id])
      throw "unknow id";
    db[id].lock = false;
    clients.writeMessage(grpId, {type, action:"unlock",id,src});
  }
    
  async function update(src, grpId, id, data){
    if(src != me)
      removeUnexpectedKey(data);
    data.id = id;
    if(!db[id]){
      addDefaultValue(data);
      db[id] = {grpId, id, data, lock:false};
    }else{
      fillWithPreviousValue(db[id].data, data);
      db[id].data = data;
    }
    clients.writeMessage(grpId, {type, action:"update", id, data, src});
    if(src != me){
      let report = {data};
      report.update = (data) => update(me, grpId, id, data);
      report.lock = () => lock(me, grpId, id);
      report.unlock = () => unlock(me, grpId, id);
      onUpdateFct.forEach(f => f(report));
    }
  }

  async function del(src, grpId, id){
    if(!db[id])
      throw "unknow id";
    delete db[id];
    clients.writeMessage(grpId, {type, action:"delete", id, src});
  }
  
  async function lockPost(req){
    let {src,grpId} = extractUserInfo(req);
    await lock(src,grpId,req.body["id"]);
  }

  async function unlockPost(req){
    let {src,grpId} = extractUserInfo(req);
    await unlock(src,grpId,req.body["id"]);
  }

  async function sendPost(req){
    let {src,grpId} = extractUserInfo(req);
    let data = req.body["data"];
    if(!data)
      throw "need data";
    if(!data.id)
      throw "need data.id";
    let id = data.id;
    delete data.id;
    await update(src,grpId,id,data);
  }

  async function delPost(req){
    let {src,grpId} = extractUserInfo(req);
    await del(src,grpId,req.body["id"]);
  }

  function addPost(action,fct){
    app.post("/"+type+"/"+action, function(req,res){
      fct(req,res)
        .then(ret => res.status(200).send(ret))
        .catch(err => {
          console.log(err);
          res.status(500).send(err);
        });
    });
  }
  
  addPost("lock", lockPost);
  addPost("unlock", unlockPost);
  addPost("send", sendPost);
  addPost("del", delPost);
  return {
    set : (data) => {
      data.id = uuidv4();
      let o = {grpId:"demo",id:data.id,data,lock:false};
      db[data.id] = o;
    },
    onUpdate: fct => onUpdateFct.push(fct)
  };
};
