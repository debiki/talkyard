local M = {}


local function get_used_bw(dict, key)
    local bw, flags = dict:get(key)
    if bw == nil then
        bw = 0
    end
    return bw
end


local function set_used_bw(dict, key, bw)
    -- Ignore races. This needn't be totally exact.
    local expiration_seconds = 7 * 24 * 3600

    -- How avoid overwriting previous expiration time? By not specifying exptime??
    local ok, err, forcible = dict:set(key, bw, expiration_seconds)

    if not ok then
        ngx.log(ngx.ERR, "Error adding bandwidth to  " .. key .. " [EsE5KG2W3]")
    end

    if forcible then
        -- COULD log this at most once per day.
        ngx.log(ngx.WARN, "Per ip cache too small, old entry removed [EsE2PK47]")
    end
end


M.get_used_bw = get_used_bw
M.set_used_bw = set_used_bw

return M

