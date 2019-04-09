/* jshint esversion:6, node:true, loopfunc:true, undef: true, unused: true, sub:true */
"use strict";
const uuidv4 = require('uuid/v4');
let redis = require('redis').createClient();
redis.on("error", err => console.log(err));

module.exports = function(app, clients, title, type, columns){
  clients.onNew(function(client){
    let grpId = client.grpId;
    function scanData(cursor, cb){
      cb = cb || (()=>{});
      redis.hscan("datastore:"+grpId+":"+type, cursor, function(err, data){
        if(err){
          console.log("Redis error: ", err);
          return cb(err);
        }
        let cursor = data[0];
        let ids = data[1].filter((d,i) => !(i%2));
        let datas = data[1].filter((d,i) => (i%2)).map(val => JSON.parse(val));
        datas.forEach((data,i) => data.id = ids[i]);
        datas.forEach(data => client.writeMessage({type, action:"new",id:data.id,data}));
        if(cursor == "0")
          return cb();
        scanData(cursor, cb);
      });
    }
    function scanLock(cursor, cb){
      cb = cb || (()=>{});
      redis.hscan("datastore:"+grpId+":lock:"+type, cursor, function(err, data){
        if(err){
          console.log("Redis error: ", err);
          return cb(err);
        }
        let cursor = data[0];
        let ids = data[1].filter((d,i) => !(i%2));
        let srcs = data[1].filter((d,i) => (i%2));
        srcs.forEach((src,i) => client.writeMessage({type, action:"lock",id:ids[i],src}));
        if(cursor == "0")
          return cb();
        scanLock(cursor, cb);
      });
    }
    scanData("0");
    scanLock("0");
  });
  
  clients.onClose(function(client){
    let grpId = client.grpId;
    function freeLock(cursor, cb){
      cb = cb || (()=>{});
      redis.hscan("datastore:"+grpId+":lock:"+type, cursor, function(err, data){
        if(err){
          console.log("Redis error: ", err);
          return cb(err);
        }
        let cursor = data[0];
        let ids = data[1].filter((d,i) => !(i%2));
        let srcs = data[1].filter((d,i) => (i%2));
        let locks = ids.map((id,i) => ({id,src:srcs[i]}));
        locks.filter(o => o.src==client.src).forEach(function(o){
          let {src,id} = o;
          redis.hdel("datastore:"+grpId+":lock:"+type, id, (err) => {
            if(err){
              console.log("Redis error: ", err);
              return;
            }
            clients.writeMessage(grpId, {type, action:"unlock",id,src});
          });
        });
        if(cursor == "0")
          return cb();
        freeLock(cursor, cb);
      });
    }
    freeLock("0");
  });
  
  function lock(req, res){
    let src = req.body["src"];
    let grpId = req.body["grpId"];
    let id = req.body["id"];
    if(!src)
      return res.status(500).send("invalid source id");
    redis.hset("datastore:"+grpId+":lock:"+type, id, src, (err) => {
      if(err){
        console.log("Reddis error: ", err);
        return res.status(500).send(err);
      }
      clients.writeMessage(grpId, {type, action:"lock",id,src});
    });
    return res.status(200).send("ok");
  }

  function unlock(req, res){
    let grpId = req.body["grpId"];
    let src = req.body["src"];
    if(!src)
      return res.status(500).send("invalid source id");
    let id = req.body["id"];
    redis.hdel("datastore:"+grpId+":lock:"+type, id, (err) => {
      if(err){
        console.log("Reddis error: ", err);
        return res.status(500).send(err);
      }
      clients.writeMessage(grpId, {type, action:"unlock",id,src});
    });
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
    let id = data.id;
    delete data.id;
    redis.hset("datastore:"+grpId+":"+type, id, JSON.stringify(data), (err) => {
      if(err){
        console.log("Reddis error: ", err);
        return res.status(500).send(err);
      }
      data.id = id;
      clients.writeMessage(grpId, {type, action:"update",id,src});
      return res.status(200).send("ok");
    });
  }

  function del(req, res){
    let src = req.body["src"];
    let grpId = req.body["grpId"];
    let id = req.body["id"];
    redis.hdel("datastore:"+grpId+":"+type, id, (err, nb) => {
      if(err)
        return res.status(500).send(err);
      if(!nb)
        return res.status(500).send("unknow id");
      clients.writeMessage(grpId, {type, action:"delete",id,src});
      return res.status(200).send("ok");
    });
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
  addPost("send", send);
  addPost("del", del);
  app.get("/"+type, function(req,res){ res.render("tableAndPopup", {title, type, columns}); });
  return function(data){
    redis.hset("datastore:demo:"+type, uuidv4(), JSON.stringify(data), () => {});
  };
};
