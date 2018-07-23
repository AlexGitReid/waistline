var statistics = {

  timestamps:[],
  weights:{},
  nutrition:{},

  gatherData : function()
  {
    return new Promise(function(resolve, reject){
      var now = new Date()
      var fromDate = new Date(now.getFullYear() + "-" + (now.getMonth()+1) + "-" + (now.getDate()-1));
      var toDate = new Date(now.getFullYear() + "-" + (now.getMonth()+1) + "-" + (now.getDate()+1)); //Tomorrow at midnight

      var range = $("#statistics #range").val();
      range == 7 ? fromDate.setDate(fromDate.getDate()-7) : fromDate.setMonth(fromDate.getMonth()-range);

      dbHandler.getObjectStore("log").openCursor(IDBKeyRange.bound(fromDate, toDate)).onsuccess = function(e)
      {
        var cursor = e.target.result;

        if (cursor)
        {
          statistics.weights[cursor.value.dateTime.toLocaleDateString()] = cursor.value.weight; //Weight indexed by date

          if (cursor.value.nutrition != undefined && cursor.value.nutrition.calories != undefined)
          {
            statistics.timestamps.push(cursor.value.dateTime.toLocaleDateString()); //Use date as labels for charts
            //Store nutition data by nutrition type (calories, fat, protein, etc.)
            for (k in cursor.value.nutrition)
            {
              statistics.nutrition[k] = statistics.nutrition[k] || [];
              statistics.nutrition[k].push(cursor.value.nutrition[k]);
            }
          }

          cursor.continue();
        }
        else
        {
          resolve();
        }
      };
    });
  },

  renderCharts : function()
  {
    var chartType;
    $("#statistics #nutritionAndWeight #range").val() == 7 ? chartType = "bar" : chartType = "line";

    //Organise datasets for charts
    var chartData = {};
    var dataset = {};
    var colours = ["rgba(171,115,131,0.6)", "rgba(198,159,168,0.6)", "rgba(144,72,96,0.6)"];
    var i = 0; //Used to pick colour for chart

    for (k in statistics.nutrition) //Each nutrition type
    {
      i = (i + 1) % 3; //Get colours array index
      dataset = {};
      chartData[k] = chartData[k] || {"labels":statistics.timestamps, "datasets":[]};
      dataset.label = k;
      dataset.data = statistics.nutrition[k]
      dataset.backgroundColor = colours[i];
      chartData[k].datasets.push(dataset); //Add dataset to table data
    }

    //Add canvases for charts
    var html = "<ons-carousel swipeable auto-scroll auto-refresh>";
    for (k in chartData) //One chart per nutrition type
    {
      html += "<ons-carousel-item>";
      html += "<canvas height='250' id='"+k+"'></canvas>";
      html += "</ons-carousel-item>";
    }
    html += "</ons-carousel>";

    $("#statistics #charts").append(html);

    //Draw charts
    Chart.defaults.line.spanGaps = true;
    Chart.defaults.global.defaultFontSize = 16; //Set font size

    var ctx;
    var chart;
    for (k in chartData) //One chart per nutrition type
    {
      ctx = $("#statistics #charts ons-carousel #"+k);
      chart = new Chart(ctx, {
        type:chartType,
        data:chartData[k]
      });
    }
  },

  renderWeightLog : function()
  {
    var html = "";

    for (var i = 0; i < statistics.timestamps.length; i++)
    {
      var timeStamp = statistics.timestamps[i];

      html += "<ons-list-item>";
      html += "<h4>"+timeStamp+"</h4>";
      html += "<p>"+statistics.weights[timeStamp]+" kg</p>";
      if (statistics.nutrition.calories[i] !== undefined) html += "<p>"+statistics.nutrition.calories[i]+" Calories</p>";
      html += "</ons-list-item>";
    }

    $("#statistics #weightLog ons-list").html(html);
  },

  renderDiaryStats : function()
  {
    var now = new Date();
    var dateTime = new Date(now.getFullYear() + "-" + (now.getMonth()+1) + "-" + now.getDate());

    //Get diary stats for today
    diary.getStats(dateTime)
    .then(function(data) {

      if (data.goals && data.nutrition && data.remaining) //Safety check
      {
        var colour = "";
        var html = "<ons-carousel swipeable auto-scroll auto-refresh>";

        //Sort goals alphabetically
        var goals = {};
        Object.keys(data.goals).sort().forEach(function(key) {
          goals[key] = data.goals[key];
        });

        for (g in goals)
        {
          if (g == "weight") continue; //Weight is handled separately

          //Set colour for remaining text
          data.nutrition[g] < data.goals[g] ? colour = "green" : colour = "red";

          //For calories the colour is flipped if the user checked the gain weight option
          if (g == "calories" && goals.weight.gain == true)
          {
            data.nutrition[g] > data.goals[g] ? colour = "green" : colour = "red";
          }

          html += "<ons-carousel-item>";
          html += "<h2 style='text-align:center;'>"+g.charAt(0).toUpperCase() + g.slice(1)+"</h2>";
          html += "<ons-row>";
          html += "<ons-col width='33%' style='text-align:center;'>Goal</ons-col>"
          html += "<ons-col width='33%' style='text-align:center;'>Used</ons-col>"
          html += "<ons-col width='33%' style='text-align:center;'>Remaining</ons-col>"
          html += "</ons-row>";
          html += "<ons-row>";
          html += "<ons-col width='33%' style='text-align:center;'>"+data.goals[g]+"</ons-col>";
          html += "<ons-col width='33%' style='text-align:center;'>"+data.nutrition[g]+"</ons-col>";
          html += "<ons-col width='33%' style='text-align:center; color:"+colour+";'>"+data.remaining[g]+"</ons-col>";
          html += "</ons-row>";
          html += "</ons-carousel-item>";
        }

        html += "</ons-carousel>";

        $("#statistics #diaryStats div").html(html);
      }
    });
  }
}

$(document).on("show", "#statistics", function(e){
  statistics.renderDiaryStats();
  statistics.gatherData()
  .then(function(){
    statistics.renderCharts();
    statistics.renderWeightLog();
  });
});

$(document).on("change", "#statistics #nutritionAndWeight #range", function(e){
  statistics.gatherData();
  statistics.renderCharts();
  statistics.renderWeightLog();
})
