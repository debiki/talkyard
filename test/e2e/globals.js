var argsJsonString = process.argv[2];
var args = JSON.parse(argsJsonString);
var secure = args.secure;
var host = args.host || (secure ? 'localhost:9443' : 'localhost:9000');
var scheme = secure ? 'https' : 'http';
var mainSiteOrigin = scheme + '://' + host;
var newSiteDomain = args.newSiteDomain || host;

console.log('--- Test settings: --------------------------');
console.log('host: ' + args.host);
console.log('secure: ' + args.secure);
console.log('derived origin: ' + mainSiteOrigin);
console.log('--------------------------------------------------');


var self = module.exports = {
  waitForConditionTimeout: 5000,

  generateTestId: function() {
    return (new Date()).getTime().toString().slice(3, 10);
  },

  testLocalHostnamePrefix: 'e2e-test--',
  testEmailAddressPrefix: 'e2e-test--',

  mainSiteOrigin: mainSiteOrigin,

  makeSiteOrigin: function(localHostname) {
    return scheme + '://' + localHostname + '.' + newSiteDomain;
  },

  makeSiteOriginRegexEscaped: function(localHostname) {
    return scheme + ':\\/\\/' + localHostname + '.' + newSiteDomain;
  },
};

