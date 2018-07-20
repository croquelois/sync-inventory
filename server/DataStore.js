/* jshint esversion:6, node:true, loopfunc:true, undef: true, unused: true, sub:true */
"use strict";
const uuidv4 = require('uuid/v4');
let redis = require('redis').createClient();
redis.on("error", err => console.log(err));

module.exports = function(app, title, type, columns){
  let clients = [];

  function stream(req,res){
    let messageCount = 0;
    function writeMessage(data){
      messageCount++;
      res.write('id: ' + messageCount + '\n');
      res.write("data: " + JSON.stringify(data) + '\n\n');
    }
    let src = req.query["src"];
    let client = {writeMessage,alive:true,src};
    clients.push(client);
    req.on("close", function(){
      client.alive = false;
      if(!src)
        return;
      function freeLock(cursor, cb){
        cb = cb || (()=>{});
        redis.hscan("datastore:lock:"+type, cursor, function(err, data){
          if(err){
            console.log("Reddis error: ", err);
            return cb(err);
          }
          let cursor = data[0];
          let ids = data[1].filter((d,i) => !(i%2));
          let srcs = data[1].filter((d,i) => (i%2));
          let locks = ids.map((id,i) => ({id,src:srcs[i]}));
          locks.filter(o => o.src==client.src).forEach(function(o){
            let {src,id} = o;
            redis.hdel("datastore:lock:"+type, id, (err) => {
              if(err){
                console.log("Reddis error: ", err);
                return res.status(500).send(err);
              }
              clients.filter(c => c.alive).forEach(c => c.writeMessage({type:"unlock",id,src}));
            });
          });
          if(cursor == "0")
            return cb();
          freeLock(cursor);
        });
      }
      freeLock("0");
    });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked'
    });
    res.write('\n');
    function scanData(cursor, cb){
      cb = cb || (()=>{});
      redis.hscan("datastore:"+type, cursor, function(err, data){
        if(err){
          console.log("Reddis error: ", err);
          return cb(err);
        }
        let cursor = data[0];
        let ids = data[1].filter((d,i) => !(i%2));
        let datas = data[1].filter((d,i) => (i%2)).map(val => JSON.parse(val));
        datas.forEach((data,i) => data.id = ids[i]);
        datas.forEach(data => writeMessage({type:"new",id:data.id,data}));
        if(cursor == "0")
          return cb();
        scanData(cursor);
      });
    }
    function scanLock(cursor, cb){
      cb = cb || (()=>{});
      redis.hscan("datastore:lock:"+type, cursor, function(err, data){
        if(err){
          console.log("Reddis error: ", err);
          return cb(err);
        }
        let cursor = data[0];
        let ids = data[1].filter((d,i) => !(i%2));
        let srcs = data[1].filter((d,i) => (i%2));
        srcs.forEach((src,i) => writeMessage({type:"lock",id:ids[i],src}));
        if(cursor == "0")
          return cb();
        scanLock(cursor);
      });
    }
    scanData("0");
    scanLock("0");
  }

  function lock(req, res){
    let src = req.body["src"];
    let id = req.body["id"];
    if(!src)
      return res.status(500).send("invalid source id");
    redis.hset("datastore:lock:"+type, id, src, (err) => {
      if(err){
        console.log("Reddis error: ", err);
        return res.status(500).send(err);
      }
      clients.filter(c => c.alive).forEach(c => c.writeMessage({type:"lock",id,src}));
    });
    return res.status(200).send("ok");
  }

  function unlock(req, res){
    let src = req.body["src"];
    if(!src)
      return res.status(500).send("invalid source id");
    let id = req.body["id"];
    redis.hdel("datastore:lock:"+type, id, (err) => {
      if(err){
        console.log("Reddis error: ", err);
        return res.status(500).send(err);
      }
      clients.filter(c => c.alive).forEach(c => c.writeMessage({type:"unlock",id,src}));
    });
    return res.status(200).send("ok");
  }

  function send(req, res){
    let src = req.body["src"];
    let data = req.body["data"];
    if(!data)
      return res.status(500).send("need data");
    if(!data.id)
      return res.status(500).send("need data.id");
    let id = data.id;
    delete data.id;
    redis.hset("datastore:"+type, id, JSON.stringify(data), (err) => {
      if(err){
        console.log("Reddis error: ", err);
        return res.status(500).send(err);
      }
      data.id = id;
      clients.filter(c => c.alive).forEach(c => c.writeMessage({type:"update",data,src}));
      return res.status(200).send("ok");
    });
  }

  function getId(req, res){
    return res.status(200).send({id:uuidv4()});
  }

  function del(req, res){
    let src = req.body["src"];
    let id = req.body["id"];
    redis.hdel("datastore:"+type, id, (err, nb) => {
      if(err)
        return res.status(500).send(err);
      if(!nb)
        return res.status(500).send("unknow id");
      clients.filter(c => c.alive).forEach(c => c.writeMessage({type:"delete",id,src}));
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
  function addStream(action,fct){
    app.get("/"+type+"/"+action, function(req,res){
      req.socket.setTimeout(24*60*60*1000);
      try{
        fct(req,res);
      }catch(err){
        console.log(err.stack?err.stack:err,"try/catch");
        return res.status(500).send(err.stack?err.stack:err);
      }
    });
  }

  addStream("stream", stream);
  addPost("lock", lock);
  addPost("unlock", unlock);
  addPost("getId", getId);
  addPost("send", send);
  addPost("del", del);
  app.get("/"+type, function(req,res){ res.render("tableAndPopup", {title, type, columns}); });
  return function(data){
    redis.hset("datastore:"+type, uuidv4(), JSON.stringify(data), () => {});
  };
};
