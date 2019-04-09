/* jshint esversion:6, node:true, loopfunc:true, undef: true, unused: true, sub:true */
"use strict";
const useInMemory = false;
let DataStore = require(useInMemory ? "./DataStoreLocal" : "./DataStore");

module.exports = function(app, clients){
  
  let products = DataStore(app, clients, "Products", "product", {
    "name": {title:"Name",type:"string"},
    "type": {title:"Type",type:"choice:Fruit,Vegetable,Bread,Meat"}
  });
  
  products.onUpdate(function(report){
    console.log(report.data);
  });
  
  let storage = DataStore(app, clients, "Storages", "storage", {
    "name": {title:"Name",type:"string"},
    "temperature": {title:"Temperature",type:"double"},
    "availability": {title:"Availability",type:"percent"},
  });
  
  let item = DataStore(app, clients, "Items", "item", {
    "product": {title:"Product",type:"ref:product"},
    "storage": {title:"Storage",type:"ref:storage"},
    "amount": {title:"Amount",type:"integer"},
    "expiration": {title:"Expiration date",type:"string"},
  });

  app.get('*', function(req, res){ res.status(404).send({ title: 'Page Not Found'}); });
  
  let firstSetup = false;
  if(useInMemory || firstSetup){
    products.set({name:"Banana", type:"Fruit"});
    products.set({name:"Pineapple", type:"Fruit"});
    products.set({name:"Apple", type:"Fruit"});
    products.set({name:"Kiwi", type:"Fruit"});
    products.set({name:"Potatoe", type:"Vegetable"});
    products.set({name:"Bean", type:"Vegetable"});
    products.set({name:"Onion", type:"Vegetable"});
    products.set({name:"Salad", type:"Vegetable"});
    products.set({name:"Chicken", type:"Meat"});
    products.set({name:"Beef", type:"Meat"});
    products.set({name:"Lamb", type:"Meat"});
    products.set({name:"White Bread", type:"Bread"});
    products.set({name:"Brown Bread", type:"Bread"});
    storage.set({name:"Freezer", temperature:"0"});
    storage.set({name:"Room A", temperature:"10"});
    storage.set({name:"Room B", temperature:"20"});
    item.set({product:"Banana",storage:"Room A", amount: "5", expiration: "2018-07-20"});
    item.set({product:"Bean",storage:"Room A", amount: "42", expiration: "2018-07-10"});
    item.set({product:"Chicken",storage:"Freezer", amount: "3", expiration: "2018-07-15"});
    item.set({product:"Lamb",storage:"Freezer", amount: "2", expiration: "2018-08-20"});
    item.set({product:"Apple",storage:"Room A", amount: "3", expiration: "2018-09-20"});
    item.set({product:"Onion",storage:"Room A", amount: "7", expiration: "2018-07-15"});
  }
};
