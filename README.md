#happn-migrator
*for moving data between happn instances, both multiple and single*

```javascript

//example config

var config = {
    skipSystemObjects: false,//will move /_SYSTEM data
    outputFolder: __dirname + require('path').sep + 'tmp',//will use this folder to put the temporary data and log files
    happn_instances:[//instances you may want to start up (leave out already running ones)
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
    input_clients:[ //clients for data you wish to get
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
    output_clients:[ // migration destination clients, each will get a copy of the input data
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

  //then run the migrator:
  var Migrator = require('happner-migrator');
  var migrator = new Migrator(configFile);

  migrator.initialize(function(e){
    if (e) return done(e);

     migrator.on('completed migration', function(state){

      //YAY migration complete, checkout state.log and state.output for the log and output files

     });

     migrator.start();

  });

```

#command line execution:

```
npm install -g happn-migrator
or
sudo npm install -g happn-migrator

happn-migrator --conf ./test/fixtures/cli_conf.js
```

