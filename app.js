var argv = require('yargs').argv;

var express = require('express');
var app = express();
var mysql = require('mysql');
var connection = mysql.createConnection({
  host: argv.host,
  user: argv.user,
  password: argv.pass,
  database: argv.database
});
var moment = require('moment');
moment().format();

connection.connect();

setInterval(function(){
  connection.query("select 1 from dual", function(err, rows){
    console.log("Keep Database Alive");
  });
}, 60000);

app.use(express.static(__dirname+"/static"));
app.use(express.static(__dirname+"/bower_components"));


app.get('/json/car/debug', function(req, res){
  connection.query("select c.CarName, DATE_FORMAT(g.Date, '%Y-%m-%d') as Date from tabgas g, auto c where g.Car=c.id and PERIOD_DIFF(DATE_FORMAT(g.Date,'%Y%m'), DATE_FORMAT(CURRENT_DATE(), '%Y%m')) >= ? and own=1 order by c.id, Date", [-2], function(err, rows, fields){
    res.send({result:rows});
  });
});

app.get('/json/car/projection', function(req, res){
  connection.query("select g.Car carId, PERIOD_DIFF(DATE_FORMAT(max(g.Date),'%Y%m'), DATE_FORMAT(now(),'%Y%m')) timeDiff from tabgas g, auto c where g.Car=c.id and c.own=1 group by g.Car order by g.Car", function (err, rows, fields) {
    var basePast = -6;
    var builtQuery = [];
    var builtParams = [];
    var isQuery = "select c.id carId, c.CarName, DATE_FORMAT(g.Date, '%Y-%m') as Date, sum(g.tripodo) tripodo, max(odometer) odometer from tabgas g, auto c where g.Car=c.id and PERIOD_DIFF(DATE_FORMAT(g.Date,'%Y%m'), DATE_FORMAT(CURRENT_DATE(), '%Y%m')) >= ? and c.id = ? group by DATE_FORMAT(g.Date, '%Y-%m')";
    rows.forEach(function (ele) {
      builtQuery.push(isQuery);
      builtParams.push(basePast + ele.timeDiff);
      builtParams.push(ele.carId);
    });

    connection.query(builtQuery.join(" union ")+" order by carId, Date desc", builtParams, function (err1, rows1, fields1) {

      function findHitNext (carName, avgSpan, start_YYYY_MM, start_odo, avg_trip){
        var nextMarker = Math.floor(start_odo/10000)+1;
        var odo = start_odo;
        var myDate = moment(start_YYYY_MM+"-01", "YYYY-MM-DD");

        console.log(moment().format("YYYY-MM-DD HH:mm ") + carName + ' ' + avgSpan + ' months. Last Entry: ' + start_YYYY_MM + ', Odometer: ' + start_odo + ', Avg Miles: ' + avg_trip.toFixed(2));
        if(avg_trip <= 0){
          return 'Never';
        }
        for(; Math.floor(odo/10000) < nextMarker; ){
          myDate.add(1, 'months');
          odo += avg_trip;
        }
        return myDate.format('X');
      }

      var allCars = [];
      var carData = {};
      rows1.forEach(function (carRow) {
        if(carData[carRow.CarName] === undefined){
          allCars.push(carRow.CarName);
          carData[carRow.CarName] = {
            name: carRow.CarName,
            finalOdo: carRow.odometer,
            finalRecord: carRow.Date,
            mon2: { trip: 0, count: 0 },
            mon4: { trip: 0, count: 0 },
            mon6: { trip: 0, count: 0 }
          };
        }
        if (carData[carRow.CarName].mon2.count < 2) {
          carData[carRow.CarName].mon2.trip += carRow.tripodo;
          carData[carRow.CarName].mon2.count += 1;
        }
        if (carData[carRow.CarName].mon4.count < 4) {
          carData[carRow.CarName].mon4.trip += carRow.tripodo;
          carData[carRow.CarName].mon4.count += 1;
        }
        if (carData[carRow.CarName].mon6.count < 6) {
          carData[carRow.CarName].mon6.trip += carRow.tripodo;
          carData[carRow.CarName].mon6.count += 1;
        }
      });
      var finalData = [];
      allCars.forEach(function (car) {
        finalData.push({
          name: car,
          nextMarker: Math.floor(carData[car].finalOdo/10000)+1,
          est2: findHitNext(car, 2, carData[car].finalRecord, carData[car].finalOdo, carData[car].mon2.trip / carData[car].mon2.count),
          est4: findHitNext(car, 4, carData[car].finalRecord, carData[car].finalOdo, carData[car].mon4.trip / carData[car].mon4.count),
          est6: findHitNext(car, 6, carData[car].finalRecord, carData[car].finalOdo, carData[car].mon6.trip / carData[car].mon6.count)
        });
      });
      res.send({result:finalData});
    });
  });
});

app.get('/json/car/monthly', function(req, res){
  var sqlQuery = "select c.CarName, DATE_FORMAT(g.Date, '%Y-%m') as Date, sum(g.tripodo) tripodo, sum(g.gasqty) gasqty, max(odometer) odometer from tabgas g, auto c where g.Car=c.id and PERIOD_DIFF(DATE_FORMAT(g.Date,'%Y%m'), DATE_FORMAT(CURRENT_DATE(), '%Y%m')) >= ? and own=1 group by CarName, DATE_FORMAT(g.Date, '%Y-%m') order by c.id, Date";

  connection.query(sqlQuery, [-24], function(err, rows, fields){
    if(err) throw err;

    var carList = [];
    var carData = {};
    rows.forEach(function(r_e){
      var id = r_e.CarName;
      if(carData[id] === undefined){
        carData[id] = [];
        carList.push(id);
      }
      carData[id].push({
        month    : +moment(r_e.Date+'-01').format('X'),
        trip     : r_e.tripodo,
        gallons  : r_e.gasqty,
        mpg      : r_e.tripodo / r_e.gasqty,
        odometer : r_e.odometer
      });
    });

    var data = [];
    carList.forEach(function(car_id) {
      data.push({ name:car_id, recorded:carData[car_id] });
    });

    res.send({result:data});
  });
});

var server = app.listen(3000, function(){
  console.log('Listening on port %d', server.address().port);
});

