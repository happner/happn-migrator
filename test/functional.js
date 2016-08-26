var path = require('path');
var RandomActivityGenerator = require("happn-random-activity-generator");
var expect = require('expect.js');

describe('functional tests', function () {

  var configFile = {
    happn_instances:[
      {
        name:'Test1',
        port:55011
      },{
        name:'Test2',
        port:55022
      },{
        name:'Test3',
        port:55033
      },{
        name:'Test4',
        port:55044
      }
    ],
    input_clients:[
      {
        name:'Test1-input',
        config:{
          port:55011
        }
    },{
        name:'Test2-input',
        config:{
          port:55022
        }
    }
    ],
    output_clients:[
      {
        name:'Test1-output',
        config:{
          port:55033
        }
      },{
        name:'Test2-output',
        config:{
          port:55044
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

  it('tests the migrator events', function(done){

    var Migrator = require('../index.js');
    var migrator = new Migrator(configFile);

    migrator.on('test-event', function(data){
      expect(data.test).to.be('ok');
      done();
    });

    migrator.__emit('test-event', {"test":"ok"});

  });

  it('fails to start the migrator, as it has not initialized yet', function (done) {

    var Migrator = require('../index.js');
    var migrator = new Migrator(configFile);

    migrator.on('error', function(e){

      expect(e.toString()).to.be('Error: not initialized or already running...');
      done();

    });

    migrator.start();

  });

  it('tests the private __startInstances and __stopInstances functions', function (done) {

    var Migrator = require('../index.js');
    var migrator = new Migrator(configFile);

    migrator.__startInstances(function(e){

      if (e) return done(e);

      expect(migrator.__happn_instances.length).to.be(4);

      migrator.__stopInstances(function(e){

        if (e) return done(e);

        expect(migrator.__happn_instances.length).to.be(0);

        done();

      });

    });

  });

  it('tests starting the clients, after the instances have been started', function (done) {

    var Migrator = require('../index.js');
    var migrator = new Migrator(configFile);

    migrator.__startInstances(function(e){

      if (e) return done(e);

      expect(migrator.__happn_instances.length).to.be(4);

      migrator.__createInputClients(function(e){

        if (e) return done(e);

        expect(migrator.__input_clients.length).to.be(2);

        migrator.__createOutputClients(function(e){

          if (e) return done(e);

          expect(migrator.__output_clients.length).to.be(2);

          migrator.__disconnectInputClients(function(e){

            if (e) return done(e);

            expect(migrator.__input_clients.length).to.be(0);

            migrator.__disconnectOutputClients(function(e){

              if (e) return done(e);

              expect(migrator.__output_clients.length).to.be(0);

              migrator.__stopInstances(function(e){

                if (e) return done(e);

                expect(migrator.__happn_instances.length).to.be(0);

                done();

              });
            });
          });
        });
      });
    });
  });

  it('starts the happn instances, from the config and logs in the happn clients, then stops everything', function (done) {

    var Migrator = require('../index.js');
    var migrator = new Migrator(configFile);

    migrator.on('initialized', function(){
      
      expect(migrator.__happn_instances.length).to.be(4);
      expect(migrator.__input_clients.length).to.be(2);
      expect(migrator.__output_clients.length).to.be(2);

      migrator.on('stopped', done);

      migrator.stop();

    });

    migrator.initialize(function(e){

      if (e) return done(e);

    });

  });

  it('starts the happn instances, from the config and fails to log in a bad client', function (done) {

    this.timeout(60000);

    var badConfig = JSON.parse(JSON.stringify(configFile));

    badConfig.input_clients.push({
        name:'Test1-input',
        config:{
          port:55055
        }
      }
    );

    var Migrator = require('../index.js');
    var migrator = new Migrator(badConfig);

    migrator.initialize(function(e){
      expect(e.message).to.be('unable to create input client: Test1-input Error: connect ECONNREFUSED');
      done();
    });
  });

  it('starts the happn instances, from the config and fails to log in a bad client with no name', function (done) {

    this.timeout(60000);

    var badConfig = JSON.parse(JSON.stringify(configFile));

    badConfig.input_clients.push({
        config:{
          port:55055
        }
      }
    );

    var Migrator = require('../index.js');
    var migrator = new Migrator(badConfig);

    migrator.initialize(function(e){
      expect(e.message).to.be('unable to create input client: unknown Error: connect ECONNREFUSED');
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

      var randomActivity1 = new RandomActivityGenerator(migrator.__input_clients[0]);

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

  xit('pushes the data from the output file to a single output instance', function (done) {

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

  xit('pushes the data from the output file to multiple output instances', function (done) {

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
