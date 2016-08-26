var path = require('path');
var RandomActivityGenerator = require("happn-random-activity-generator");
var expect = require('expect.js');
var async = require('async');
var fs = require('fs-extra');

describe('functional tests', function () {

  var mongoService = require('happn-service-mongo');
  var serviceInstance = new mongoService();

  var config = {
    url:'mongodb://127.0.0.1:27017/happn'
  };

  var config = {
    happn_instances:[
      {
        name:'Test1',//nedb instance
        port:55011
      },
      {
        name:'Test1-mongo',//mongo instance
        port:55022,
        services: {
          data: {
            instance:serviceInstance,
            config:{
              collection:'migrator-test'
            }
          }
        }
      }
    ],
    input_clients:[
      {
        name:'Test1-input',
        config:{
          port:55011
        }
      }
    ],
    output_clients:[
      {
        name:'Test1-output-mongo',
        config:{
          port:55022
        }
      }
    ]
  };

  var verifyOutputFileClient = function(filename, client, callback){

    var byline = require('byline');

    var stream = byline(fs.createReadStream(filename, { encoding: 'utf8' }));

    var callbackDone = false;

    var errors = [];

    stream.on('data', function(line) {

      if (!callbackDone){

        var object = JSON.parse(line);

        try{

          if (object._meta.path.indexOf('/_SYSTEM') >= 0) return;

          client.get(object._meta.path, {}, function(e, compare){

            var er = null;

            if (e) er = 'error getting item from input client';

            if (!compare) er = 'item does not exist at path: ' + object._meta.path;

            if (compare.key != object.key || compare.data != object.data || compare.data == null || compare.data == undefined) er = 'data does not match at path: ' + object._meta.path;

            if (er) {
              console.log(er);
              errors.push(er)
            }

          });
        }catch(e){
          errors.push(e)
        }
      }
    });

    stream.on('end', function(){
      if (!callbackDone) {
        setTimeout(function(){
          if (errors.length > 0) return callback(new Error('there were errors reconciling the data'));
          callback();
        }, 5000);
      }
    });

    stream.on('error', function(e){

      if (!callbackDone) callback(e);
      callbackDone = true;
    });
  };

  function verifyInputAndOutput(outputFile, clients, callback){

    async.eachSeries(clients, function(client, instanceCB){

      verifyOutputFileClient(outputFile, client, instanceCB);

    }, callback);
  }

  it('does the entire cycle', function (done) {

    this.timeout(20000);

    var Migrator = require('../index.js');
    var migrator = new Migrator(config);

    migrator.initialize(function(e){

      if (e) return done(e);

      var randomActivity1 = new RandomActivityGenerator(migrator.__input_clients[0]);

      randomActivity1.generateActivityStart("test", function () {

        setTimeout(function () {

          randomActivity1.generateActivityEnd("test", function (aggregatedLog) {

            migrator.on('completed migration', function(state){

              verifyInputAndOutput(state.output, migrator.__output_clients, function(e){

                if (e) return done(e);

                migrator.on('stopped', done);
                migrator.stop();

              });
            });

            migrator.start();

          });
        }, 3000);
      });
    });
  });

});
