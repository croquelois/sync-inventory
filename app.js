/* jshint esversion:6, node:true, loopfunc:true, undef: true, unused: true, sub:true */
"use strict";

let express = require('express');
let bodyParser = require('body-parser');
let http = require('http');
let path = require('path');
let config = require('./config');

let app = express();

// all environments
app.set('port', config.port || 80);
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

require('./server/router')(app);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Server listening on port ' + app.get('port'));
});
