var path = require('path');
var RandomActivityGenerator = require("happn-random-activity-generator");
var expect = require('expect.js');
var async = require('async');
var fs = require('fs-extra');

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

    console.log(aggregatedLog);

    done();
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

            migrator.__generateOutputFile(function(e, filename, logfilename){

              if (e) return done(e);

              migrator.__currentOutputFile = filename;
              migrator.__currentLogFile = logfilename;

              migrator.__populateOutputFile(function(e){

                if (e) return done(e);

                verifyOutputFile(migrator.__currentOutputFile, aggregatedLog, function(e){

                  if (e) return done(e);

                  migrator.on('stopped', done);
                  migrator.stop();

                });
              });
            });

          });
        }, 3000);
      });
    });
  });

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
    var migrator = new Migrator(configFile);

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
