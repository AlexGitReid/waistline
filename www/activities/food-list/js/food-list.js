/*
  Copyright 2018 David Healey

  This file is part of Waistline.

  Waistline is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  Waistline is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with Waistline.  If not, see <http://www.gnu.org/licenses/>.
*/

var foodList = {

  list:[],
  images:[], //Place to store image uris when uploading a product to Open Food Facts
  lastPageId:null, //ID of the page that got us to this page, if there was one
  editFormData:{}, //When edit form is populated store a copy of its data here for reference
  nutriments:["calories", "fat", "saturated-fat", "carbs", "sugar", "protein", "salt"],

  fillListFromDB : function()
  {
    return new Promise(function(resolve, reject){

      var date = new Date()
      var dateTime = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()));

      foodList.list = []; //Clear list

      dbHandler.getIndex("dateTime", "foodList").openCursor(IDBKeyRange.upperBound(dateTime), "prev").onsuccess = function(e)
      {
        var cursor = e.target.result;

        if (cursor)
        {
          foodList.list.push(cursor.value);
          cursor.continue();
        }
        else
        {
          resolve();
        }
      };
    });
  },

  filterList : function(term)
  {
    return filteredList = foodList.list.filter(function (el) {
      return (el.name.match(new RegExp(term, "i")) || el.brand.match(new RegExp(term, "i"))); //Allow partial match and case insensitive
    });
  },

  populate : function(list)
  {
    var html = "";

    for (var i = 0; i < list.length; i++)
    {
      if (list[i].id) //Item has an ID, then it must already be in the database
      {
        html += "<ons-list-item tappable modifier='longdivider' class='foodListItem' data='"+JSON.stringify(list[i])+"'>";
        html += "<label class='right'>";
        html += "<ons-checkbox name='food-item-checkbox' input-id='"+unescape(list[i].name)+"' data='"+JSON.stringify(list[i])+"'></ons-checkbox>";
        html += "</label>";
        html += "<label for='"+unescape(list[i].name)+"' class='center'>";
        html += "<ons-row>"+unescape(list[i].brand)+"</ons-row>";
        html += "<ons-row style='color:#636363;'><i>" + unescape(list[i].name) + " - " + list[i].portion + "</i></ons-row>";
        html += "</label>";
      }
      else //Item doesn't have an id, must have been found by searching
      {
        html += "<ons-list-item modifier='chevron' tappable class='searchItem' data='"+JSON.stringify(list[i])+"'>";
        html += "<ons-row>"+unescape(list[i].brand)+"</ons-row>";
        html += "<ons-row>" + unescape(list[i].name) + " - " + list[i].portion + "</ons-row>"
        html += "<ons-row style='color:#636363;'><i>" + list[i].nutrition.calories + " " + app.strings["calories"] + "</i></ons-row>";
      }

      html += "</ons-list-item>";
    }

    $("#food-list-page #food-list").html(html); //Insert into HTML
  },

  fillEditForm : function(data)
  {
    data.id ? $("#edit-food-item #title").html("Edit Food") : $("#edit-food-item #title").html("Add Food");
    $("#edit-food-item #id").val(data.id);
    $("#edit-food-item #barcode").val(data.barcode);
    $("#edit-food-item #name").val(unescape(data.name));
    $("#edit-food-item #brand").val(unescape(data.brand));
    $("#edit-food-item #original-portion").val(parseFloat(data.portion));
    $("#edit-food-item #portion").val(parseFloat(data.portion));
    $("#edit-food-item #unit").val(data.portion.replace(/[^a-z]/gi, ''));
    $("#edit-food-item #calories").val(data.nutrition.calories);
    $("#edit-food-item #protein").val(data.nutrition.protein);
    $("#edit-food-item #carbs").val(data.nutrition.carbs);
    $("#edit-food-item #fat").val(data.nutrition.fat);
    $("#edit-food-item #saturated-fat").val(data.nutrition["saturated-fat"]);
    $("#edit-food-item #sugar").val(data.nutrition.sugar);
    $("#edit-food-item #salt").val(parseFloat(data.nutrition.salt).toFixed(2));

    //Store form data in global object
    var formData = $("#edit-food-item #edit-item-form").serializeArray();

    foodList.editFormData = {};
    for (i = 0; i < formData.length; i++)
    {
      foodList.editFormData[formData[i].name] = formData[i].value;
    }

    //Display image
    if (data.image_url && data.image_url != "undefined" && navigator.connection.type != "none" && app.storage.getItem("show-images") === "true")
    {
      $('#edit-food-item #foodImage').html("<ons-card><img style='display:block; height:auto; width:75%; margin:auto;'></img></ons-card>");
      $('#edit-food-item #foodImage img').attr("src", unescape(data.image_url));
    }
  },

  //Localises the placeholders of the form input boxes
  localizeEditForm : function()
  {
    var inputs = $("#edit-food-item ons-input");
    var placeholder = "";

    for (var i = 0; i < inputs.length; i++)
    {
      placeholder = app.strings["food-list"]["edit-item"]["placeholders"][$(inputs[i]).attr("id")];
      $(inputs[i]).attr("placeholder", placeholder);
    }
  },

  localizeUploadForm : function()
  {
    var inputs = $("#upload-food-item ons-input");
    var placeholder = "";

    for (var i = 0; i < inputs.length; i++)
    {
      placeholder = app.strings["food-list"]["upload-item"]["placeholders"][$(inputs[i]).attr("id")];
      $(inputs[i]).attr("placeholder", placeholder);
    }
  },

  changePortion : function(newPortion)
  {
    var f = "#edit-food-item #edit-item-form"; //jQuery Selector for form
    var formData = foodList.editFormData; //Get reference form data

    //Adjust value of each nutriment based on new portion
    for (i = 0; i < foodList.nutriments.length; i++) //Each nutriment
    {
      var n = foodList.nutriments[i]; //Get nutriment name
      var v = (formData[n] / formData.portion) * newPortion //New value

      n == "calories" ? $(f + " #"+n).val(parseInt(v)) : $(f + " #"+n).val(v.toFixed(2));
    }
  },

  processEditForm : function()
  {
    return new Promise(function(resolve, reject){
      var data = {}; //Data to insert/update in DB
      var form = $("#edit-food-item #edit-item-form")[0]; //Get form data

      //Get form values
      var id = parseInt(form.id.value); //ID is hidden field
      data.barcode = form.barcode.value; //Barcode is hidden field
      data.name = escape(form.name.value);
      data.brand = escape(form.brand.value); //Should only be 1 brand per product
      data.image_url = escape($('#edit-food-item #foodImage img').attr("src"));
      data.portion = form.portion.value + form.unit.value;
      data.nutrition = {
        "calories":parseFloat(form.calories.value),
        "protein":parseFloat(form.protein.value),
        "carbs":parseFloat(form.carbs.value),
        "fat":parseFloat(form.fat.value),
        "saturated-fat":parseFloat(form.saturated-fat.value),
        "sugar":parseFloat(form.sugar.value),
        "salt":parseFloat(form.salt.value),
      };

      var date = new Date()
      data.dateTime = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()));

      if (isNaN(id) == false) {data.id = id}; //Add ID for existing items

      //Add/update food item
      if (data.id == undefined){
        dbHandler.insert(data, "foodList").onsuccess = function(){resolve();}
      }
      else {
        dbHandler.update(data, "foodList", id)
        .then(resolve());
      }
    });
  },

  deleteEntry : function(id)
  {
    //Remove the item from the diary table and get the request handler
    var request = dbHandler.deleteItem(parseInt(id), "foodList");

    //If the request was successful repopulate the list
    request.onsuccess = function(e) {
      foodList.fillListFromDB()
      .then(function(){foodList.populate(foodList.list)});
    };
  },

  scan : function()
  {
    //First check that there is an internet connection
    if (navigator.connection.type == "none")
    {
      ons.notification.alert(app.strings["no-internet"]);
      return false;
    }

    cordova.plugins.barcodeScanner.scan(function(scanData){

      //var code = "40084077"; //Test barcode
      var code = scanData.text;
      var request = new XMLHttpRequest();

      request.open("GET", "https://world.openfoodfacts.org/api/v0/product/"+code+".json", true);
      request.send();

      $("#food-list-page ons-progress-circular").show(); //Circular progress indicator

      request.onreadystatechange = function(){

        if (request.readyState == 4 && request.status == 200)
        {
          var result = jQuery.parseJSON(request.responseText);

          if (result.status == 0) //Product not found
          {
            //Ask the user if they would like to add the product to the open food facts database
            ons.notification.confirm("Would you like to add this product to the Open Food Facts database?", {"title":"Product not found", "cancelable":true})
            .then(function(input) {
              if (input == 1) {
                nav.pushPage("activities/food-list/views/upload-item.html", {"data":{"code":code}});
              }
            });

            $("#food-list-page ons-progress-circular").hide();
            return false;
          }

          //First check if the product has already been added to the food list - to avoid duplicates
          var item = {}
          var index = dbHandler.getIndex("barcode", "foodList");
          index.get(result.code).onsuccess = function(e)
          {
            e.target.result ? item = e.target.result : item = foodList.parseOFFProduct(result.product);

            //Go to food item edit form and fill in form with retrieved data
            nav.pushPage("activities/food-list/views/edit-item.html", {"data":item})
              .then(function() {foodList.fillEditForm(item)});
          }
        }
      };
    },
    function(e)
    {
      ons.notification.alert(app.strings["food-list"]["scan-failed"] + ": " + e);
      $("#food-list-page ons-progress-circular").hide(); //Circular progress indicator
      return false;
    });
  },

  search : function(term)
  {
    //First check that there is an internet connection
    if (navigator.connection.type == "none")
    {
      ons.notification.alert(app.strings["no-internet"]);
      return false;
    }

    var request = new XMLHttpRequest();

    request.open("GET", "https://world.openfoodfacts.org/cgi/search.pl?search_terms="+term+"&search_simple=1&page_size=100&sort_by=last_modified_t&action=process&json=1", true);
    request.send();

    $("#food-list-page ons-progress-circular").show(); //Circular progress indicator

    request.onreadystatechange = function(){

      if (request.readyState == 4 && request.status == 200)
      {
        var result = JSON.parse(request.responseText);

        if (result.products.length == 0)
        {
          ons.notification.alert(app.strings["food-list"]["no-results"]);
          $("#food-list-page ons-progress-circular").hide(); //Circular progress indicator
          return false;
        }
        else
        {
          var products = result.products;

          foodList.list = []; //Clear list
          var item = {};
          for (var i = 0; i <  products.length; i++)
          {
            item = foodList.parseOFFProduct(products[i]);
            foodList.list.push(item);
          }
          foodList.populate(foodList.list);
          $("#food-list-page ons-progress-circular").hide(); //Circular progress indicator
        }
      }
    };
  },

  //Open food facts product parser
  parseOFFProduct : function(product)
  {
    var item = {};

    var brands = product.brands || "";
    var n = brands.indexOf(','); //Only first brand should be displayed, use this to get rid of any after ,

    item.name = escape(product.product_name);
    item.brand = escape(brands.substring(0, n != -1 ? n : brands.length)); //Should only be 1 brand per product
    item.image_url = escape(product.image_url);
    item.barcode = product.code;

    //Get best match for portion/serving size
    if (product.nutrition_data_per == "serving" || (product.serving_size && product.nutriments.energy_serving))
    {
      item.portion = product.serving_size.replace(/\s+/g, ''); //Remove white space
      item.nutrition = {
        calories: product.nutriments.energy_serving,
        protein: product.nutriments.proteins_serving,
        carbs: product.nutriments.carbohydrates_serving,
        sugar: product.nutriments.sugars_serving,
        fat: product.nutriments.fat_serving,
        "saturated-fat": product.nutriments["saturated-fat_serving"],
        salt: product.nutriments.salt_serving
      }
    }
    else if (product.nutrition_data_per == "100g" && product.nutriments.energy_100g)
    {
      item.portion = "100g";
      item.nutrition = {
        calories: product.nutriments.energy_100g,
        protein: product.nutriments.proteins_100g,
        carbs: product.nutriments.carbohydrates_100g,
        sugar: product.nutriments.sugars_100g,
        fat: product.nutriments.fat_100g,
        "saturated-fat": product.nutriments["saturated-fat_100g"],
        salt: product.nutriments.salt_100g
      }
    }
    else if (product.quantity) //If all else fails
    {
      item.portion = product.quantity;
      item.nutrition = {
        calories: product.nutriments.energy_value,
        protein: product.nutriments.proteins,
        carbs: product.nutriments.carbohydrates,
        sugar: product.nutriments.sugars,
        fat: product.nutriments.fat,
        "saturated-fat": product.nutriments["saturated-fat"],
        salt: product.nutriments.salt
      }
    }

    //Kilojules to kcalories
    if (product.nutriments.energy_unit == "kJ")
    {
      item.calories = parseInt(item.calories / 4.15);
    }

    return item;
  },

  takePicture : function()
  {
    var options = {"allowEdit":true, "saveToPhotoAlbum":false};

    var image = app.takePicture(options)
    .then(function(image){

      //Ask the user to select the type of image
      ons.openActionSheet({
        title: 'What is this image of?',
        buttons: ['Front Image', 'Ingredients', 'Nutrition']
      })
      .then(function(input){
        var imageTypes = ["front", "ingredients", "nutrition"];

        //Make sure there is only one image per imagefield
        for (var i = 0; i < foodList.images.length; i++)
        {
          if (foodList.images[i].imagefield == imageTypes[input])
          {
            foodList.images.splice(i, 1); //Remove item from images array
            $("#upload-food-item #images #"+input).remove(); //Remove carousel item
          }
        }

        var imageData = {"imagefield":imageTypes[input], "path":image, "uploadType":"imgupload_"+imageTypes[input]};
        foodList.images.push(imageData);

        $("#upload-food-item #images").show(); //Reveal image card

        var html ="<ons-carousel-item id='"+input+"'>";
        html += "<img style='width:95%;' src='"+image+"'></img>";
        html += "</ons-carousel-item>";

        $("#upload-food-item #images ons-carousel").append(html);
      });
    });
  },

  uploadProductInfoToOFF : function(data)
  {
    return new Promise(function(resolve, reject){
      //Upload product info
      var request = new XMLHttpRequest();

      //request.open("GET", "https://off:off@world.openfoodfacts.net/cgi/product_jqm2.pl?"+data, true); //Testing server
      request.open("GET", "https://world.openfoodfacts.org/cgi/product_jqm2.pl?"+data, true); //Live server
      request.setRequestHeader("Content-Type", "multipart/form-data");
      request.withCredentials = true;

      request.onload = function() {
        if (this.status >= 200 && this.status < 300) {
         resolve(request.response);
        } else {
         reject({
           status: this.status,
           statusText: request.statusText
         });
        }
      };

      request.onerror = function() {
        reject({
          status: this.status,
          statusText: request.statusText
        });
      };

      request.send();
    });
  },

  uploadImageToOFF : function(code, imageData)
  {
    window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function (fs) {

       console.log('file system open: ' + fs.name);

         window.resolveLocalFileSystemURL(imageData.path, function (fileEntry) {

              console.log("Got the file: " + imageData.imagefield);

              fileEntry.file(function (file) {

                  var reader = new FileReader();
                  reader.onloadend = function() {

                      // Create a blob based on the FileReader "result", which we asked to be retrieved as an ArrayBuffer
                      var blob = new Blob([new Uint8Array(this.result)], { type: "image/png" });

                      var formData = new FormData();
                      formData.append(imageData.uploadType, blob);
                      formData.append("code", code);
                      formData.append("imagefield", imageData.imagefield);

                      console.log("Upload start");

                      var request = new XMLHttpRequest();

                      //request.open("POST", "https://off:off@world.openfoodfacts.net/cgi/product_image_upload.pl", true); //Testing server
                      request.open("POST", "https://world.openfoodfacts.org/cgi/product_image_upload.pl", true); //Live server
                      request.setRequestHeader("Content-Type", "multipart/form-data");
                      request.withCredentials = true;

                      request.onload = function (e) {
                        console.log("Image uploaded: " + imageData.imagefield);
                      };
                      request.send(formData);
                  };

                  // Read the file as an ArrayBuffer
                  reader.readAsArrayBuffer(file);
              }, function (err) { console.error('error getting fileentry file!' + err); reject();});
          }, function (err) { console.error('error getting file! ' + err); reject();});
      }, function (err) { console.error('error getting persistent fs! ' + err); reject();});
  },

  validateUploadForm : function()
  {
    var name = $("#upload-item-form #name").val();
    var brand = $("#upload-item-form #brand").val();
    var serving_size = $("#upload-item-form #serving_size").val();
    var unit = $("#upload-item-form #unit").val();
    var calories = $("#upload-item-form #calories").val();

    //First check that there is an internet connection
    if (navigator.connection.type == "none")
    {
      ons.notification.alert(app.strings["no-internet"]);
      return false;
    }

    if (name != "" && brand != "" && serving_size != "" && unit != "" && calories != "" && !isNaN(calories)) {
      return true;
    } else {
      ons.notification.alert(app.strings["dialogs"]["required-fields"]);
      return false;
    }
  },
}

//Food list page display
$(document).on("show", "#food-list-page", function(e){

  var lastPage = this.previousSibling || null; //Get ID of previous page

  if (lastPage != null)
  {
    foodList.lastPageId = lastPage.id; //Make it available throughout the class

    $("#food-list-page #menu-button").hide(); //Hide menu button, back button will be visible instead
    if (lastPage.id == "edit-meal") $("#food-list-page #meal-button").hide(); //If we got here from the meal edit page, hide the meal button
  }
  else { //No last page
    $("#food-list-page #back-button").hide();
    $("#food-list-page #meal-button").hide();
  }

  $("#food-list-page ons-progress-circular").hide(); //Hide circular progress indicator
  $("#food-list-page ons-toolbar-button#submit").hide(); //Hide submit button until items are checked
  $("#food-list-page ons-toolbar-button#scan").show(); //show scan button
  foodList.populate(foodList.list);
});

$(document).on("init", "#food-list-page", function(e){
  foodList.fillListFromDB()
  .then(function(){
    foodList.populate(foodList.list);
  });
});

$(document).on("keyup", "#food-list-page #filter", function(e){

  if (this.value == "") //Search box cleared, reset the list
  {
    foodList.fillListFromDB()
    .then(function(){
      foodList.populate(foodList.list);
    });
  }
  else { //Filter the list
    var filteredList = foodList.filterList(this.value);
    foodList.populate(filteredList);
  }
});

//Delete item from food list by holding
$(document).on("hold", "#food-list-page #food-list ons-list-item", function(e) {

  var data = JSON.parse($(this).attr("data"));

  //Show confirmation dialog
  ons.notification.confirm(app.strings["dialogs"]["confirm-delete"])
  .then(function(input) {
    if (input == 1) {//Delete was confirmed
      foodList.deleteEntry(data.id);
    }
  });
});

$(document).on("change", "#food-list-page #food-list ons-checkbox", function(e){
  var checked = $('input[name=food-item-checkbox]:checked'); //Get all checked items
  if (checked.length > 0)
  {
    $("#food-list-page ons-toolbar-button#submit").show(); //show submit button
    $("#food-list-page ons-toolbar-button#scan").hide(); //hide scan button
    $("#food-list-page #meal-button").hide(); //Hide meal button
  }
  else
  {
    $("#food-list-page ons-toolbar-button#submit").hide(); //hide submit button
    $("#food-list-page ons-toolbar-button#scan").show(); //show scan button
    if (foodList.lastPageId != null) $("#food-list-page #meal-button").show(); //Show meal button
  }
});

//Add multiple items to diary by checking them and tapping the check button
$(document).on("tap", "#food-list-page #submit", function(e) {

  var checked = $('input[name=food-item-checkbox]:checked'); //Get all checked items

  if (checked.length > 0) //At least 1 item was selected
  {
    if (foodList.lastPageId == "diary-page" || foodList.lastPageId == null)
    {
      if (foodList.lastPageId == null) //No last page
      {
        //Allow user to select diary category
        var categories = JSON.parse(app.storage.getItem("meal-names"));
        var options = [];
        for (var i = 0; i < categories.length; i++)
        {
          if (categories[i] == "") continue; //Skip unset meal names
          options[i] = categories[i];
        }

        //Ask the user to select the type of image
        ons.openActionSheet({
          title: 'What meal is this?',
          buttons: options
        })
        .then(function(input){

          diary.setCategory(input); //Set the diary category

          //Add each item to diary
          for (var i = 0; i < checked.length; i++)
          {
            var data = JSON.parse(checked[i].offsetParent.attributes.data.value); //Parse data from checkbox attribute
            diary.addEntry(data);
          }
          nav.resetToPage("activities/diary/views/diary.html"); //Switch to diary page
        });
      }
      else //Food list was accessed through diary page so category is already set
      {
        //Add each item to diary
        for (var i = 0; i < checked.length; i++)
        {
          var data = JSON.parse(checked[i].offsetParent.attributes.data.value); //Parse data from checkbox attribute
          diary.addEntry(data);
        }
        nav.resetToPage("activities/diary/views/diary.html"); //Switch to diary page
      }
    }
    else if (foodList.lastPageId == "edit-meal")
    {
      var foodIds = [];

      //Make array of food IDs to be added to meal
      for (var i = 0; i < checked.length; i++)
      {
        foodIds.push(JSON.parse(checked[i].offsetParent.attributes.data.value)["id"]);
      }
      nav.popPage({"data":{"foodIds":foodIds}}); //Go back to previous page, and pass data along
    }
  }
});

//Edit food item by double tapping
$(document).on("dblclick", "#food-list-page #food-list ons-list-item", function(e) {

  var data = JSON.parse($(this).attr("data"));

  //Go to edit food page then fill in form
  nav.pushPage("activities/food-list/views/edit-item.html", {"data":data})
    .then(function() {foodList.fillEditForm(data)});
});

//Same action as double tap on regular list items but this is for items found via search
$(document).on("tap", "#food-list-page #food-list .searchItem", function(e) {

  var data = JSON.parse($(this).attr("data"));

  //Go to edit food page then fill in form
  nav.pushPage("activities/food-list/views/edit-item.html", {"data":data})
    .then(function() {foodList.fillEditForm(data)});
});

$(document).on("init", "#edit-food-item", function(e){
  foodList.localizeEditForm()
});

//Edit form portion
$(document).on("keyup", "#edit-food-item #portion", function(e){
  foodList.changePortion(this.value);
});

//Edit form submit button action
$(document).on("tap", "#edit-food-item #submit", function(e) {

  var name = $('#edit-food-item #name').val();
  var portion = $('#edit-food-item #portion').val();
  var calories = $('#edit-food-item #calories').val();

  //Form validation
  if (name != "" && portion != "" && calories != "" && !isNaN(calories)) {
    foodList.processEditForm()
    .then(function(){
      foodList.fillListFromDB()
      .then(function(){nav.popPage();});
    });
  } else {
    ons.notification.alert(app.strings["dialogs"]["required-fields"]);
  }
});

$(document).on("init", "#upload-food-item", function(e){
  foodList.localizeUploadForm();
});

$(document).on("show", "#upload-food-item", function(e){

  var data = this.data; //Get data thas was pushed to page

  $("#upload-food-item #barcode").val(data.code); //Add barcode to form
  $("#upload-food-item #comment").val("Waistline: " + app.storage.getItem("uuid")); //Add uuid comment to form

  //Reset the images array
  foodList.images = [];

  //Hide the images card - it will be displayed again once an image is added
  $("#upload-food-item #images").hide();
  $("#upload-food-item #images ons-carousel-item").hide(); //Hide all image carousel items until an image is added
});

$(document).on("tap", "#upload-food-item #submit", function(e){

  var data = $("#upload-food-item #upload-item-form").serialize(); //Get form data
  var code = $("#upload-food-item #barcode").val(); //Get barcode from form

  if (foodList.validateUploadForm() == true)
  {
    //Diplay uploading indicator
    $("#upload-food-item ons-modal").show();

    foodList.uploadProductInfoToOFF(data) //Upload data
    .then(function(response){

      //Upload images
      if (foodList.images.length > 0)
      {
        for (var i = 0; i < foodList.images.length; i++)
        {
          foodList.uploadImageToOFF(code, foodList.images[i]);
        }
      }
      //Wait 5 seconds
      setTimeout(function()
      {
        $("#upload-food-item ons-modal").hide();
        ons.notification.alert(app.strings["food-list"]["upload-item"]["success"])
        .then(function(){nav.popPage();});
      }, 5000);
    })
    .catch(function(err) {
      console.error('Augh, there was an error!', err.statusText);
      $("#upload-food-item ons-modal").hide();
      ons.notification.alert(app.strings["food-list"]["upload-item"]["fail"]);
    });
  }
  else
  {
    return false;
  }
});

$(document).on("keyup", "#upload-food-item #portion, #upload-food-item #unit", function(e){
  var portion = $("#upload-food-item #portion").val();
  var unit = $("#upload-food-item #unit").val();
  $("#upload-food-item #serving_size").val(portion + unit);
});

//Delete an image
$(document).on("hold", "#upload-food-item #images ons-carousel-item", function(){

  var control = this;

  //Show confirmation dialog
  ons.notification.confirm(app.strings["dialogs"]["confirm-delete"])
  .then(function(input) {
    if (input == 1) {//Delete was confirmed

      foodList.images.splice(control.id, 1); //Remove item from images array

      $(control).remove(); //Remove the image carousel item

      //If there are no images, hide the card
      if (foodList.images.length == 0) $("ons-page#upload-food-item #images").hide();
    }
  });
});
