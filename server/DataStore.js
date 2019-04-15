/* jshint esversion:9, node:true, loopfunc:true, undef: true, unused: true, sub:true */
"use strict";
const uuidv4 = require('uuid/v4');
const Mutex = require('./Mutex');
let redis = require('redis').createClient();
redis.on("error", err => console.log(err));

function hset(hash, key, val){
  console.log(key,val);
  return new Promise(function(resolve, reject){
    redis.hset(hash, key, val, (err) => err ? reject(err) : resolve());
  });
}

function hget(hash, key){
  console.log(key);
  return new Promise(function(resolve, reject){
    redis.hget(hash, key, (err,res) => err ? reject(err) : resolve(JSON.parse(res)));
  });
}

function hdel(hash, key){
  return new Promise(function(resolve, reject){
    redis.hdel(hash, key, (err) => err ? reject(err) : resolve());
  });
}

module.exports = function(app, clients, title, type, columns){
  let onUpdateFct = [];
  let me = uuidv4();
  let mutex = new Mutex();
  
  function extractUserInfo(req){
    let src = req.body["src"];
    if(!src)
      throw "invalid source id";
    let grpId = req.body["grpId"];
    return {src,grpId};
  }
  
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
        let ids = data[1].filter((d,i) => (i%2) == 0);
        let datas = data[1].filter((d,i) => (i%2) == 1).map(val => JSON.parse(val));
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
        let ids = data[1].filter((d,i) => (i%2) == 0);
        let srcs = data[1].filter((d,i) => (i%2) == 1);
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
        let ids = data[1].filter((d,i) => (i%2) == 0);
        let srcs = data[1].filter((d,i) => (i%2) == 1);
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
  
  async function lock(src, grpId, id){
    await hset("datastore:"+grpId+":lock:"+type, id, src);
    clients.writeMessage(grpId, {type, action:"lock",id,src});
  }
  
  async function unlock(src, grpId, id){
    await hdel("datastore:"+grpId+":lock:"+type, id);
    clients.writeMessage(grpId, {type, action:"unlock",id,src});
  }
  
  async function update(src, grpId, id, data){
    Object.keys(data).forEach(key => {
      if(!columns[key] || (columns[key].opt && columns[key].readonly))
        delete data[key];
    });
    let unlock = await mutex.lock();
    try {
      let oldData = await hget("datastore:"+grpId+":"+type, id);
      if(!oldData){
        Object.keys(columns).forEach(key => {
          if(data[key] === undefined && columns[key].opt && columns[key].default)
            data[key] = (columns[key].default || "");
        });
      }else{
        Object.keys(columns).filter(key => data[key] === undefined).forEach(key => data[key] = oldData[key]);
      }
      await hset("datastore:"+grpId+":"+type, id, JSON.stringify(data));
    }catch(ex){
      unlock();
      throw ex;
    }
    unlock();
    data.id = id;
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
    await hdel("datastore:"+grpId+":"+type, id);
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
  app.get("/"+type, function(req,res){ res.render("tableAndPopup", {title, type, columns}); });
  return {
    set : (data) => redis.hset("datastore:demo:"+type, uuidv4(), JSON.stringify(data), () => {}),
    onUpdate: fct => onUpdateFct.push(fct)
  };
};
