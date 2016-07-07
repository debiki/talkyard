local util = require 'util'

local ip = ngx.var.remote_addr
local server_name = ngx.var.server_name

local used_ip_bw = util.get_used_bw(ngx.shared.bw_by_ip, ip)
local used_server_bw = util.get_used_bw(ngx.shared.bw_by_server, server_name)
local used_total_bw = util.get_used_bw(ngx.shared.bw_by_server, '_all_servers_')

local forbiddenMessage = false

-- COULD avoid logging > 1 per ip or server, per minute? hour? day?

-- Bandwidth in bytes per second:
local full_speed = 300e3
local normal_speed = 150e3
local slow_speed = 33e3
local speed = full_speed

function slow_down(new_speed)
    if new_speed < speed then
        speed = new_speed
    end
end

-- For now, hardcode limits here. Later, load from Postgres, cache in-mem?
-- About how to configure in Nginx: https://github.com/openresty/lua-nginx-module#ngxvarvariable

if used_ip_bw > 5e6 then
    slow_down(normal_speed)
elseif used_ip_bw > 30e6 then
    slow_down(slow_speed)
elseif used_ip_bw > 50e6 then
    ngx.log(ngx.WARN, "Per ip bandwidth exceeded, replying Forbidden, ip: " ..
            ip .. ", server: " .. server_name .. " [EsE5GUK20]")
    forbiddenMessage = "You, or someone at your Internet address, " ..
            "have downloaded too much data from this server. [EsE8YKW24]"
end

if used_server_bw > 500e6 then
    slow_down(normal_speed)
elseif used_server_bw > 3e9 then
    slow_down(slow_speed)
elseif used_server_bw > 5e9 then
    ngx.log(ngx.WARN, "Per server bandwidth exceeded, replying Forbidden, server: " ..
            server_name .. " [EsE2GK47R]")
    forbiddenMessage = "People have downloaded too much data from " .. server_name .. " [EsE4LY7Z]"
end

if used_total_bw > 100e9 then
    slow_down(normal_speed)
elseif used_total_bw > 300e9 then
    slow_down(slow_speed)
elseif used_total_bw > 500e9 then
    ngx.log(ngx.ERR, "Total bandwidth exceeded, replying Forbidden [EsE5TBW5]")
    forbiddenMessage = "People have downloaded too much data from this server. [EsE5FKU20]"
end

ngx.log(ngx.DEBUG, "ip: " .. ip .. ", ip bw: " .. used_ip_bw ..
        ", server bw: " .. used_server_bw .. ", total bw: " .. used_total_bw ..
        " –> limit_rate: " .. (speed / 1e3) .. " kB/s")

ngx.var.limit_rate = speed

if forbiddenMessage then
    ngx.status = 503
    ngx.header.content_type = 'text/plain'
    ngx.say("403 Forbidden\n\nBandwidth exceeded. " .. forbiddenMessage)
    return ngx.exit(ngx.HTTP_OK)
end

