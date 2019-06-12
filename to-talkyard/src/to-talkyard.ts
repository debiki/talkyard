/// <reference path="to-talkyard.d.ts" />

//   ./to-talkyard --wordpressCoreXmlExportFile=...
//   ./to-talkyard --disqusXmlExportFile=...
//
// or right now:
//
//   nodejs dist/to-talkyard/src/to-talkyard.js  --wordpressCoreXmlExportFile file.xml
//   nodejs dist/to-talkyard/src/to-talkyard.js  --disqusXmlExportFile file.xml


import minimist from 'minimist';
import * as _ from 'lodash';
import * as fs from 'fs';
// ? import * as zlib from 'zlib';
import fromWordPressToTalkyard from './from-wordpress-to-ty';
import fromDisqusToTalkyard from './from-disqus-to-ty';
const strict = true; // set to false for html-mode

const UnknownUserId = -2; // ??
const DefaultCategoryId = 2;

const args: any = minimist(process.argv.slice(2));

let xmlFilePath;
const wordpressXmlFilePath: string | undefined = args.wordpressCoreXmlExportFile;
const disqusXmlFilePath: string | undefined = args.disqusXmlExportFile;

let fileFormat;
const DisqusFormat = 'DisqusFormt';
const WordPressFormat = 'WordPressFormat';

if (_.isString(wordpressXmlFilePath)) {
  xmlFilePath = wordpressXmlFilePath;
  fileFormat = WordPressFormat;
}
else if (_.isString(disqusXmlFilePath)) {
  xmlFilePath = disqusXmlFilePath;
  fileFormat = DisqusFormat;
}
else {
  throw Error("No export file specified, e.g.: --wordpressCoreXmlExportFile=...");
}

const writeToPath: string | undefined = args.writeTo;
if (!_.isString(writeToPath)) {
  throw Error("Missing: --writeTo=...");
}


const fileText = fs.readFileSync(xmlFilePath, { encoding: 'utf8' });


const verboseStr: string | undefined = args.verbose || args.v;
const verbose: boolean = !!verboseStr && verboseStr !== 'f' && verboseStr !== 'false';

console.log("The input file starts with: " + fileText.substring(0, 200));
console.log("Processing ...");


let talkyardSiteData: SiteData;
let errors: boolean;

switch (fileFormat) {
  case WordPressFormat:
    [talkyardSiteData, errors] = fromWordPressToTalkyard(fileText, { verbose });
    break;
  case DisqusFormat:
    [talkyardSiteData, errors] = fromDisqusToTalkyard(fileText, { verbose });
    break;
  default:
    throw 'TyE305HMRTD4';
}



if (errors) {
  console.log("There were errors. Aborting. Bye. [ToTyEGDBYE]");
}
else {
  const jsonString = JSON.stringify(talkyardSiteData, undefined, 2);

  process.stdout.write(
      `\n\nDone processing. Writing ${jsonString.length} JSON chars to: ${writeToPath} ...`);

  fs.writeFileSync(writeToPath, jsonString, { encoding: 'utf8' });

  process.stdout.write(" Done.\n");
}
