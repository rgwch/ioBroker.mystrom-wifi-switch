/**
 *
 * mystrom-wifi-switch adapter
 *
 *
 *  file io-package.json comments:
 *
 *  {
 *      "common": {
 *          "name":         "mystrom-wifi-switch",                  // name has to be set and has to be equal to adapters folder name and main file name excluding extension
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

/*
WIFI SWITCH – REST API

The myStrom WiFi Switch offers a REST API (REST = representational State Transfer).
The interface allows you to access/control the switch directly from your local network independently from myStrom - you don’t need a myStrom account or the myStrom app.
With those rules you can integrate the switch in almost any environment.

Important Note
The interface is transparent and has no authentication. If someone has access to your local network, they will be able to control your switch.
Please apply strong security mechanisms to protect your network.

Set State
ON – http://[IP]/relay?state=1
OFF – http://[IP]/relay?state=0
TOGGLE – http://[IP]/toggle

Get Values
http://[IP]/report

Response
{
        "power":        0,
        "relay":        false
}

Get Temp
http://[IP]/temp

Response
{
        "measured":        43.562500,
        "compensation":        21,
        "compensated":        22.562500
}

[IP] – IP Address of your Switch e.g. 192.168.1.99
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

var request = require('request');
var intervalObj = undefined;
var interval = 60;
var lastDate = new Date();
var lastValue = 0;


// you have to require the utils module and call adapter function
var utils = require(__dirname + '/lib/utils'); // Get common adapter utils

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.mystrom-wifi-switch.0
var adapter = new utils.Adapter('mystrom-wifi-switch');

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
  try {
    if (intervalObj) {
      clearInterval(intervalObj)
    }
    adapter.log.info('cleaned everything up...');
  } catch (e) {
  }
  callback();
});


// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
  // Warning, state can be null if it was deleted
  // you can use the ack flag to detect if it is status (true) or command (false)
  if (state && !state.ack) {
    var url = adapter.config.url;
    var requeststring = "http://" + url + "/relay?state=" + (state.val == true ? "1" : "0");
    // adapter.log.info("requeststring is "+requeststring)
    request(requeststring, function (error, response, body) {
      if (error) {
        adapter.log.error(error)
      } else {
        adapter.setState("switchState", { val: state.val, ack: true })
      }
    })
  }
});


function checkStates() {
  var url = adapter.config.url;
  var doTemperature = adapter.config.doTemperature
  //Get report
  request("http://" + url + "/report", function (error, response, body) {
    if (error) {
      adapter.log.error(error)
    } else {
      adapter.log.debug(body)
      var result = JSON.parse(body);
      adapter.setState("switchState", { val: result.relay, ack: true })
      adapter.setState("power", { val: result.power, ack: true });
      var wattseconds = result.power * interval;
      var total = adapter.getState("total_energy")
      if (total === undefined) total = 0;
      total = total + wattseconds / 3600;
      adapter.setState("total_energy", { val: total, ack: true });
    }
  });
  //Get temperature
  if (adapter.config.doTemperature) {
    request("http://" + url + "/temp", function (error, response, body) {
      if (error) {
        adapter.log.error(error)
      } else {
        adapter.log.debug(body)
        var result = JSON.parse(body);
        adapter.setState("temperature_measured", { val: result.measured, ack: true })
        adapter.setState("temperature_compensation", { val: result.compensation, ack: true })
        adapter.setState("temperature", { val: result.compensated, ack: true })
      }
    });      
  } else {
    adapter.setState("temperature_measured", { val: 0.0, ack: true })
    adapter.setState("temperature_compensation", { val: 0.0, ack: true })
    adapter.setState("temperature", { val: 0.0, ack: true })   
  }
}


// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
  adapter.log.info("started mystrom wifi switch");

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
  });

  adapter.setObject('power', {
    type: 'state',
    common: {
      name: 'switchPower',
      type: 'number',
      read: true,
      write: false,
      role: 'value'
    },
    native: {}
  });

  /**
   * Energy since installation of the adapter (Wh)
   */
  adapter.setObject('total_energy', {
    type: 'state',
    common: {
      name: 'total energy',
      type: 'number',
      read: true,
      write: false,
      role: 'value'
    },
    native: {}
  });

  /**
   * energy of the current day (Wh)
   */
  adapter.setObject('day_energy', {
    type: 'state',
    common: {
      name: 'day energy',
      type: 'number',
      read: true,
      write: false,
      role: 'value'
    },
    native: {}
  });

  /**
   * Energy since last disconnection (Ws)
   */
  adapter.setObject('consumed_energy', {
    type: 'state',
    common: {
      name: 'consumed energy',
      type: 'number',
      read: true,
      write: false,
      role: 'value'
    },
    native: {}
  });

  /**
   * Temperature as measured in the device
   */
  adapter.setObject('temperature_measured', {
    type: 'state',
    common: {
      name: 'measured temperature',
      type: 'number',
      read: true,
      write: false,
      role: 'value'
    },
    native: {}
  });

  /**
   * Temperature compensation
   */
  adapter.setObject('temperature_compensation', {
    type: 'state',
    common: {
      name: 'compensation of temperature',
      type: 'number',
      read: true,
      write: false,
      role: 'value'
    },
    native: {}
  });
 
  /**
   * Temperature, measured minus compensation
   */
  adapter.setObject('temperature', {
    type: 'state',
    common: {
      name: 'temperature',
      type: 'number',
      read: true,
      write: false,
      role: 'value'
    },
    native: {}
  });


  // in this adapter all states changes inside the adapters namespace are subscribed
  adapter.subscribeStates('*');
  interval = adapter.config.polling || 60;

  adapter.log.info("setting interval to " + interval + " seconds");
  intervalObj = setInterval(checkStates, interval * 1000);
  checkStates();

});
