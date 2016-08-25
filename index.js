var EventEmitter = require("events").EventEmitter

function Migrator(config){

  this.__config = config;
  this.__eventEmitter = new EventEmitter();
  this.__buzy = false;
};

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

};

Migrator.prototype.__createInputClients = function(callback){

};

Migrator.prototype.__createOutputClients = function(callback){

};

Migrator.prototype.initialize = function(callback){

  var _this = this;

  if (this.status == 'started') return _this.__emit('error', new Error('already migrating...'));

  _this.__startInstances(function(e){

    if (e) return callback(e);

    _this.__createInputClients(function(e){

      if (e) return callback(e);

      _this.__createOutputClients(function(e){

        if (e) return callback(e);

        this.status = 'initialized';
        _this.__emit('initialized');

      });

    });

  });

};

Migrator.prototype.__generateOutputFile = function(){

};

Migrator.prototype.__importOutputFile = function(){

};

Migrator.prototype.start = function(){

  if (this.status != 'initialized') return _this.__emit('error', new Error('not initialized or already running...'));

  this.status = 'started';

  this.__generateOutputFile(function(e, filename){

    if (e) return _this.__emit('error', e);

    _this.__emit('generated-outputfile', filename);

    _this.__importOutputFile(filename, function(e, logFilePath){

      if (e) return _this.__emit('error', e);

      _this.__emit('completed migration', logFilePath);

      this.status = 'initialized';

    });

  });

};

Migrator.prototype.__disconnectInputClients = function(callback){

};

Migrator.prototype.__disconnectOutputClients = function(callback){

};

Migrator.prototype.__stopInstances = function(callback){

};

Migrator.stop = function(){

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