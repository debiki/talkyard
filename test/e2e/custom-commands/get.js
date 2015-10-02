/**
 * Sends a HTTP GET request. Prints any error, unless anyErrorCallback is specified.
 */

var util = require('util');
var events = require('events');
var request = require("request");

function Get() {}
util.inherits(Get, events.EventEmitter);

Get.prototype.command = function(url, success, anyErrorCallback) {
  console.log('GET ' + url + '  [DwM7UYK4]');
  request.get(url, function(error, response, body) {
    if (error) {
      if (anyErrorCallback) {
        anyErrorCallback(error);
      }
      else {
        console.error('HTTP GET request error [DwE4KGYF2]: ' + JSON.stringify(error) +
          '\nThe request: GET ' + url +
          // These two are always undefined it seems:
          '\nThe response: ' + JSON.stringify(response) +
          '\nThe response body: ' + body);
      }
    }
    else {
      if (response.statusCode >= 500 && response.statusCode < 600) {
        console.error('HTTP GET request resulted in an internal server error, status ' +
                response.statusCode + ' [DwE7P2U2]: ' +
          '\nThe request: GET ' + url +
          '\n---- The response body: --------------------------------------------------' +
          '\n' + response.body +
          '\n--------------------------------------------------------------------------');
      }
      else {
        console.log('GET ' + url + ' ==> status ' + response.statusCode);
        success(response);
      }
    }
    this.emit('complete'); // or emit sth else on error?
  }.bind(this));
};


module.exports = Get;

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
