/// <reference path="../types-and-const-enums.ts" />

import { serve } from "https://deno.land/std@0.167.0/http/server.ts";


console.log(`Starting server ...`);



async function serverReqHandler(req: Request): Pr<Response> {
  console.log("Method:", req.method);

  const url = new URL(req.url);
  console.log("Path:", url.pathname);
  console.log("Query parameters:", url.searchParams);

  console.log("Headers:", req.headers);

  if (!req.body) {
    return new Response("No request body");
  }

  const reqBody = await req.text();
  console.log("Body:", reqBody);

  let respBody: St;

  if (url.pathname === '/renderAndSanitizeCommonMark') {
    console.log(`I will:  renderAndSanitizeCommonMark`);
    respBody = globalThis.renderAndSanitizeCommonMark(reqBody, false, false, null, '/uploads_url_prefx/');
    // It works!
    /*
    curl http://localhost:8070/renderAndSanitizeCommonMark -d  '**boldify** _italics_   

    ```
    code in
       backticks()
    ```
    '   */
  }
  else if (url.pathname === '/sanitizeHtmlServerSide') {
    console.log(`I will:  sanitizeHtmlServerSide`);
    respBody = globalThis.sanitizeHtmlServerSide(reqBody, false);

    // It works!
    //    curl http://localhost:8070/sanitizeHtmlServerSide -d '<div>I am in a div. JSON: {"aa": 11, "bb": 22}</div> <b>bold?</bold> Param like:  http://ex.co/aa/bb?qq=vv;q2=v2,q3=v3'
    //
  }
  else if (url.pathname === '/renderReactServerSide') {
    console.log(`I will:  renderReactServerSide`);
    respBody = globalThis.renderReactServerSide(reqBody);
  }
  else if (url.pathname === '/denoExit') {
    console.log(`I will:  Deno.exit`);
    Deno.exit();
  }
  else {
    console.log(`I won't:  ${url.pathname}`);
  }

  return new Response(respBody);
}


serve(serverReqHandler, { port: 8087 });
