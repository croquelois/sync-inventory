/* jshint esversion:6, loopfunc:true, undef: true, unused: true, sub:true */
/* globals $, Materialize, MessageSender */
/* exported DataStorage */
let DataStorage = (function(){
"use strict";

function getHeaders(table){
  return table.children("thead").children("tr").first().children("th").toArray()
              .map(div => $(div).attr("data-field") || $(div).text());
}

function DataStorage(url, messageListener, itemtype, table, popup, newBtn ,map){
  let headers = getHeaders(table);
  popup.modal({ dismissible: false });
  let body = table.children("tbody");
  let inPopup = null;
  let popupMode = "read";
  let store = {};
  let autocomplete = {};
  map = map || ((data,h,v) => (v===undefined?data[h]:data[h]=v));
  body.empty();
  let messageSender = new MessageSender(messageListener.id, messageListener.grpId, url + "/" + itemtype);

  function error(msg){
    Materialize.toast('error: ' + msg, 3000, 'rounded red');
  }

  function feedPopup(){
    popup.find("div[data-field]").each(function(){
      let div = $(this);
      div.text(map(inPopup.data,div.attr("data-field"))||"");
    });
  }

  function div2input(){
    popup.find("div[data-field]").each(function(){
      let div = $(this);
      let text = div.text();
      div.empty();

      let type = div.attr("data-type");
      if(type.slice(0,7) == "choice:"){
        /*
        let id = "dropdown-"+div.attr("data-field");
        let a = $("<a>").attr("data-activates",id).addClass("dropdown-button").text(text);
        let ul = $("<ul>").attr("id",id).addClass("dropdown-content");
        type.slice(7).split(",").forEach(item => ul.append($("<li>").append($("<a>").text(item).click(() => a.text(item)))));
        div.append(ul);
        div.append(a);
        a.dropdown({});
        //ul.detach().appendTo($("body")).css("z-index", popup.css("z-index")+1);*/

        let s = $("<select>").addClass("browser-default");
        type.slice(7).split(",").forEach(item => s.append($("<option>").text(item)));
        div.append(s);
      }else if(type.slice(0,4) == "ref:"){
        let tmp = /^ref\:([^\.]*)\.(.+)$/.exec(type);
        let s = $("<input>").val(text);
        div.append(s);
        if(tmp)
          s.autocomplete({
            data: autocomplete[tmp[1]](tmp[2]),
            limit: 20
          });
      }else if(type == "percent"){
        let input = $("<input>").val(text);
        div.append(input);
        input.change(() => input.val((idx, old) => old.replace(/[^\-0-9\.]/g, '') + '%'));
      }else if(type == "double"){
        let input = $("<input>").val(text);
        div.append(input);
        input.change(() => input.val((idx, old) => old.replace(/[^\-0-9\.]/g, '')));
      }else if(type == "integer"){
        let input = $("<input>").val(text);
        div.append(input);
        input.change(() => input.val((idx, old) => old.replace(/[^\-0-9]/g, '')));
      }else{
        div.append($("<input>").val(text));
      }
    });
  }

  function getVal(div){
    /*if(div.find(".dropdown-button").length)
      return div.find(".dropdown-button").text();*/
    if(div.find("select").length)
      return div.find("select").val();
    return div.find("input").val();
  }

  function input2div(){
    popup.find("div[data-field]").each(function(){
      let div = $(this);
      let text = getVal(div);
      div.empty();
      div.text(text);
    });
  }

  function dataFromPopup(){
    popup.find("div[data-field]").each(function(){
      let div = $(this);
      map(inPopup.data,div.attr("data-field"),getVal(div));
    });
  }

  function updateRow(info){
    info.tr.empty();
    headers.map(h => $("<td>").text(map(info.data,h))).forEach(td => info.tr.append(td));
  }

  function clickOnCell(){
    /*jshint validthis:true*/
    inPopup = store[$(this).attr('id')];
    popupMode = "read";
    feedPopup();
    popup.modal("open");
    popup.removeClass("wait");
    popup.removeClass("locked");
    popup.find("#ok").show();
    popup.find("#edit").show();
    popup.find("#save").hide();
    popup.find("#cancel").hide();
    popup.find("#delete").hide();
    if(inPopup.tr.hasClass("locked")){
      popup.addClass("locked");
      popup.find("#edit").hide();
    }
  }

  let blockLevel = 0;
  function block(){
    if(!blockLevel){
      popup.addClass("wait");
    }
    blockLevel++;
  }

  function unblock(){
    blockLevel--;
    if(!blockLevel){
      popup.removeClass("wait");
    }
  }

  function unblockWithError(err){
    unblock();
    error(err);
  }

  popup.find("#edit").click(function(){
    block();
    messageSender.lock(inPopup.id,function(err){
      if(err) return unblockWithError(err);
      unblock();
      popupMode = "edit";
      popup.find("#ok").hide();
      popup.find("#edit").hide();
      popup.find("#save").show();
      popup.find("#cancel").show();
      popup.find("#delete").show();
      div2input();
    });
  });
  
  (function(){
    let map = {};
    popup.find("div[data-field]").each(function(){
      let type = $(this).attr("data-type");
      let tmp = /^ref\:([^\.]*)\.(.+)$/.exec(type);
      if(tmp)
        map[tmp[1]] = true;
    });
    Object.keys(map).forEach(function(itemtype){
      let store = {};
      messageListener.listen(itemtype, function(type,action,id,data) {
        let info = store[id];
        if(!info && data)
          info = store[id] = {id:id};
        if(action == "new" || action == "update"){
          info.data = data;
        }else if(action == "delete"){
          delete store[id];
        }
      });
      autocomplete[itemtype] = function(field){
        let map = {};
        Object.keys(store).forEach(k => map[store[k].data[field]]=null);
        return map;
      };
    });
  })();
  
  function saveNew(){
    messageSender.getId(function(err, id){
      if(err) return unblockWithError(err);
      inPopup.data.id = inPopup.id = id;
      messageSender.send(inPopup.data, function(err){
        if(err) return unblockWithError(err);
        let tr = inPopup.tr = $("<tr>").attr("id",inPopup.id);
        tr.click(clickOnCell);
        store[id] = inPopup;
        updateRow(inPopup);
        body.append(tr);
        messageSender.unlock(inPopup.id,function(err){
          if(err) return unblockWithError(err);
          input2div();
          unblock();
          popup.modal('close');
        });
      });
    });
  }

  function update(){
    messageSender.send(inPopup.data, function(err){
      if(err) return unblockWithError(err);
      updateRow(inPopup);
      messageSender.unlock(inPopup.id,function(err){
        if(err) return unblockWithError(err);
        input2div();
        unblock();
        popup.modal('close');
      });
    });
  }

  popup.find("#save").click(function(){
    if(popupMode != "edit")
      return;
    block();
    dataFromPopup();
    if(!inPopup.tr)
      saveNew();
    else
      update();
  });

  popup.find("#delete").click(function(){
    if(popupMode != "edit")
      return;

    block();
    messageSender.remove(inPopup.id, function(err){
      if(err) return unblockWithError(err);
      unblock();
      delete store[inPopup.id];
      inPopup.tr.remove();
      popup.modal('close');
    });
  });

  popup.find("#cancel").click(function(){
    if(!inPopup.tr)
      return popup.modal('close');
    block();
    messageSender.unlock(inPopup.id,function(err){
      if(err) return unblockWithError(err);
      unblock();
      popup.modal('close');
    });
  });

  newBtn.click(function(){
    inPopup = {data:{}};
    popupMode = "edit";
    feedPopup();
    popup.modal("open");
    popup.removeClass("wait");
    popup.removeClass("locked");
    popup.find("#ok").hide();
    popup.find("#edit").hide();
    popup.find("#delete").hide();
    popup.find("#save").show();
    popup.find("#cancel").show();
    div2input();
  });

  messageListener.listen(itemtype, function(action,id,data,lock) {
    console.log(action, id, data, lock);
    let info = store[id];
    let tr = info && info.tr;
    if(!info && data){
      tr = $("<tr>").attr("id",id);
      body.append(tr);
      tr.click(clickOnCell);
      info = store[id] = {id:id,tr};
    }
    if(action == "new" || action == "update"){
      info.data = data;
      updateRow(info);
      if(inPopup == info) feedPopup();
    }else if(action == "delete"){
      delete store[id];
      if(tr)
        tr.remove();
      if(inPopup == info){
        popup.find("#edit").hide();
        popup.find("#save").hide();
        popup.find("#delete").hide();
        popup.addClass("locked");
      }
    }
    if(action == "lock" || lock){
      if(tr)
        tr.addClass("locked");
      if(inPopup == info){
        popup.addClass("locked");
        popup.find("#edit").hide();
        popup.find("#delete").hide();
        popup.find("#save").hide();
      }
    }
    if(action == "unlock"){
      if(tr)
        tr.removeClass("locked");
      if(inPopup == info){
        if(popupMode == "read"){
          popup.removeClass("locked");
          popup.find("#edit").show();
        }
      }
    }
  });
}



return DataStorage;

})();
