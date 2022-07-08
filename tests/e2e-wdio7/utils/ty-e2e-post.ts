/// <reference path="../../../client/app-slim/constants.ts" />
/// <reference path="../../../client/types-and-const-enums.ts" />

import * as _ from 'lodash';
import * as utils from '../utils/utils';
import c from '../test-constants';

type WElm = WebdriverIO.Element;


export function postElem(elem: WElm): PostElem {
  return new PostElem(elem);
}


export class PostElem {

  #postElem: WElm;

  constructor(elem: WElm) {
    this.#postElem = elem;
  }

  async getText(): Pr<St> {
    const bodyElm = await this.#postElem.$('.dw-p-bd');
    return await bodyElm.getText();
  }
}

