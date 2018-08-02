local util = require 'util'

ngx.log(ngx.DEBUG, "TyLuaLog00")

local ip = ngx.var.remote_addr
local server_name = ngx.var.server_name
local bytes_sent = ngx.var.bytes_sent

-- Skip internal requests to port 81 — they're for publishing via Nchan, or viewing status.
if server_name == '_internal_port_81_' then
  return
end

ngx.log(ngx.DEBUG, "TyLuaLog01")
local used_ip_bw = util.get_used_bw(ngx.shared.bw_by_ip, ip)
ngx.log(ngx.DEBUG, "TyLuaLog02")
local used_server_bw = util.get_used_bw(ngx.shared.bw_by_server, server_name)
ngx.log(ngx.DEBUG, "TyLuaLog03")
local used_total_bw = util.get_used_bw(ngx.shared.bw_by_server, '_all_servers_')
ngx.log(ngx.DEBUG, "TyLuaLog04")

local new_used_ip_bw = used_ip_bw + bytes_sent
local new_used_server_bw = used_server_bw + bytes_sent
local new_used_total_bw = used_total_bw + bytes_sent

-- ngx.log(ngx.DEBUG, "Log phase, ip: " .. ip .. ", server: " .. server_name ..
--         ", bytes: " .. bytes_sent .. ", ip bw: " .. new_used_ip_bw ..
--         ", server bw: " .. new_used_server_bw .. " [TyDLUANUMS")

ngx.log(ngx.DEBUG, "TyLuaLog11")
util.set_used_bw(ngx.shared.bw_by_ip, 'per ip', ip, new_used_ip_bw)
ngx.log(ngx.DEBUG, "TyLuaLog12")
util.set_used_bw(ngx.shared.bw_by_server, 'per server', server_name, new_used_server_bw)
ngx.log(ngx.DEBUG, "TyLuaLog13")
util.set_used_bw(ngx.shared.bw_by_server, 'total', '_all_servers_', new_used_total_bw)
ngx.log(ngx.DEBUG, "TyLuaLog14")

-- Later: Reset each week?
-- See http://stackoverflow.com/questions/19035286/how-to-create-asynchronous-cron-like-scheduler-inside-nginx
-- + perhaps use secs = ngx.time()
-- + or the comment about expire times in util.lua
-- Or use Redis + expiration times?

