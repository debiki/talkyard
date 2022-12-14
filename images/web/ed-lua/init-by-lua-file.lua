ngx.log(ngx.INFO, 'Running: init_by_lua_file')

function file_exists(path)
    local file = io.open(path, 'r')
    if f ~= nil then
        io.close(f)
        return true
    else
        return false
    end
end

-- Bandwidth limiting
--
-- Pre-load Lua code — so the forked workers won''t need to load it themselves,
-- saving some memory.
-- See: https://github.com/openresty/lua-nginx-module#init_by_lua
--
require("lua-limit-bandwidth/access-phase")
require("lua-limit-bandwidth/log-phase")


-- Auto HTTPS
--
-- Find default config here:
-- ./openresty-pkgs/usr-local-openresty-site/lualib/resty/acme/autossl.lua
--
require("resty.acme.autossl").init({
    -- If one has accepted the LetsEncrypt ToS, https://letsencrypt.org/repository/.
    -- SHOULD be configurable [lua_conf] so self-hosted admins need to change to true?
    tos_accepted = true,

    -- Set to true in test env, to use LetsEncrypt staging env, and avoid
    -- "Too many requests" errors when using LetsEncrypt for real.
    -- [lua_conf]
    -- staging = true,

    -- By default only RSA (not ECC) enabled.
    -- domain_key_types = { 'rsa', 'ecc' },

    -- By default only challenges over HTTP (not HTTPS, tls-alpn-01) enabled.
    -- In lua-resty-acme, tls-alpn-01 is experimental. So not incl here.
    -- If enabling, remember to also update:
    --    conf/sites-enabled-manual/talkyard-servers.conf,
    -- enabled_challenge_handlers = { 'http-01', 'tls-alpn-01' },

    -- LetsEncrypt''s rate limits are higher, if one specifies an account key.
    account_key_path = '/etc/nginx/acme/acme-account.key',

    -- SHOULD be configurable [lua_conf], default empty.
    -- ${YOUR_SECURITY_EMAIL_ADDR}  in  .env  ?
    account_email = "security@talkyard.io",

    -- 30 days. LetsEncrypt recommends 30.
    renew_threshold = 3600 * 24 * 30,

    -- SHOULD make configurable [lua_conf]
    -- number of certificate cache, per type
    cache_size = 200,

    domain_whitelist_callback = function(domain) --, is_new_cert_needed)
        local maint_mode_env = os.getenv('TY_MAINT_MODE')
        if maint_mode_env ~= nil then
          -- Since under maintenance, no new sites can get created right now. So,
          -- don't generate any new certs. For existing sites, though, we already
          -- have generated certs to use.
          ngx.log(ngx.DEBUG, "Maint mode, checking if already has HTTP cert for: " .. domain
                .. " [TyMOLDCRTCK]")

          -- No. Certs are stored in Redis, so won't work:
          --   local path_to_cert = '/etc/certbot/' .. domain .. '.conf'
          --   local has_cert = file_exists(path_to_cert)
          --
          -- Instead:
          --   local has_cert = !is_new_cert_needed  -- but will that work?
          -- Or is a newer version of resty.acme.autossl needed?
          --
          -- Instead, for now:
          ngx.log(ngx.INFO, "Skipping check, just trying to reuse any cert for: "
                .. domain .. " [TyMHASCRTMBY]")
          return true

          -- if has_cert then
          --   ngx.log(ngx.INFO, "Has cert: " .. domain .. ", reusing [TyMHASCRTYES]")
          -- else
          --   ngx.log(ngx.INFO, "No cert: " .. domain .. ", won't generate new [TyMHASCRTNO]")
          -- end
          -- return has_cert
        end

        ngx.log(ngx.DEBUG, "Asking app server if should have cert: " .. domain
              .. " [TyMGENCRTCK]")

        -- This might work for avoiding trying to get certs for IP addrs
        -- (which isn't possible, just causes some pointless netw traffic).
        -- But how generate a request with an IP addr as hostname?
        -- Surprisinly, none of this worked: (where 1.2.3.4 is the server's ip addr)
        --  curl -k -v -v                    'https://1.2.3.4/test'
        --  curl -k -v -v -H 'Host: 1.2.3.4' 'https://1.2.3.4/test'
        --  curl -k -v -v -H 'Host: 1.2.3.4' 'https://talkyard.io/test'
        --  curl -k -v -v -H 'Host: 1.2.3.4' 'https://funny.co/test' \
        --                                --resolve 'funny.co:443:1.2.3.4'
        --
        -- local ipv4Parts = { domain:match("^(%d+)%.(%d+)%.(%d+)%.(%d+)$") }
        -- if #ipv4Parts == 4 then
        --   ngx.log(ngx.INFO, "Checkinp if is IP addr: " .. domain
        --         .. " [TyMGENCRTMBYIP]")
        --   local isIp = true
        --   for _, v in pairs(ipv4Parts) do
        --     if tonumber(v) > 255 then
        --       isIp = false
        --     end
        --   end
        --   if isIp then
        --     ngx.log(ngx.INFO, "Should not have cert, is IP addr: " .. domain
        --           .. " [TyMGENCRTNOIP4]")
        --     return false
        --   end
        -- end
        -- Could also check if is IPv6, seee:
        -- https://stackoverflow.com/a/16643628

        local http = require('resty.http')
        local httpc = http.new()
        httpc:set_timeouts(1000, 5000, 5000)
        local con_ok, con_err = httpc:connect('app', 9000)
        if not con_ok then
            ngx.log(ngx.WARN, "Cannot connect to 'app', so cannot check " ..
                  "if should have cert: " .. domain ..
                  ", err: `" .. con_err .. "' [TyMGENCRTERR]")
            return false
        end

        local req_res, req_err = httpc:request({
            path = '/-/_int_req/hostname-should-have-cert',
            headers = {
                -- ['X-Request-Id'] = ngx.var.request_id,  — cannot access here
                ['Host'] = domain,
            },
        })

        if not req_res then
            ngx.log(ngx.WARN, "Error checking if should have cert: " .. domain
                  .. ", err: `" .. req_err .. "' [TyMGENCRTERR]")
            return false
        end

        -- 2XX is an ok response, and 30X are various redirects. We need to
        -- generate certs also for redirect responses, otherwise the browser shows
        -- a cert warning, instead of following the redirect — this'd happen if
        -- 1) a site got moved to another domain, or 2) if a site is login-required;
        -- then, one gets redirected to the login page.
        local status = req_res.status
        if status < 200 or 308 < status then
            ngx.log(ngx.INFO, "Should not have cert: " .. domain .. " [TyMGENCRTNO]")
            return false
        end

        ngx.log(ngx.INFO, "Should have cert: " .. domain .. " [TyMGENCRTYES]")
        return true
    end,

    storage_adapter = 'redis',
    storage_config = {
        host = 'cache',  -- the service name in docker-compose.yml
        port = 6379,     -- the default Redis port
        database = 0,    -- Ty uses just one Redis database  [ty_v1] use on dedicated
                         -- Redis for HTTPS certs
        auth = nil,      -- no password, Redis not publ accessible
    },
})
