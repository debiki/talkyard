ngx.log(ngx.INFO, 'Running: init_worker_by_lua_block')

-- The worker will share the 'local var_name' variables inited in init_by_lua_block{}
-- above — read more here:
-- https://github.com/openresty/lua-nginx-module#data-sharing-within-an-nginx-worker
-- to learn about how data sharing in Nginx workers and Lua works.
-- (Once inited, those local variables aren't changed — only read.)

require("resty.acme.autossl").init_worker()
