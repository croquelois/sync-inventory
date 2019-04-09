/* jshint esversion:6, node:true, loopfunc:true, undef: true, unused: true, sub:true */
"use strict";
const uuidv4 = require('uuid/v4');

class Client {
  constructor(req, res){
    req.socket.setTimeout(24*60*60*1000);
    this.messageCount = 0;
    this.write = res.write.bind(res);
    this.alive = true;
    req.on("close", () => this.alive = false);
    this.src = req.query["src"];
    this.grpId = req.params["grpId"];
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked'
    });
    res.write('\n');
  }
  writeMessage(data){
    if(!this.alive) 
      return;
    this.messageCount++;
    this.write('id: ' + this.messageCount + '\n');
    this.write("data: " + ((typeof data != "string") ? JSON.stringify(data) : data) + '\n\n');
  }
}

class Clients {
  constructor(){
    this.clients = {};
    this.onNewCb = [];
    this.onCloseCb = [];
  }
  onNew(fct){
    this.onNewCb.push(fct);
  }
  onClose(fct){
    this.onCloseCb.push(fct);
  }
  newStream(req,res){
    let client = new Client(req,res);
    if(!this.clients[client.grpId])
      this.clients[client.grpId] = [];
    this.clients[client.grpId].push(client);
    req.on("close", () => this.onCloseCb.forEach(fct => fct(client))); // TODO: need also to clean the client list
    this.onNewCb.forEach(fct => fct(client));
  }
  writeMessage(grpId, data){
    if(typeof data != "string")
      data = JSON.stringify(data);
    (this.clients[grpId] || []).forEach(client => client.writeMessage(data));
  }
}

module.exports = function(app){
  let clients = new Clients();  
  app.get("/:grpId/stream", function(req,res){
    try{
      clients.newStream(req,res);
    }catch(err){
      console.log(err.stack?err.stack:err,"try/catch");
      return res.status(500).send(err.stack?err.stack:err);
    }
  });
  app.get("/id", (req,res) => res.status(200).send({id:uuidv4()}));
  return clients;
};
