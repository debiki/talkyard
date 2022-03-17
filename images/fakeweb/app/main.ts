import { serve } from "https://deno.land/std@0.130.0/http/server.ts";

const port = 8090;

const webhookReqs: Object[] = [];

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  switch (url.pathname) {
    case '/ping':
      return new Response("pong\n");

    case '/webhooks':
      if (req.method !== 'POST')
        return errorBadReq("The request method must be POST");

      if (!req.body)
        return errorBadReq("Request body missing");

      const json = await req.json();
      const jsonSt = JSON.stringify(json);
      console.log(`Got JSON: ${jsonSt}`);
      webhookReqs.push(json);
      // + req.headers

      // + save per site?:  url.searchParams

      return new Response("Thanks, I saved the JSON: " + jsonSt);

    case '/clear-webhook-reqs':
      if (req.method !== 'POST') return errorBadReq("The request method must be POST");
      webhookReqs.length = 0;
      return  jsonResp({ ok: true });

    case '/list-webhook-reqs':
      if (req.method !== 'GET') return errorBadReq("The request method must be GET");
      return  jsonResp({ webhookReqs });

    default:
      return errorBadReq(`Bad URL path: ${url.pathname}`);
  }

};

console.log(`HTTP webserver running. Access it at: http://localhost:8090/`);

await serve(handler, { port });


function jsonResp(json: Object): Response {
  const jsonSt = JSON.stringify(json);
  return new Response(jsonSt, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function errorBadReq(msg: string) {
  return new Response(msg, { status: 400 });
}