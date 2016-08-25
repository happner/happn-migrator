var path = require('path');
var happn = require('happn');
var service = happn.service;
var RandomActivityGenerator = require("happn-random-activity-generator");

describe('functional tests', function () {

  var configFile = {
    happn_instances:[
      {
        name:'Test1',
        port:55001
      },{
        name:'Test2',
        port:55002
      },{
        name:'Test3',
        port:55003
      },{
        name:'Test4',
        port:55004
      }
    ],
    input_clients:[
      {
        name:'Test1-input',
        config:{
          port:55001
        }
    },{
        name:'Test2-input',
        config:{
          port:55002
        }
    }
    ],
    output_clients:[
      {
        name:'Test1-output',
        config:{
          port:55003
        }
      },{
        name:'Test2-output',
        config:{
          port:55004
        }
      }
    ]
  };

  it('imports the config file successfully', function (done) {

    var Migrator = require('../index.js');
    var migrator = new Migrator(configFile);

    expect(migrator.__config.happn_instances.length).to.be(4);
    expect(migrator.__config.input_clients.length).to.be(2);
    expect(migrator.__config.output_clients.length).to.be(2);

    done();

  });

  it('starts the happn instances, from the config and logs in the happn clients, then stops everything', function (done) {

    var Migrator = require('../index.js');
    var migrator = new Migrator(configFile);

    migrator.on('initialized', function(){
      
      expect(migrator.__happn_instances.length).to.be(4);
      expect(migrator.__input_clients.length).to.be(2);
      expect(migrator.__output_clients.length).to.be(2);

      migrator.on('stopped', function(){
        done();
      });

      migrator.stop();

    });

    migrator.initialize(function(e){

      if (e) return done(e);

    });

  });

  it('starts the happn instances, from the config and fails to log in a bad client', function (done) {

    var Migrator = require('../index.js');
    var migrator = new Migrator(configFile);

    var badConfig = JSON.parse(JSON.stringify(configFile));

    badConfig.input_clients.push({
        name:'Test1-input',
        config:{
          port:55005
        }
      }
    );

    migrator.initialize(function(e){
      expect(e.toString()).to.be('Error: bad input client');
      done();
    });
  });

  var verifyOutputFile = function(filename, aggregatedLog, done){

  };

  it('generates the output file', function (done) {

    this.timeout(20000);

    var Migrator = require('../index.js');
    var migrator = new Migrator(configFile);

    migrator.initialize(function(e){

      if (e) return done(e);

      var randomActivity1 = new RandomActivityGenerator(client1);

      randomActivity1.generateActivityStart("test", function () {
        setTimeout(function () {
          randomActivity1.generateActivityEnd("test", function (aggregatedLog) {

            migrator.on('generated-outputfile', function(filename){

              migrator.stop();

              verifyOutputFile(filename, aggregatedLog, done);

            });

            migrator.start();

          });
        }, 3000);
      });
    });
  });

  var verifyOutputDBS = function(outputClients, aggregatedLog, done){

  };

  it('pushes the data from the output file to a single output instance', function (done) {

    this.timeout(20000);

    var singleConfig = JSON.parse(JSON.stringify(configFile));

    singleConfig.output_clients.splice(0, 1);

    var Migrator = require('../index.js');
    var migrator = new Migrator(configFile);

    migrator.initialize(function(e){

      if (e) return done(e);

      var randomActivity1 = new RandomActivityGenerator(client1);

      randomActivity1.generateActivityStart("test", function () {
        setTimeout(function () {
          randomActivity1.generateActivityEnd("test", function (aggregatedLog) {

            migrator.on('updated-output', function(outputClient){

              migrator.stop();

              verifyOutputDBS([outputClient], aggregatedLog, done);

            });

            migrator.start();

          });
        }, 3000);
      });
    });
  });

  it('pushes the data from the output file to multiple output instances', function (done) {

    this.timeout(20000);

    var singleConfig = JSON.parse(JSON.stringify(configFile));

    singleConfig.output_clients.splice(0, 1);

    var Migrator = require('../index.js');
    var migrator = new Migrator(configFile);

    migrator.initialize(function(e){

      if (e) return done(e);

      var randomActivity1 = new RandomActivityGenerator(client1);

      randomActivity1.generateActivityStart("test", function () {

        setTimeout(function () {

          randomActivity1.generateActivityEnd("test", function (aggregatedLog) {

            var updatedCount = 0;
            var outputClients = [];

            migrator.on('updated-output', function(outputClient){

              updatedCount++;

              outputClients.push(outputClient);

              if (updatedCount == 2){
                migrator.stop();
                verifyOutputDBS([outputClients], aggregatedLog, done);
              }

            });

            migrator.start();

          });
        }, 3000);
      });
    });
  });

});
