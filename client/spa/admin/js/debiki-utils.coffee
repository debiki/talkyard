u = _ # works in the Coffeescript console, where `_` means 'last result'.

u.mixin
  # The opposite of `pick`. That is, copies `obj` but filters out
  # the specified keys.
  kick: (obj, keysToKick...) ->
    obj2 = {}
    for k, v of obj
      obj2[k] = v unless u(keysToKick).contains k
    obj2


# Transforms the values in a map. (Doesn't modify `obj` — returns a new map.)
# Example:
#   mapVals({ a: 'aa', b: 'bb'}, (value, key) -> value + '_!')
# Result: { a: 'aa_!', b: 'bb_!' }
u.mixin
  mapVals: (obj, f) ->
    obj2 = {}
    for k, v of obj
      obj2[k] = f v, k
    obj2

# Like mapVals, but removes keys for which `f` returns `undefined`.
# Example:
# mapValsKickUndef { a: 'aa', b: 'bb'}, (value, key) ->
#   if key is 'a' then value + '_!' else undefined
# Result: { a: 'aa_!' }
u.mixin
  mapValsKickUndef: (obj, f) ->
    obj2 = {}
    for k, v of obj
      v2 = f v, k
      obj2[k] = v2 unless v2 is undefined
    obj2


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
