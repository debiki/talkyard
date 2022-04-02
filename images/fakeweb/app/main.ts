import { serve } from "https://deno.land/std@0.130.0/http/server.ts";

const port = 8090;

const webhookReqsBySiteId: { [siteId: number] : Object[] } = {};

const statusCodesBySite: { [siteId: number]: number } = {};



const requestHandler = async (req: Request): Promise<Response> => {
  console.log(`Incoming request: ${req.method} ${req.url}`);

  const url = new URL(req.url);

  const siteIdSt: string | null = url.searchParams.get('siteId');
  if (!siteIdSt) return errorBadReq("Query param '?siteId=__' missing");
  const siteId = parseInt(siteIdSt);
  if (isNaN(siteId)) return errorBadReq(`Query param '?siteId=${siteId}' is not a number`);

  switch (url.pathname) {
    case '/ping':
      return new Response("pong\n");

    case '/break-webhooks': {
      if (req.method !== 'POST') return errorBadReq("The request method must be POST");
      const returnStatusCode = toIntOrElse(url.searchParams.get('returnStatusCode'), 500);
      statusCodesBySite[siteId] = returnStatusCode;
      return ok(`s${siteId}: Will now return status ${returnStatusCode}.`);
    }

    case '/mend-webhooks': {
      if (req.method !== 'POST') return errorBadReq("The request method must be POST");
      delete statusCodesBySite[siteId];
      return ok(`s${siteId}: Will now return 200 OK.`);
    }

    case '/webhooks': {
      if (req.method !== 'POST')
        return errorBadReq("The request method must be POST");
      if (!req.body)
        return errorBadReq("Request body missing");

      const text = await req.text();

      try {
        // Parsing the body as json, fails, if the app server sent it as a chunked
        // request — then, the first chunk isn't all of the json, if there're many chunks.
        const json = JSON.parse(text);
        console.log(`s${siteId}: Got a webhook with JSON, ${text.length} chars:  ${text}`);
        const webhookReqs = webhookReqsBySiteId[siteId] || [];
        webhookReqsBySiteId[siteId] = webhookReqs;
        webhookReqs.push(json);

        const badStatus = statusCodesBySite[siteId];
        const resp = badStatus
            ? fakeError(`s${siteId}: Faking failure, status code ${badStatus}`, badStatus)
            : ok(`s${siteId}: Thanks for the webhook message.`);
        return resp;
      }
      catch (ex) {
        console.error(`Invalid JSON:`, ex);
        console.log(`The invalid JSON, ${text.length} chars, between -----:` +
              `\n------------\n${text}\n-----------\n`);
        return errorBadReq(`Bad JSON, ${text.length} chars, see fakeweb's log file.`);
      }
    }

    case '/clear-webhook-reqs': {
      if (req.method !== 'POST') return errorBadReq("The request method must be POST");
      delete webhookReqsBySiteId[siteId];
      return  jsonResp(`s${siteId}: Forgot all webhook requests`, { ok: true });
    }

    case '/list-webhook-reqs': {
      if (req.method !== 'GET') return errorBadReq("The request method must be GET");
      const webhookReqs = webhookReqsBySiteId[siteId] || [];
      return  jsonResp(`s${siteId}: Returning ${webhookReqs.length} webhook requests:\n${
            j2s(webhookReqs)}`, { webhookReqs });
    }

    default:
      return errorBadReq(`Bad URL path: ${url.pathname}`);
  }
};


console.log(`Fakeweb HTTP server running at:  http://localhost:${port}/`);

await serve(requestHandler, { port });



function jsonResp(logMsg: string, json: Object): Response {
  console.log(logMsg);
  const jsonSt = JSON.stringify(json);
  return new Response(jsonSt, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}


function ok(msg: string) {
  console.log(msg);
  return new Response(msg);
}

function errorBadReq(msg: string) {
  console.error(msg);
  return new Response(msg, { status: 400 });
}

function fakeError(msg: string, status: number) {
  console.log(msg); // not error(msg)
  return new Response(msg, { status });
}


function toIntOrElse(value: string | null, orElse: number): number {
  if (!value) return orElse;
  const valAsNr = parseInt(value);
  return isNaN(valAsNr) ? orElse : valAsNr;
}

/// Dupl code [dupl_j2s].
function j2s(something: any, replacer = stringifyReplacer,
        indentation?: number): string {
  return JSON.stringify(something, replacer, indentation);
}

/// Dupl code [dupl_j2s].
/// JSON.stringify() doesn't know how to serialize a Map, so we'll need to specify
/// what JSON to generate, for a Map.
function stringifyReplacer(key: any, value: any): any {
  if (value instanceof Map) {
    return { mapEntries: [...value.entries()] };
  }
  return value;
}