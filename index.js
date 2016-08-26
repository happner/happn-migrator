var EventEmitter = require("events").EventEmitter;
var happn = require('happn');
var async = require('async');
var fs = require('fs-extra');

function Migrator(config){

  if (!config.happn_instances) config.happn_instances = [];

  if (!config.outputFolder) config.outputFolder = __dirname + require('path').sep + 'tmp';

  this.__config = config;
  this.__eventEmitter = new EventEmitter();
  this.status = undefined;
  this.__happn_instances = [];
  this.__input_clients = [];
  this.__output_clients = [];

}

Migrator.prototype.__emit = function (key, data) {
  return this.__eventEmitter.emit(key, data);
};

Migrator.prototype.on = function (key, handler) {
  return this.__eventEmitter.on(key, handler);
};

Migrator.prototype.off = function (key, handler) {
  return this.__eventEmitter.removeListener(key, handler);
};

Migrator.prototype.__startInstances = function(callback){

  var _this = this;

  if (_this.__config.happn_instances.length == 0) return callback();

  async.eachSeries(_this.__config.happn_instances, function(instanceConfig, instanceCB){

    happn.service.create(instanceConfig, function(e, instance){

      if (e) return instanceCB(e);

      _this.__happn_instances.push(instance);
      instanceCB();
    });

  }, callback);
};

Migrator.prototype.__createInputClients = function(callback){
  var _this = this;

  if (_this.__config.input_clients.length == 0) return callback();

  async.eachSeries(_this.__config.input_clients, function(clientConfig, instanceCB){

    happn.client.create(clientConfig, function(e, instance){

      if (e) {
        var errString = 'unable to create input client: ' + (clientConfig.name?clientConfig.name:'unknown') + ' ' + e.toString();
        return instanceCB(new Error(errString));
      }

      _this.__input_clients.push(instance);
      instanceCB();
    });

  }, callback);
};

Migrator.prototype.__createOutputClients = function(callback){
  var _this = this;

  if (_this.__config.output_clients.length == 0) return callback();

  async.eachSeries(_this.__config.output_clients, function(clientConfig, instanceCB){

    happn.client.create(clientConfig, function(e, instance){

      if (e) {
        var errString = 'unable to create output client: ' + (clientConfig.name?clientConfig.name:'unknown') + ' ' + e.toString();
        return instanceCB(new Error(errString));
      }

      _this.__output_clients.push(instance);
      instanceCB();
    });

  }, callback);
};

Migrator.prototype.initialize = function(callback){

  var _this = this;

  if (this.status == 'started') return _this.__emit('error', new Error('already migrating...'));

  _this.__startInstances(function(e){

    if (e) return callback(e);

    _this.__createInputClients(function(e){

      if (e) {
        _this.stop();
        return callback(e);
      }

      _this.__createOutputClients(function(e){

        if (e) {
          _this.stop();
          return callback(e);
        }

        _this.status = 'initialized';
        _this.__emit('initialized');

        callback();

      });

    });

  });

};

Migrator.prototype.__writeLog = function(message){

  var _this = this;

  var message = new Date() + '  ' +  message;

  console.log(message);

  fs.appendFile(_this.__currentLogFile, message + '\r\n', function(e){
    if (e) console.warn('log write failed:::' + e.toString());
  });

};

Migrator.prototype.__appendOutputFile = function(filePath, client, callback){

  client.get('*', function(e, records){
    if (e) return callback(e);

    var count = 0;

    async.eachSeries(records, function(record, recordCB){
      try{

        fs.appendFile(filePath, JSON.stringify(record) + '\r\n', function(e){

          if (e) recordCB(e);
          else {
            count++;
            recordCB();
          }
        });

      }catch(e){
        recordCB(e);
      }
    }, function(e){
      callback(e, count);
    });
  });
};

Migrator.prototype.__generateOutputFile = function(callback){

  var _this = this;

  fs.ensureDirSync(_this.__config.outputFolder);
  var outputFile = _this.__config.outputFolder + require('path').sep + Date.now() + '_' + require('shortid').generate() + '.txt';
  var logFile = outputFile + '.log';

  callback(null, outputFile, logFile);
};

Migrator.prototype.__populateOutputFile = function(callback){
  var _this = this;

  if (_this.__input_clients.length == 0) return callback();

  var totalRecords = 0;

  async.eachSeries(_this.__input_clients, function(client, instanceCB){
    _this.__appendOutputFile(_this.__currentOutputFile, client, function(e, count){
      if (e) return instanceCB(e);

      _this.__writeLog('output appended from client: ' + count + ' records');

      totalRecords += count;

      instanceCB();
    });
  }, function(e){
    if (e) return callback(e);
    _this.__writeLog('total records exported: ' + totalRecords );
    callback();
  });
};

Migrator.prototype.__pushOutputToClient = function(filename, client, callback){

  var _this = this;

  var byline = require('byline');

  var stream = byline(fs.createReadStream(filename, { encoding: 'utf8' }));

  var callbackDone = false;

  stream.on('data', function(line) {

    if (!callbackDone){
      var object = JSON.parse(line);

      if (_this.__config.skipSystemObjects && object._meta.path.substring('/_SYSTEM') == 0) return;

      client.set(object._meta.path, object, function(e){

        if (e)  return _this.__writeLog('output failed for record: ' + object._meta.path);
        _this.__writeLog('row imported: ' + object._meta.path);
      });
    }
  });

  stream.on('end', function(){
    if (!callbackDone){
      callback();
    }
  });

  stream.on('error', function(e){

    if (!callbackDone) callback(e);
    callbackDone = true;
  });
};

Migrator.prototype.__importOutputFile = function(filename, callback){
  var _this = this;

  if (_this.__output_clients.length == 0) return callback();

  async.eachSeries(_this.__output_clients, function(client, instanceCB){

    _this.__pushOutputToClient(filename, client, instanceCB);

  }, callback);
};

Migrator.prototype.start = function(){

  var _this = this;

  if (_this.status != 'initialized') return _this.__emit('error', new Error('not initialized or already running...'));

  _this.status = 'started';

  _this.__generateOutputFile(function(e, filename, logfilename){

    if (e) return _this.__emit('error', e);

    _this.__currentOutputFile = filename;
    _this.__currentLogFile = logfilename;

    _this.__populateOutputFile(function(e){

      if (e) return _this.__emit('error', e);

      _this.__emit('generated-outputfile', _this.__currentOutputFile);

      _this.__importOutputFile(filename, function(e, logFilePath){

        if (e) return _this.__emit('error', e);

        _this.__emit('completed migration', {"output":_this.__currentOutputFile,"log": _this.__currentLogFile});

        _this.status = 'initialized';

      });

    });

  });

};

Migrator.prototype.__disconnectInputClients = function(callback){
  var _this = this;

  if (_this.__input_clients.length == 0) return callback();

  async.eachSeries(_this.__input_clients, function(client, instanceCB){

    client.disconnect(instanceCB);

  }, function(e){
    if (e) return callback(e);
    _this.__input_clients = [];
    callback();
  });
};

Migrator.prototype.__disconnectOutputClients = function(callback){
  var _this = this;

  if (_this.__output_clients.length == 0) return callback();

  async.eachSeries(_this.__output_clients, function(client, instanceCB){

    client.disconnect(instanceCB);

  }, function(e){
    if (e) return callback(e);
    _this.__output_clients = [];
    callback();
  });
};

Migrator.prototype.__stopInstances = function(callback){

  var _this = this;

  if (_this.__happn_instances.length == 0) return callback();

  var index = 0;

  async.eachSeries(_this.__happn_instances, function(instance, instanceCB){

    _this.__emit('stopping-instance', instance);
    instance.stop(function(e){

      if (e){
        _this.__emit('stop-instance-error', {instance:instance, error:e});
        return instanceCB(e);
      }

      _this.__emit('stopped-instance', index);

      index++;
      instanceCB();

    });

  }, function(e){
    if (e) return callback(e);
    _this.__happn_instances = [];
    callback();
  });
};

Migrator.prototype.stop = function(){

  var _this = this;

  _this.__disconnectInputClients(function(e){

    if (e) return _this.__emit('error', e);

    _this.__disconnectOutputClients(function(e){

      if (e) return _this.__emit('error', e);

      _this.__stopInstances(function(e){

        if (e) return _this.__emit('error', e);

        _this.__emit('stopped');

      });
    });
  });

};

module.exports = Migrator;