Can it be okay to store a session in `localStorage`?
====================================================

Short answer: Yes. If there's an XSS attack, you have other worse problems
anyway.

Nevertheless, planning to implement: `[weaksid]`.

More details:

A reply to an article that kind of says "Never Never Never",
the reply was written by Jonathan Gros-Dubois, https://dev.to/jondubois.
Here it is (the reply):

https://dev.to/jondubois/comment/373l,

here's a copy (from 2019-12-06),
  Copyright Jonathan Gros-Dubois:  ../modules/ty-cla/docs/session-in-local-storage.md

Another reply about this, also by Jonathan Gros-Dubois:
https://dev.to/jondubois/comment/3749

Even more detils:

One risk is if someone logs in at a public computer, posts a
comment and then stays logged in (probably a Guest user?). However, I haven't seen
such public computers with a shared login account the last 10 years or so —
instead, on a shared computer in e.g. a library, everyone still logs in to
hens own Windows account; people don't use the same account and there's no
single shared web browser instance that othres can reuse after you. — So I
think this isn't that much of a problem (any longer), compared to the
inconvenience of people getting "randomly" logged out when they open
the same page in a different brower tab (`sessionStorage` doesn't work
accross different tabs in the same browser).
