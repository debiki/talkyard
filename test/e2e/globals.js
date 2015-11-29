// Create colors.
var chalk = require('chalk');
var errorColor = chalk.bold.yellow.bgRed;
var warningColor = chalk.bold.red;
var unusualColor = chalk.black.bgGreen;
function logError(message) { console.log(errorColor(message)); }
function logWarning(message) { console.log(warningColor(message)); }

// Analyze arguments.
var args;
try {
  // This'll work if we're called from gulp-nightwatch — then [2] is a json obj string
  // with all arguments.
  args = JSON.parse(process.argv[2]);
}
catch (error) {
  // We're probably running Nightwatch directly (not via gulp-nightwatch), then:
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
var gmailEmail;
var gmailPassword;
var facebookAdminPassword;
var facebookAdminEmail;
var facebookUserPassword;
var facebookUserEmail;
var secretsPath = args.secretsPath;
if (secretsPath) {
  var fs = require('fs');
  var content = fs.readFileSync(secretsPath, { encoding: 'utf8' });
  try {
    var json = JSON.parse(content);
    gmailEmail = json.gmailEmail;
    gmailPassword = json.gmailPassword;
    facebookAdminPassword = json.facebookAdminPassword;
    facebookAdminEmail = json.facebookAdminEmail;
    facebookUserPassword = json.facebookUserPassword;
    facebookUserEmail = json.facebookUserEmail;
    if (!e2eTestPassword) e2eTestPassword = json.e2eTestPassword;
    if (!gmailEmail) logWarning("No gmailEmail in " + secretsPath);
    if (!gmailPassword) logWarning("No gmailPassword in " + secretsPath);
    if (!facebookAdminPassword) logWarning("No facebookAdminPassword in " + secretsPath);
    if (!facebookAdminEmail) logWarning("No facebookAdminEmail in " + secretsPath);
    if (!facebookUserPassword) logWarning("No facebookUserPassword in " + secretsPath);
    if (!facebookUserEmail) logWarning("No facebookUserEmail in " + secretsPath);
  }
  catch (error) {
    logError("Error parsing secret file: " + error);
    logError("No secrets loaded. At least all OpenAuth tests will be skipped.");
  }
}

console.log("==================================================");
console.log("~~~~~~ Test settings:");
console.log("host: " + host);
console.log("secure: " + secure);
console.log('derived origin: ' + mainSiteOrigin);
console.log("~~~~~~ Secrets:");
console.log("e2eTestPassword: " + (e2eTestPassword ? "(yes)" : "undefined"));
console.log("gmailEmail: " + gmailEmail);
console.log("facebookAdminEmail: " + facebookAdminEmail);
console.log("facebookUserEmail: " + facebookUserEmail);
console.log("~~~~~~ Extra magic:");
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
  gmailEmail: gmailEmail,
  gmailPassword: gmailPassword,
  facebookAdminPassword: facebookAdminPassword,
  facebookAdminEmail: facebookAdminEmail,
  facebookUserPassword: facebookUserPassword,
  facebookUserEmail: facebookUserEmail,

  mainSiteHost: host,
  mainSiteOrigin: mainSiteOrigin,

  makeSiteOrigin: function(localHostname) {
    return scheme + '://' + localHostname + '.' + newSiteDomain;
  },

  makeSiteOriginRegexEscaped: function(localHostname) {
    return scheme + ':\\/\\/' + localHostname + '.' + newSiteDomain;
  },
};

