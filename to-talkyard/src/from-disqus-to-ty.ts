/// <reference path="to-talkyard.d.ts" />

// look at:
// https://help.disqus.com/developer/comments-export
// https://gist.github.com/evert/3332e6cc73848aefe36fd9d0a30ac390
// https://gitlab.com/commento/commento/blob/master/api/domain_import_disqus.go


import * as _ from 'lodash';
import * as sax from 'sax';

import { buildSite } from '../../tests/e2e/utils/site-builder';
import c from '../../tests/e2e/test-constants';
const strict = true; // set to false for html-mode
const parser = sax.parser(strict, {});

const UnknownUserId = -2; // ??
const DefaultCategoryId = 2;

let verbose: boolean | undefined;
let errors = false;



const tySiteData: SiteData = {
  guests: [],
  pages: [],
  pagePaths: [],
  posts: [],
};


const builder = buildSite(tySiteData);



export default function(fileText: string, ps: { verbose?: boolean }): [SiteData, boolean] {
  verbose = ps.verbose;
  parser.write(fileText).close();
  errors = true; // or compl err
  return [builder.getSite(), errors];
}

