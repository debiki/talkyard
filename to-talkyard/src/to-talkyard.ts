/// <reference path="to-talkyard.d.ts" />

//   ./to-talkyard --*ExportFile=... [ --writeTo=file | --sendToServer=https://ty.example.com ]
//
// where --*ExportFile is one of:
//    --wordpressCoreXmlExportFile
//    --disqusXmlExportFile
//
// but right now:
//
//  nodejs dist/to-talkyard/src/to-talkyard.js --wordpressCoreXmlExportFile file.xml
//  nodejs dist/to-talkyard/src/to-talkyard.js --disqusXmlExportFile file.xml --writeTo=test.json
//  nodejs dist/to-talkyard/src/to-talkyard.js --disqusXmlExportFile file.xml --sendTo=localhost
//


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

let fileFormat;
const DisqusFormat = 'DisqusFormt';
const WordPressFormat = 'WordPressFormat';

function throwTooManyParamsIfDefined(value: string | undefined) {
  if (!!value) {
    throw "Too many command line options";
  }
}

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
  throw (
    "No export file or json dump specified, one of:\n" +
    "  --wordpressCoreXmlExportFile=...\n" +
    "  --disqusXmlExportFile=...\n" +
    "  --talkyardJsonPatchFile=...");
}

const writeToPath: string | undefined = args.writeTo;
const sendToOrigin: string | undefined = args.sendTo;
const sysbotApiSecret: string | undefined = args.sysbotApiSecret;

if (!_.isString(writeToPath) && !_.isString(sendToOrigin))
  throw "Missing: --writeTo=... or --sendTo=...";


if (_.isString(sendToOrigin) && !_.isString(sysbotApiSecret))
  throw "Missing: --sysbotApiSecret=..., required together with --sendTo=...";


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
      [talkyardSiteData, errors] = fromWordPressToTalkyard(fileText, { verbose });
      break;
    case DisqusFormat:
      [talkyardSiteData, errors] = fromDisqusToTalkyard(fileText, { verbose });
      break;
    default:
      die('ToTyE305MKF');
  }

  if (errors)
    throw "There were errors. Aborting. Bye. [ToTyEGDBYE]";
}


dieIf(!talkyardSiteData, 'ToTyE7DKD025');
const jsonString = JSON.stringify(talkyardSiteData, undefined, 2);

process.stdout.write("\n\nDone processing.");


if (writeToPath) {
  process.stdout.write(`\nWriting ${jsonString.length} JSON chars to: ${writeToPath} ...`);
  fs.writeFileSync(writeToPath, jsonString, { encoding: 'utf8' });
}

if (sendToOrigin) {
  console.log(`\nSending ${jsonString.length} JSON chars to: ${sendToOrigin} ...`);
  //const responseJson = postOrDie(
   //   url, ps.externalUser, { apiUserId: c.SysbotUserId, apiSecret: ps.apiSecret }).bodyJson();
  const response = postOrDie(sendToOrigin + '/-/v0/upsert-patch-json', talkyardSiteData);
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
