/*
 * Copyright (c) 2021 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// <reference path="fetch.ts" />
/// <reference path="../../tests/e2e/pub-api.ts" />

//------------------------------------------------------------------------------
   namespace tyns {
//------------------------------------------------------------------------------


export function fetchAndFillInCommentCounts(talkyardServerUrl: St) {
  const urls: St[] = [];
  const countElms: Element[] = [];
  const countElmsColl: NodeListOf<Element> =
          document.querySelectorAll('.ty_NumCmts'); // '.ty_NumOpLikeVotes');

  for (let i = 0; i < countElmsColl.length; ++i) {
    const countElm = countElmsColl[i];
    const enclosingLink: HTMLElement | Nl = countElm.closest('a[href]')
    if (!enclosingLink) continue;
    let url: St = enclosingLink.getAttribute('href');
    // Don't send URL hash fragment to server.
    // Also skip urls without any '/' — Talkyard wants embedding page paths
    // to either be an origin + full url path, or full url path (incl leading slash).
    url = url.replace(/#.*$/, '');
    if (!url || url.indexOf('/') === -1) {
      // Use debugLog():
      // console.debug(`Skipping: "${url}", not a complete URL or path`);
      continue;
    }

    // Use debugLog():
    // console.debug(elm);
    // console.debug(enclosingLink);
    // console.debug(`URL: ${url}`);

    urls.push(url);
    countElms.push(countElm);
  }

  if (urls.length) {
    const pageRefs = urls.map(u => 'emburl:' + u);
    const requestBody: GetQueryApiRequest = {
      getQuery: {
        getWhat: 'Pages',
        getRefs: pageRefs,
        inclFields: {
          numOpLikeVotes: true,
          numTotRepliesVisible: true,
        },
      }
    };
    sendFetchRequest(talkyardServerUrl + '/-/v0/get', {
      isCors: true,
      body: requestBody,
      onOk: (response: GetQueryApiResponse<PageOptFields>) => {
        fillInCounts(response);
      },
      onError: (httpStatusCode: Nr, errCode: St) => {
        fillInCounts({ error: { httpStatusCode, errCode }});
      },
    });
  }

  function fillInCounts(response: GetQueryApiResponse<PageOptFields>) {
    const respErr: ResponseError | U = (response as ApiErrorResponse).error;

    const anyResult = !respErr && response as GetQueryResults<PageOptFields>;
    const pagesOrErrs: (PageOptFields | ErrCodeMsg | Z)[] =
            anyResult?.thingsOrErrs || [];

    for (let i = 0; i < countElms.length; ++i) {
      const countElm = countElms[i];
      const pageOrErr = pagesOrErrs[i];

      let numComments: Nr | St = '?';
      let newClasses: St[] | U;

      if (!pageOrErr) {
        newClasses = ['ty_NumCmts-Err', 'ty_NumCmts-Err-' + respErr?.errCode];
      }
      else {
        const errCode: St | U = (pageOrErr as ErrCodeMsg).errCode;
        // Not Found is returned as error TyEPGNF — but that's not really an error;
        // it happens also if the embedded discussion simply hasn't been created yet,
        // because no comments posted. So, then show 0, and use CSS class -PgNF
        // for "page not found" instead of -Err-.
        if (errCode === 'TyEPGNF') {
          numComments = 0;
          newClasses = ['ty_NumCmts-PgNF'];
        }
        else if (errCode) {
          newClasses = ['ty_NumCmts-Err', 'ty_NumCmts-Err-' + errCode];
        }
        else {
          const page = pageOrErr as PageOptFields;
          numComments = page.numTotRepliesVisible;
          newClasses = ['ty_NumCmts-Ok'];
        }
      }

      // Not "N comments" — just "N"; then, need no translations or pluralis.
      // Almost all? blogs show a comments icon anyway: "N (icon)" not "N comments".
      countElm.innerHTML = '' + numComments;
      countElm.classList.add(...newClasses)
    }
  }
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------