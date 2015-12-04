/**
 * Sends a HTTP POST request with an XSRF token. Prints any error, unless
 * anyErrorCallback is specified.
 */

var _ = require('lodash');
var util = require('util');
var events = require('events');
var request = require('request');


function Post() {}
util.inherits(Post, events.EventEmitter);

Post.prototype.command = function(url, data, options, success, anyErrorCallback) {
  var self = this;
  var globals = self.api.globals;
  var logError = globals.logError;
  console.log('POST ' + url + ' ...  [EsM5JMMK2]');

  if (_.isFunction(options)) {
    if (anyErrorCallback)
      throw new Error("'options' is a function [EsE1PKV7]");

    anyErrorCallback = success;
    success = options;
    options = {};
  }

  var headers = options.headers || {};
  if (!_.isObject(data))
    throw new Error("Give me an object please; only json supported right now [EsE4GMKW2]");

  globals.xsrfTokenAndCookiesPromise.then(function(xsrfTokenAndCookieString) {
    headers['X-XSRF-TOKEN'] = xsrfTokenAndCookieString[0];
    headers['Cookie'] = xsrfTokenAndCookieString[1];
    var params = {
      url: url,
      headers: headers,
      json: data
    };
    request.post(params, function(error, response, body) {
      if (error) {
        if (anyErrorCallback) {
          anyErrorCallback(error);
        }
        else {
          logError('HTTP POST error [EsE5GKU0]: ' + error.message +
              '\nThe request: POST ' + url +
                // These two are always undefined it seems:
              '\nThe response: ' + JSON.stringify(response) +
              '\nThe response body: ' + body);
        }
      }
      else {
        if (response.statusCode >= 500 && response.statusCode < 600) {
          logError(
              'HTTP POST request resulted in an internal server error [EsE5FKU3]: ' +
              '\ntatus code: ' + response.statusCode +
              '\nThe request: POST ' + url +
              '\n---- The response body: --------------------------------------------------' +
              '\n' + response.body +
              '\n--------------------------------------------------------------------------');
        }
        else if (response.statusCode >= 400 && response.statusCode < 500) {
          logError(
              'HTTP POST request rejected [EsE40FK2]: ' +
              '\nStatus code: ' + response.statusCode +
              '\nThe request: POST ' + url +
              '\n---- The response body: --------------------------------------------------' +
              '\n' + response.body +
              '\n--------------------------------------------------------------------------');
        }

        console.log('POST ' + url + ' ==> status ' + response.statusCode);
        if (response.statusCode !== 200) {
          self.api.assert.fail(response.statusCode, 200, "Request failed: POST " + url, "=");
        }
        else {
          success(response, body);
        }
      }

      self.emit('complete');
    });
  });
};


module.exports = Post;
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
