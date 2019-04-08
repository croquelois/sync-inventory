/* jshint esversion:6, node:true, loopfunc:true, undef: true, unused: true, sub:true */
"use strict";
const uuidv4 = require('uuid/v4');

module.exports = function(app, clients, title, type, columns){
  let db = {};
  
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

  function lock(req, res){
    let src = req.body["src"];
    let id = req.body["id"];
    if(!src)
      return res.status(500).send("invalid source id");
    if(!db[id])
      return res.status(500).send("unknow id");
    db[id].lock = src;
    clients.writeMessage(db[id].grpId, {type, action:"lock",id,src});
    return res.status(200).send("ok");
  }

  function unlock(req, res){
    let src = req.body["src"];
    if(!src)
      return res.status(500).send("invalid source id");
    let id = req.body["id"];
    if(!db[id])
      return res.status(500).send("unknow id");
    db[id].lock = false;
    clients.writeMessage(db[id].grpId, {type, action:"unlock",id,src});
    return res.status(200).send("ok");
  }

  function send(req, res){
    let src = req.body["src"];
    let grpId = req.body["grpId"];
    let data = req.body["data"];
    if(!data)
      return res.status(500).send("need data");
    if(!data.id)
      return res.status(500).send("need data.id");
    if(!db[data.id])
      db[data.id] = {grpId, id:data.id, data,lock:false};
    else
      db[data.id].data = data;
    clients.writeMessage(db[data.id].grpId, {type, action:"update", data, src});
    return res.status(200).send("ok");
  }

  function getId(req, res){
    return res.status(200).send({id:uuidv4()});
  }

  function del(req, res){
    let src = req.body["src"];
    let id = req.body["id"];
    if(!db[id])
      return res.status(500).send("unknow id");
    let grpId = db[id].grpId;
    delete db[id];
    clients.writeMessage(grpId, {type, action:"delete", id, src});
    return res.status(200).send("ok");
  }

  function addPost(action,fct){
    app.post("/"+type+"/"+action, function(req,res){
      try{
        fct(req,res);
      }catch(err){
        console.log(err.stack?err.stack:err,"try/catch");
        return res.status(500).send(err.stack?err.stack:err);
      }
    });
  }
  
  addPost("lock", lock);
  addPost("unlock", unlock);
  addPost("getId", getId);
  addPost("send", send);
  addPost("del", del);
  app.get("/"+type, function(req,res){ res.render("tableAndPopup", {title, type, columns}); });
  return function(data){
    data.id = uuidv4();
    let o = {grpId:"demo",id:data.id,data,lock:false};
    db[data.id] = o;
  };
};
