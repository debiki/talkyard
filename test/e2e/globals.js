// Create colors.
var chalk = require('chalk');
var errorColor = chalk.bold.yellow.bgRed;
var unusualColor = chalk.black.bgGreen;

// Analyze arguments.
var args;
try {
  // This'll work if we're being called from gulp-nightwatch — then [2] is a json obj string
  // with all arguments.
  args = JSON.parse(process.argv[2]);
}
catch (error) {
  // We're probably running Nightwatch directly (not via gulp-nightwatch), so:
  args = require('minimist')(process.argv.slice(2));
}

// Setup settings.
var e2eTestPassword = args.password;
var secure = args.secure;
var host = args.host || (secure ? 'localhost:9443' : 'localhost:9000');
var scheme = secure ? 'https' : 'http';
var mainSiteOrigin = scheme + '://' + host;
var newSiteDomain = args.newSiteDomain || host;

// Setup secret settings.
var gmailEmailAddress;
var gmailPassword;
var secretsPath = args.secretsPath;
if (secretsPath) {
  var fs = require('fs');
  var content = fs.readFileSync(secretsPath, { encoding: 'utf8' });
  try {
    var json = JSON.parse(content);
    gmailEmailAddress = json.gmailEmailAddress;
    gmailPassword = json.gmailPassword;
    if (!e2eTestPassword) e2eTestPassword = json.e2eTestPassword;
    if (!gmailEmailAddress) console.warn("No gmailEmailAddress in " + secretsPath);
    if (!gmailPassword) console.warn("No gmailPassword in " + secretsPath);
  }
  catch (error) {
    console.error(errorColor("Error parsing secret file: " + error));
    console.error(errorColor("No secrets loaded :-( Tests that require Gmail will be skipped."));
  }
}

console.log("==================================================");
console.log("------ Test settings:");
console.log('host: ' + args.host);
console.log('secure: ' + args.secure);
console.log('derived origin: ' + mainSiteOrigin);
console.log("------ Secrets:");
console.log('e2eTestPassword: ' + (e2eTestPassword ? 'specified' : 'not specified'));
console.log("gmailEmailAddress: " + gmailEmailAddress);
console.log("gmailPassword: " + (gmailPassword ? "(specified)" : "undefined"));
console.log("------ Extra magic:");
if (args.pauseForeverAfterTest) {
  console.log("You said " + unusualColor("--pauseForeverAfterTest") +
      ", so I will pause forever after the first test.");
}
console.log("==================================================");


var self = module.exports = {

  pauseForeverAfterTest: args.pauseForeverAfterTest,
  unusualColor: unusualColor,

  waitForConditionTimeout: 995000,

  e2eTestPassword: e2eTestPassword,

  generateTestId: function() {
    return (new Date()).getTime().toString().slice(3, 10);
  },

  testLocalHostnamePrefix: 'e2e-test--',
  testEmailAddressPrefix: 'e2e-test--',
  gmailEmailAddress: gmailEmailAddress,
  gmailPassword: gmailPassword,

  mainSiteHost: host,
  mainSiteOrigin: mainSiteOrigin,

  makeSiteOrigin: function(localHostname) {
    return scheme + '://' + localHostname + '.' + newSiteDomain;
  },

  makeSiteOriginRegexEscaped: function(localHostname) {
    return scheme + ':\\/\\/' + localHostname + '.' + newSiteDomain;
  },
};

