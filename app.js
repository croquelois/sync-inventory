/* jshint esversion:6, node:true, loopfunc:true, undef: true, unused: true, sub:true */
"use strict";

const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const path = require('path');
const ClientStream = require('./server/ClientStream');

let app = express();
app.set('port', 8086);
app.set('view engine', 'pug');
app.use(bodyParser.json());
app.use(function (error, req, res, next) {
  if (error instanceof SyntaxError) {
    console.log(error);
    res.status(400).send("invalid request");
  } else {
    next();
  }
});
app.use(express.static(path.join(__dirname, 'public')));

let clients = ClientStream(app,"/:grpId/stream",req => ({src: req.query["src"], grpId: req.params["grpId"]}));
require('./server/router')(app, clients);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Server listening on port ' + app.get('port'));
});
