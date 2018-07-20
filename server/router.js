/* jshint esversion:6, node:true, loopfunc:true, undef: true, unused: true, sub:true */
"use strict";
let DataStore = require("./DataStore");

module.exports = function(app){
  
  let products = DataStore(app, "Products", "product", {
    "name": {title:"Name",type:"string"},
    "type": {title:"Type",type:"choice:Fruit,Vegetable,Bread,Meat"}
  });
  
  let storage = DataStore(app, "Storages", "storage", {
    "name": {title:"Name",type:"string"},
    "temperature": {title:"Temperature",type:"double"}
  });
  
  let item = DataStore(app, "Items", "item", {
    "product": {title:"Product",type:"ref:product"},
    "storage": {title:"Storage",type:"ref:storage"},
    "amount": {title:"Amount",type:"doulbe"},
    "expiration": {title:"Expiration date",type:"string"},
  });

  app.get('*', function(req, res){ res.status(404).send({ title: 'Page Not Found'}); });
  
  let firstSetup = false;
  if(firstSetup){
    products({name:"Banana", type:"Fruit"});
    products({name:"Pineapple", type:"Fruit"});
    products({name:"Apple", type:"Fruit"});
    products({name:"Kiwi", type:"Fruit"});
    products({name:"Potatoe", type:"Vegetable"});
    products({name:"Bean", type:"Vegetable"});
    products({name:"Onion", type:"Vegetable"});
    products({name:"Salad", type:"Vegetable"});
    products({name:"Chicken", type:"Meat"});
    products({name:"Beef", type:"Meat"});
    products({name:"Lamb", type:"Meat"});
    products({name:"White Bread", type:"Bread"});
    products({name:"Brown Bread", type:"Bread"});
    storage({name:"Freezer", temperature:"0"});
    storage({name:"Room A", temperature:"10"});
    storage({name:"Room B", temperature:"20"});
    item({product:"Banana",storage:"Room A", amount: "5", expiration: "2018-07-20"});
    item({product:"Bean",storage:"Room A", amount: "42", expiration: "2018-07-10"});
    item({product:"Chicken",storage:"Freezer", amount: "3", expiration: "2018-07-15"});
    item({product:"Lamb",storage:"Freezer", amount: "2", expiration: "2018-08-20"});
    item({product:"Apple",storage:"Room A", amount: "3", expiration: "2018-09-20"});
    item({product:"Onion",storage:"Room A", amount: "7", expiration: "2018-07-15"});
  }
};
