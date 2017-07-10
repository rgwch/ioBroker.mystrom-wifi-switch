/**
 *
 * mystrom adapter
 *
 *
 *  file io-package.json comments:
 *
 *  {
 *      "common": {
 *          "name":         "mystrom",                  // name has to be set and has to be equal to adapters folder name and main file name excluding extension
 *          "version":      "0.0.0",                    // use "Semantic Versioning"! see http://semver.org/
 *          "title":        "Node.js mystrom Adapter",  // Adapter title shown in User Interfaces
 *          "authors":  [                               // Array of authord
 *              "name <mail@mystrom.com>"
 *          ]
 *          "desc":         "mystrom adapter",          // Adapter description shown in User Interfaces. Can be a language object {de:"...",ru:"..."} or a string
 *          "platform":     "Javascript/Node.js",       // possible values "javascript", "javascript/Node.js" - more coming
 *          "mode":         "daemon",                   // possible values "daemon", "schedule", "subscribe"
 *          "schedule":     "0 0 * * *"                 // cron-style schedule. Only needed if mode=schedule
 *          "loglevel":     "info"                      // Adapters Log Level
 *      },
 *      "native": {                                     // the native object is available via adapter.config in your adapters code - use it for configuration
 *          "test1": true,
 *          "test2": 42
 *      }
 *  }
 *
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

var request = require('request');
var schedule = require('node-schedule');

// you have to require the utils module and call adapter function
var utils = require(__dirname + '/lib/utils'); // Get common adapter utils

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.mystrom.0
var adapter = utils.adapter('mystrom');

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
  try {
    adapter.log.info('cleaned everything up...');
    callback();
  } catch (e) {
    callback();
  }
});


// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
  // Warning, state can be null if it was deleted

  // you can use the ack flag to detect if it is status (true) or command (false)
  if (state && !state.ack) {
    // adapter.log.info('ack is not set. switching');
    var url = adapter.config.url;
    var requeststring = "http://" + url + "/relay?state=" + (state.val == true ? "1" : "0");
    // adapter.log.info("requeststring is "+requeststring)
    request(requeststring, function (error, response, body) {
      if (error) {
        adapter.log.error(error)
      }
    })
  }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
  main();
});

function checkStates() {
  var url = adapter.config.url;
  request("http://" + url + "/report", function (error, response, body) {
    if (error) {
      adapter.log.error(error)
    } else {
      adapter.log.debug(body)
      var result = JSON.parse(body);
      adapter.setState("switchState", {val: result.relay, ack: true})
      adapter.setState("power", {val: result.power, ack: true});
    }
  });
}

function main() {

  adapter.log.info("started mystrom")


  adapter.setObject('switchState', {
    type: 'state',
    common: {
      name: 'switchState',
      type: 'boolean',
      role: 'indicator',
      read: true,
      write: true
    },
    native: {}
  })

  adapter.setObject('power',{
    type: 'state',
    common:{
      name: 'switchPower',
      type: 'number',
      read: true,
      write: false,
      role: 'value'
    },
    native: {}
  })

  // in this mystrom all states changes inside the adapters namespace are subscribed
  adapter.subscribeStates('*');


  checkStates()

  var interval=adapter.config.polling
  if(!interval){
    interval=10;
  }

  schedule.scheduleJob({minute: interval}, checkStates)
}
