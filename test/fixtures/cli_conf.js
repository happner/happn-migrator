var mongoService = require('happn-service-mongo');
var serviceInstance = new mongoService();
var path = require("path");

var config = {
  outputFolder:__dirname + path.sep + "tmp",
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

module.exports = config;