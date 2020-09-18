local http = require "resty.http"
-- Docs: https://github.com/ledgetech/lua-resty-http

-- Tests: upload-images-and-files.test.ts  TyT50E6KTDU7.TyTE2ESVUPLCK


local content_length = ngx.var.content_length
local host = ngx.var.host
local ip = ngx.var.remote_addr

local httpc = http.new()

-- Timeouts: connect, send and read (in millis) — a second or more,
-- in case the JVM collects garbage or sth like that.
-- COULD: Many minutes read timeout, in dev mode, so time for a human
-- to step through the Scala app in a debugger.
httpc:set_timeouts(500, 3000, 3000)

-- There's a connection pool; matching idle connections will get reused.
-- This: httpc:connect("app", 9000)  Lua? Nginx? cannot resolve 'app'.
-- But oddly enough, works fine in  server-locations.conf!
-- But this works:  (31 is 'app', see  INTERNAL_NET_APP_IP in .env)
--
-- However! Are there very early self hosted installs?
-- Without a .env with fixed ip addrs? Then this won't work, and,
-- for now, then let's reply Ok to the request.
-- DO_AFTER 2020-11-01 figure out how to verify if any old self hosted
-- installations lack the fixed ip config? [rej_upl_if_err]
httpc:connect("172.27.0.31", 9000)

-- Someone else had problems with hostname resolution too:
-- https://github.com/openresty/lua-nginx-module/issues/441#issuecomment-65954680

-- COULD parse the request body and split at the form-data boundaries,
-- to find out how large each file is, in case there're many uploads in
-- the same request.
-- See: https://www.gakhov.com/articles/
--          implementing-api-based-fileserver-with-nginx-and-lua.html
-- COULD calculate Sha256 hashes of these individual files, and ask the
-- server if they've been saved already, server side, and then skip uploading
-- those files (just adding the <a href=...> links).
-- See: https://stackoverflow.com/questions/13981832/
--          how-do-i-use-sha256-on-a-filebinary-file-such-as-images-in-javascript
--
local res, err = httpc:request({
    path = "/-/may-upload-file",
    query = "sizeBytes=" .. content_length,
    headers = {
        ["Host"] = host,  -- [ngx_host_hdr]
        ["Cookie"] = ngx.var.http_cookie,
        ["X-Request-Id"] = ngx.var.request_id,
        ["X-Forwarded-For"] = ngx.var.proxy_add_x_forwarded_for,
    },
})

local toFromSize =
        "to: " .. host ..
        " from: " .. ip ..
        " size: " .. content_length

if not res then
    -- ngx.status = 500
    -- ngx.header.content_type = 'text/plain'
    -- ngx.say("500 Internal Error\n\n" ..
    --         "Error finding out if may upload file [TyEUPLCHK]\n\n", err)
    ngx.log(ngx.ERR, "Request failed: /-/may-upload-file, " ..
            "NOT ejecting upload " .. toFromSize    -- [rej_upl_if_err]
            " [TyEUPLCHK], error: " .. err)
            -- ": 500 Internal Error [TyEUPLCHK]: " .. err)
    -- return ngx.exit(ngx.HTTP_OK)
    return ngx.exit(ngx.OK)
end

if res.status ~= 200 then
    ngx.status = res.status
    ngx.header.content_type = 'text/plain'
    ngx.say(res:read_body())
    ngx.log(ngx.DEBUG, "Rejecting upload " .. toFromSize ..
            " [TyMREJUPL], status: " .. res.status)
    return ngx.exit(ngx.HTTP_OK)
end

ngx.log(ngx.DEBUG, "Allowing upload " .. toFromSize .. " [TyMALWUPL]")

