var foodList = {

  list:[],

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
      return (el.name.match(new RegExp(term, "i"))); //Allow partial match and case insensitive
    });
  },

  populate : function(list)
  {
    var html = "";

    for (var i = 0; i < list.length; i++)
    {
      if (list[i].id) //Item has an ID, then it must already be in the database
      {
        html += "<ons-list-item tappable class='foodListItem' data='"+JSON.stringify(list[i])+"'>";
        html += "<label class='right'>";
        html += "<ons-checkbox name='food-item-checkbox' input-id='" + list[i].name + "' data='"+ JSON.stringify(list[i]) + "'></ons-checkbox>";
        html += "</label>";
        html += "<label for='" + list[i].name + "' class='center'>" + list[i].name + "</label>";
      }
      else //Item doesn't have an idea, must have been found by searching
      {
        html += "<ons-list-item modifier='chevron' tappable class='searchItem' data='"+JSON.stringify(list[i])+"'>";
        html += list[i].name;
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
    $("#edit-food-item #name").val(data.name);
    $("#edit-food-item #brand").val(data.brand);
    $("#edit-food-item #portion").val(data.portion);
    $("#edit-food-item #calories").val(data.nutrition.calories);
    $("#edit-food-item #protein").val(data.nutrition.protein);
    $("#edit-food-item #carbs").val(data.nutrition.carbs);
    $("#edit-food-item #fat").val(data.nutrition.fat);
    $("#edit-food-item #sugar").val(data.nutrition.sugar);
    $("#edit-food-item #salt").val(data.nutrition.salt);

    //Display image
    if (data.image_url)
    {
      $('#edit-food-item #foodImage').html("<ons-card><img style='display:block; height:auto; width:75%; margin:auto;'></img></ons-card>");
      $('#edit-food-item #foodImage img').attr("src", data.image_url);
    }
  },

  updateEntry : function()
  {
    var data = {}; //Data to insert/update in DB

    //Get form values
    var id = parseInt($("#edit-food-item #id").val()); //ID is hidden field
    data.barcode = $("#edit-food-item #barcode").val(); //Barcode is hidden field
    data.name = $('#edit-food-item #name').val();
    data.brand = $('#edit-food-item #brand').val();
    data.image_url = $('#edit-food-item #foodImage img').attr("src");
    data.portion = $('#edit-food-item #portion').val();
    data.nutrition = {
      "calories":parseFloat($('#edit-food-item #calories').val()),
      "protein":parseFloat($('#edit-food-item #protein').val()),
      "carbs":parseFloat($('#edit-food-item #carbs').val()),
      "fat":parseFloat($('#edit-food-item #fat').val()),
      "sugar":parseFloat($('#edit-food-item #sugar').val()),
      "salt":parseFloat($('#edit-food-item #salt').val()),
    };

    var date = new Date()
    data.dateTime = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()));

    if (isNaN(id) == false) {data.id = id}; //Add ID for existing items

    //Add/update food item
    data.id == undefined ? dbHandler.insert(data, "foodList") : dbHandler.update(data, "foodList", id);

    foodList.fillListFromDB()
    .then(nav.popPage());
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

  testscan : function()
  {
    //First check that there is an internet connection
    if (navigator.connection.type == "none")
    {
      ons.notification.alert("No Internet Connection");
      return false;
    }

    cordova.plugins.barcodeScanner.scan(function(scanData){

      //var code = "3366321051983"; //Test barcode
      var code = scanData.text;
      var request = new XMLHttpRequest();

      request.open("GET", "https://world.openfoodfacts.org/api/v0/product/"+code+".json", true);
      request.send();

      request.onreadystatechange = function(){

        if (request.readyState == 4 && request.status == 200)
        {
          var result = jQuery.parseJSON(request.responseText);

          if (result.status == 0) //Product not found
          {
            ons.notification.alert("Product not found. You can add it with the Open Food Facts app");
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
      ons.notification.alert("Scanning failed: " + e);
      return false;
    });
  },

  search : function(term)
  {
    //First check that there is an internet connection
    if (navigator.connection.type == "none")
    {
      ons.notification.alert("No Internet Connection");
      return false;
    }

    var request = new XMLHttpRequest();

    request.open("GET", "https://world.openfoodfacts.org/cgi/search.pl?search_terms="+term+"&search_simple=1&action=process&json=1", true);
    request.send();

    request.onreadystatechange = function(){

      if (request.readyState == 4 && request.status == 200)
      {
        var result = JSON.parse(request.responseText);

        if (result.products.length == 0)
        {
          ons.notification.alert("No Matching Results");
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
        }
      }
    };
  },

  //Open food facts product parser
  parseOFFProduct : function(product)
  {
    var item = {};

    //Get best match for portion/serving size
    if (product.serving_size)
    {
      item.portion = product.serving_size.replace(/\s+/g, ''); //Remove white space
    }
    else if (product.nutrition_data_per)
    {
      item.portion = product.nutrition_data_per;
    }
    else if (product.quantity)
    {
      item.portion = product.quantity;
    }

    item.name = product.product_name;
    item.brand = product.brands;
    item.image_url = product.image_url;
    item.barcode = product.code;
    item.nutrition = {
      calories: parseInt(parseFloat(product.nutriments.energy_value) / 100 * parseFloat(item.portion)),
      protein: Math.round(parseFloat(product.nutriments.proteins) / 100 * parseFloat(item.portion) * 100) / 100,
      carbs: Math.round(parseFloat(product.nutriments.carbohydrates) / 100 * parseFloat(item.portion) * 100) / 100,
      fat: Math.round(parseFloat(product.nutriments.fat) / 100 * parseFloat(item.portion) * 100) / 100,
      salt: Math.round(parseFloat(product.nutriments.salt) / 100 * parseFloat(item.portion) * 100) / 100,
      sugar: Math.round(parseFloat(product.nutriments.sugars) / 100 * parseFloat(item.portion) * 100) / 100,
    }

    //Kilojules to kcalories
    if (product.nutriments.energy_unit == "kJ")
    {
      item.calories = parseInt(item.calories / 4.15);
    }
    return item;
  },
}

//Food list page display
$(document).on("show", "#food-list-page", function(e){
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
  ons.notification.confirm("Delete this item?")
  .then(function(input) {
    if (input == 1) {//Delete was confirmed
      foodList.deleteEntry(data.id);
    }
  });
});

//Add single item to diary by  tapping it
/*$(document).on("tap", "#food-list-page #food-list ons-list-item", function(e) {
  var data = JSON.parse($(this).attr("data"));
  diary.addEntry(data);
  nav.resetToPage("activities/diary/views/diary.html"); //Switch to diary page
});*/

//Add multiple items to diary by checking them and tapping the check button
$(document).on("tap", "#food-list-page #submit", function(e) {

  //Get all checked items
  var checked = $('input[name=food-item-checkbox]:checked');

  if (checked.length > 0) //At least 1 item was selected
  {
    //Add each item to diary
    for (var i = 0; i < checked.length; i++)
    {
      var data = JSON.parse(checked[i].offsetParent.attributes.data.value); //Parse data from checkbox attribute
      diary.addEntry(data);
    }
    nav.resetToPage("activities/diary/views/diary.html"); //Switch to diary page
  }
});

//Edit food item by double tapping
$(document).on("doubletap", "#food-list-page #food-list ons-list-item", function(e) {

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

//Edit food page display
$(document).on("show", "#edit-food-item", function(e) {
});

//Edit form submit button action
$(document).on("tap", "#edit-food-item #submit", function(e) {

  var name = $('#edit-food-item #name').val();
  var portion = $('#edit-food-item #portion').val();
  var calories = parseFloat($('#edit-food-item #calories').val());

  //Form validation
  if (name != "" && portion != "" && !isNaN(calories))
  {
    $("#edit-food-item #edit-item-form").submit();
  }
  else
  {
    ons.notification.alert('Please complete all required fields.');
  }
});
