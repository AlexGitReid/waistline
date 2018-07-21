var diary = {

  category:"Breakfast",
  date: new Date(),
  consumption:{}, //Nutrition consumed for current diary date

  populate : function()
  {
    diary.consumption = {}; //Reset object

    //Get selected date (app.date) at midnight
    var fromDate = diary.date;

    //Get day after selected date at midnight
    var toDate = new Date(fromDate);
    toDate.setDate(toDate.getDate()+1);

    //Pull record from the database for the selected date and add items to the list
    var index = dbHandler.getIndex("dateTime", "diary"); //Get date index from diary store
    var html = "";

    //Strings of html for each category - prepopulated with category dividers
    var list = {
      Breakfast:"<ons-list-header id=Breakfast>Breakfast<span></span></ons-list-header>",
      Lunch:"<ons-list-header id=Lunch>Lunch<span></span></ons-list-header>",
      Dinner:"<ons-list-header id=Dinner>Dinner<span></span></ons-list-header>",
      Snacks:"<ons-list-header id=Snacks>Snacks<span></span></ons-list-header>",
    };

    var calorieCount = {"Breakfast":0, "Lunch":0, "Dinner":0, "Snacks":0}; //Calorie count for breakfast, lunch, dinner, snacks

    index.openCursor(IDBKeyRange.bound(fromDate, toDate)).onsuccess = function(e)
    {
      var cursor = e.target.result;

      if (cursor)
      {
        var calories = cursor.value.nutrition.calories;

        //Build HTML
        html = ""; //Reset variable
        html += "<ons-list-item class='diaryItem' data='"+JSON.stringify(cursor.value)+"' id='"+cursor.value.id+"' category='"+cursor.value.category+"' tappable='true'>";
        html += "<a>"+unescape(cursor.value.name) + " - " + unescape(cursor.value.portion);

        if (cursor.value.quantity == 1)
        {
          html += "<p>"+cursor.value.quantity + " " + app.strings['serving'] + ", " + Math.round(cursor.value.quantity * calories) + " " + app.strings['calories'] + "</p>";
        }
        else
        {
          html += "<p>"+cursor.value.quantity + " " + app.strings['servings'] + ", " + Math.round(cursor.value.quantity * calories) + " " + app.strings['calories'] + "</p>";
        }
        html += "</a>";
        html += "</ons-list-item>";

        list[cursor.value.category] += html;
        calorieCount[cursor.value.category] += Math.round(calories * cursor.value.quantity);

        //Add up total consumption
        for (k in cursor.value.nutrition)
        {
          diary.consumption[k] = diary.consumption[k] || 0; //Use existing object or create new one for each item
          diary.consumption[k] += cursor.value.nutrition[k];
        }

        cursor.continue();
      }
      else
      {
        $("#diary-page #list1").html(list.Breakfast); //Insert into HTML
        $("#diary-page #list2").html(list.Lunch); //Insert into HTML
        $("#diary-page #list3").html(list.Dinner); //Insert into HTML
        $("#diary-page #list4").html(list.Snacks); //Insert into HTML
        $("#diary-page #list1 ons-list-header span").html(" - " + calorieCount.Breakfast + " " + app.strings['calories']);
        $("#diary-page #list2 ons-list-header span").html(" - " + calorieCount.Lunch + " " + app.strings['calories']);
        $("#diary-page #list3 ons-list-header span").html(" - " + calorieCount.Dinner + " " + app.strings['calories']);
        $("#diary-page #list4 ons-list-header span").html(" - " + calorieCount.Snacks + " " + app.strings['calories']);

        //Store nutrition consumption in log
        var data = {"dateTime":diary.date, "nutrition":diary.consumption};
        dbHandler.update(data, "log", diary.date);
      }
    };
  },

  setDate : function()
  {
    //If date is blank set date to current date
    if ($("#diary-page #date").val() == "")
    {
      var today = new Date();
      var dd = today.getDate();
      var mm = today.getMonth()+1; //January is 0!
      var yyyy = today.getFullYear();

      //Add leading 0s
      if (dd < 10) mm = "0"+mm;
      if (mm < 10) mm = "0"+mm;

      $("#diary-page #date").val(yyyy + "-" + mm + "-" + dd);
    }
    diary.date = new Date($("#diary-page #date").val()); //Set diary date object to date picker date at midnight
  },

  fillEditForm : function(data)
  {
    $("#edit-diary-item #id").val(data.id); //Add to hidden field
    $("#edit-diary-item #name").html(unescape(data.name) + " - " + unescape(data.portion));
    $("#edit-diary-item #portion").val(unescape(data.portion));
    $("#edit-diary-item #caloriesDisplay").html(Math.round(data.nutrition.calories * data.quantity));
    $("#edit-diary-item #caloriesPerPortion").html(unescape(data.portion) + " = " + data.nutrition.calories + " Calories");
    $("#edit-diary-item #calories").val(data.nutrition.calories);
    $("#edit-diary-item #quantity").val(data.quantity);
    $("#edit-diary-item #category").val(data.category).change();
  },

  addEntry : function(data)
  {
    console.log("Add Entry" + data);

    //Add the food to the diary store
    var dateTime = diary.date;
    var foodId = data.id;
    var name = data.name;
    var portion = data.portion;
    var nutrition = data.nutrition;

    var diaryData = {"dateTime":dateTime, "name":name, "portion":portion, "quantity":1, "nutrition":nutrition, "category":diary.category, "foodId":foodId};
    var request = dbHandler.insert(diaryData, "diary"); //Add item to diary

    request.onsuccess = function(e)
    {
      diary.populate();

      //Update food item's dateTime (to show when food was last referenced)
      var foodData = {"id":foodId, "dateTime":new Date()};
      dbHandler.update(foodData, "foodList", foodId);
    }
  },

  deleteEntry : function(id)
  {
    //Remove the item from the diary table and get the request handler
    var request = dbHandler.deleteItem(parseInt(id), "diary");

    //If the request was successful repopulate the list
    request.onsuccess = function(e) {
      diary.populate();
    };
  },

  updateEntry : function()
  {
    var id = parseInt($("#edit-diary-item #id").val()); //Get item id from hidden field
    var quantity = parseFloat($("#edit-diary-item #quantity").val());
    var category = $("#edit-diary-item #category").val();

    var getRequest = dbHandler.getItem(id, "diary"); //Pull record from DB

    getRequest.onsuccess = function(e) //Once we get the db result
    {
      var item = e.target.result; //Get the item from the request
      //var oldCalorieCount = item.calories * item.quantity; //The old calorie count, to be removed from the global count if everything goes well

      //Update the values in the item
      item.quantity = quantity;
      item.category = category;

      var putRequest = dbHandler.insert(item, "diary"); //Update the item in the db

      putRequest.onsuccess = function(e) //The item was upated
      {
        //app.caloriesConsumed -= oldCalorieCount; //Decrement the old values from the calorie count
        //app.caloriesConsumed += item.calories * quantity; //Add on new calories
      }
    }
    nav.popPage();
  },

  recordWeight: function()
  {
    var request = dbHandler.getItem(diary.date, "log"); //Get log for diary date (if it exists)

    request.onsuccess = function(e)
    {
      //If there is weight entry in the log for current diary date save it in a variable to use as defaultValue of popup
      var defaultValue = "";
      if (e.target.result && e.target.result.weight)
      {
        defaultValue = e.target.result.weight;
      }

      //Show confirmation dialog
      ons.notification.prompt("Current weight (kg)", {"title":"Weight", "inputType":"number", "defaultValue":defaultValue})
      .then(function(input) {

        if (!isNaN(parseFloat(input))) //The entered value is a number
        {
          var data = {"dateTime":diary.date, "weight":input};
          var request = dbHandler.update(data, "log", diary.date); //Add/update log entry

          request.onsuccess = function(e){
            console.log("Log updated");
          };
        }
      });
    }
  },

  getStats : function(date, callback)
  {
    var request = dbHandler.getItem(date, "log");

    request.onsuccess = function(e)
    {
      if (e.target.result)
      {
        var data = e.target.result;

        data.remaining = {};

        if (data.nutrition && data.goals) //Safety check
        {
          for (g in data.goals) //Each goal
          {
            data.remaining[g] = data.goals[g] - data.nutrition[g]; //Subtract nutrition from goal to get remining
          }
        }
        callback(data);
      }
    }
  },
}

//Diary page display
$(document).on("show", "#diary-page", function(e) {
  diary.setDate();
  diary.populate();
});

//Change date
$(document).on("focusout", "#diary-page #date", function(e) {
  diary.setDate();
  diary.populate();
});

//Deleting an item
$(document).on("hold", "#diary-page ons-list-item", function(e) {

  var data = JSON.parse($(this).attr("data"));

  //Show confirmation dialog
  ons.notification.confirm("Delete this item?")
  .then(function(input) {
    if (input == 1) {//Delete was confirmed
      diary.deleteEntry(data.id);
    }
  });
});

//Item tap action
$(document).on("tap", "#diary-page ons-list-item", function(e) {
  var data = JSON.parse($(this).attr("data"));
  nav.pushPage("activities/diary/views/edit-item.html", {"data":data})
  .then(function() {diary.fillEditForm(data)});
});

//Header tap action
$(document).on("tap", "#diary-page ons-list-header", function(e) {
  diary.category = $(this).attr("id"); //Assign category from header ID
  nav.pushPage("activities/food-list/views/food-list.html"); //Go to the food list page
});

//Edit form submit button action
$(document).on("tap", "#edit-diary-item #submit", function(e) {
  $("#edit-diary-item #edit-item-form").submit();
});
