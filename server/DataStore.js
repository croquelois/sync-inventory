/* jshint esversion:6, node:true, loopfunc:true, undef: true, unused: true, sub:true */
"use strict";

module.exports = function(app, title, type, columns){
  let db = {};
  let clients = [];
  let id = 1;

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
      Object.keys(db).map(key => db[key]).filter(val => val.lock == client.src).map(val => val.id).forEach(id => {
        db[id].lock = false;
        clients.filter(c => c.alive).forEach(c => c.writeMessage({type:"unlock",id:id,src}));
      });
    });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked'
    });
    res.write('\n');
    Object.keys(db).map(key => db[key]).forEach(val => writeMessage({type:"new",id:val.id,data:val.data,lock:val.lock}));
  }

  function lock(req, res){
    let src = req.body["src"];
    let id = req.body["id"];
    if(!src)
      return res.status(500).send("invalid source id");
    if(!db[id])
      return res.status(500).send("unknow id");
    db[id].lock = src || true;
    clients.filter(c => c.alive).forEach(c => c.writeMessage({type:"lock",id,src}));
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
    clients.filter(c => c.alive).forEach(c => c.writeMessage({type:"unlock",id,src}));
    return res.status(200).send("ok");
  }

  function send(req, res){
    let src = req.body["src"];
    let data = req.body["data"];
    if(!data)
      return res.status(500).send("need data");
    if(!data.id)
      return res.status(500).send("need data.id");
    if(!db[data.id])
      db[data.id] = {id:data.id,data:data,lock:false};
    else
      db[data.id].data = data;
    clients.filter(c => c.alive).forEach(c => c.writeMessage({type:"update",data,src}));
    return res.status(200).send("ok");
  }

  function getId(req, res){
    return res.status(200).send({id:id++});
  }

  function del(req, res){
    let src = req.body["src"];
    let id = req.body["id"];
    if(!db[id])
      return res.status(500).send("unknow id");
    delete db[id];
    clients.filter(c => c.alive).forEach(c => c.writeMessage({type:"delete",id,src}));
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
    data.id = id++;
    db[data.id] = {id:data.id,data,lock:false};
  };
};
