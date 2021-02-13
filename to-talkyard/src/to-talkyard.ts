//  To run this script: Install Nodejs and Yarn,
//  then:  yard build
//  then, in Ty's base dir:
//      nodejs to-talkyard/dist/to-talkyard/src/to-talkyard.js --help
//


/// <reference path="to-talkyard.d.ts" />

// Add an ignore query string flag?   [ign_q_st]  [more_2ty_cmd_prms]



/*
Usage:

./to-talkyard --*ExportFile=... [ --writeTo=file | --sendTo=SERVER_ORIGIN ]

where --*ExportFile is one of:
   --wordpressCoreXmlExportFile  (not yet impl)
   --disqusXmlExportFile

but right now:

 nodejs dist/to-talkyard/src/to-talkyard.js --wordpressCoreXmlExportFile FILE_XML
 nodejs dist/to-talkyard/src/to-talkyard.js --disqusXmlExportFile file.xml --writeTo TEST_JSON
 nodejs dist/to-talkyard/src/to-talkyard.js --disqusXmlExportFile file.xml --sendTo SERVER_ORIGIN

 nodejs dist/to-talkyard/src/to-talkyard.js  \
     --talkyardJsonPatchFile FILE_JSON  \
     --sendTo=localhost  \
     --sysbotApiSecret THE_SECRET

*/

import minimist from 'minimist';
import syncRequest from 'sync-request';
import * as _ from 'lodash';
import * as fs from 'fs';
// ? import * as zlib from 'zlib';
import { die, dieIf, logMessage } from '../../tests/e2e/utils/log-and-die';
import fromWordPressToTalkyard from './from-wordpress-to-ty';
import fromDisqusToTalkyard from './from-disqus-to-ty';
import c from '../../tests/e2e/test-constants';


const args: any = minimist(process.argv.slice(2));

let xmlFilePath: string;
let talkyardSiteData: SiteData;

const wordpressXmlFilePath: string | undefined = args.wordpressCoreXmlExportFile;
const disqusXmlFilePath: string | undefined = args.disqusXmlExportFile;
const jsonDumpFilePath: string | undefined = args.talkyardJsonPatchFile;
const primaryOrigin: string | undefined = args.primaryOrigin;
const pretty: string | undefined = args.pretty;

let fileFormat;
const DisqusFormat = 'DisqusFormt';
const WordPressFormat = 'WordPressFormat';

function throwTooManyParamsIfDefined(value: string | undefined) {
  if (!!value) {
    throw "Too many command line options";
  }
}

function logAndExit(msg: string, exitCode: Nr = 1): void {
  console.log(msg);
  process.exit(exitCode);
}


function logAndExitIf(test: boolean, msg: string): void {
  if (test) logAndExit(msg);
}


logAndExitIf(args.help || args.h, `
Usage:

  First convert the Disqus (or WordPress, later) export file
  to Talkyard JSON format:

      nodejs to-talkyard/dist/to-talkyard/src/to-talkyard.js \\
          --disqusXmlExportFile path/to/file.xml \\
          --writeTo disqus-to-talkyard.typatch.json \\
          --skipLocalhostAndNonStandardPortComments \\
          --convertHttpToHttps

  Then, at your Talkyard site, go to the Admin Area, the Settings | Features tab,
  and enable the API, click Save. Now an API tab appears — go there and generate
  an API secret; copy it.

  Thereafter you can import the JSON file:  (and change the --sendTo server
  address to your Talkyard site's address)

      nodejs to-talkyard/dist/to-talkyard/src/to-talkyard.js \\
          --talkyardJsonPatchFile disqus-to-talkyard.typatch.json  \\
          --sendTo https://your-talkyard-site.example.com  \\
          --sysbotApiSecret 'THE_SECRET_YOU_COPIED'

  Back in the browser, go to https://your-talkyard-site.example.com
  and see if your imported topics have appeared.

  Afterwards, delete the API secret.
  \n`);


if (_.isString(wordpressXmlFilePath)) {
  throwTooManyParamsIfDefined(disqusXmlFilePath);
  throwTooManyParamsIfDefined(jsonDumpFilePath);
  xmlFilePath = wordpressXmlFilePath;
  fileFormat = WordPressFormat;
}
else if (_.isString(disqusXmlFilePath)) {
  throwTooManyParamsIfDefined(jsonDumpFilePath);
  xmlFilePath = disqusXmlFilePath;
  fileFormat = DisqusFormat;
}
else if (_.isString(jsonDumpFilePath)) {
  const jsonString = fs.readFileSync(jsonDumpFilePath, { encoding: 'utf8' });
  talkyardSiteData = JSON.parse(jsonString);
}
else {
  logAndExit(
    "No export file or json dump specified, one of:\n" +
 // "  --wordpressCoreXmlExportFile=...\n" +  // later
    "  --disqusXmlExportFile=...\n" +
    "  --talkyardJsonPatchFile=...");
}

const writeToPath: string | undefined = args.writeTo;
const sendToOrigin: string | undefined = args.sendTo;
const sysbotApiSecret: string | undefined = args.sysbotApiSecret;

logAndExitIf(!_.isString(writeToPath) && !_.isString(sendToOrigin),
      "Missing: --writeTo=... or --sendTo=...");

logAndExitIf(_.isString(sendToOrigin) && !_.isString(sysbotApiSecret),
      "Missing: --sysbotApiSecret=..., required together with --sendTo=...");

logAndExitIf(primaryOrigin && !primaryOrigin.startsWith('http'),
      "The --primaryOrigin should be like http(s)://server.address");

logAndExitIf(primaryOrigin && _.filter(primaryOrigin, c => c === '/').length >= 3,
      "The --primaryOrigin should not include any URL path, only http(s)://host.");

const skipLocalhostAndNonStandardPortComments =
        !!args.skipLocalhostAndNonStandardPortComments;
const convertHttpToHttps =
        !!args.convertHttpToHttps;

if (!talkyardSiteData) {
  dieIf(!xmlFilePath, 'TyE356MKTR1');
  const fileText = fs.readFileSync(xmlFilePath, { encoding: 'utf8' });

  const verboseStr: string | undefined = args.verbose || args.v;
  const verbose: boolean = !!verboseStr && verboseStr !== 'f' && verboseStr !== 'false';

  console.log("The input file starts with: " + fileText.substring(0, 200));
  console.log("Processing ...");

  let errors: boolean;

  switch (fileFormat) {
    case WordPressFormat:
      [talkyardSiteData, errors] = fromWordPressToTalkyard(fileText, {
            verbose });
      break;
    case DisqusFormat:
      [talkyardSiteData, errors] = fromDisqusToTalkyard(fileText, {
            verbose,
            primaryOrigin,
            skipLocalhostAndNonStandardPortComments,
            convertHttpToHttps });
      break;
    default:
      die('ToTyE305MKF');
  }

  if (errors)
    throw "There were errors. Aborting. Bye. [ToTyEGDBYE]";
}


dieIf(!talkyardSiteData, 'ToTyE7DKD025');
const jsonString = JSON.stringify(talkyardSiteData, undefined, pretty ? 2 : undefined);

process.stdout.write("\n\nDone processing.");


if (writeToPath) {
  process.stdout.write(`\nWriting ${jsonString.length} JSON chars to: ${writeToPath} ...`);
  fs.writeFileSync(writeToPath, jsonString, { encoding: 'utf8' });
}

if (sendToOrigin) {
  console.log(`\nSending ${jsonString.length} JSON chars to: ${sendToOrigin} ...`);
  //const responseJson = postOrDie(
   //   url, ps.externalUser, { apiUserId: c.SysbotUserId, apiSecret: ps.apiSecret }).bodyJson();
  const response = postOrDie(sendToOrigin + '/-/v0/upsert-patch', talkyardSiteData);
  console.log(`The server replied:\n\n${response.bodyString}\n`);
  if (response.statusCode !== 200)
    throw `Error: Server status code ${response.statusCode}, ` +
        `response body:\n` +
        `------------------------------\n` +
        response.bodyString + '\n' +
        `------------------------------\n`;
}


function postOrDie(url: string, data: any): { statusCode: number, headers: any,
      bodyString: string, bodyJson: any } {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' +
        encodeInBase64(`talkyardId=${c.SysbotUserId}:${sysbotApiSecret}`)
  };

  const response = syncRequest('POST', url, { json: data, headers: headers });
  const responseBodyString = getResponseBodyString(response);

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    bodyString: responseBodyString,
    bodyJson: function() {
      return JSON.parse(responseBodyString);
    }
  };
}

function getResponseBodyString(response: any): string {  // dupl [304KWPD50]
  let bodyString = response.body;
  if (!_.isString(bodyString) && bodyString.toString) {
    bodyString = bodyString.toString('utf8');
  }
  if (!_.isString(bodyString)) {
    bodyString = "(The response body is not a string, and has no toString function. " +
        "Don't know how to show it. [ToTyE703DKWD4])";
  }
  return bodyString;
}

function encodeInBase64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}

process.stdout.write("\nDone, bye.\n");
