This Rust project builds a program, target/debug/paseto-cmd,  which
encrypts a PASETO v2.local token, given a shared secret and a JSON string:

    target/debug/paseto-cmd SECRET MESSAGE

The secret should be a hex string. If there's any error, then, right now,
the program exists and prints just nothing (crickets!), or maybe some cryptic
Rust error message.

But what's this for?

This is for blog comments Single Sign-On (SSO) e2e tests. Then, need to generate
PASETO tokens, but the only Javascript library that supports v2.local tokens
stopped working, because it relies on a crypto function that was removed in
Node.js v10 (namely `_ZN2v812api_internal12ToLocalEmptyEv`).  See [paseto_broken] in:
   ../../tests/e2e-wdio7/specs/embcom.sso.token-in-cookie.2br.test.ts--e2e-crypto-probl.txt

The Rust library now in use (Pasetors), however, will likely be maintained for
quite a while? — It seems Cargo (Rust's package manager) uses it:
   
   https://github.com/brycx/pasetors/issues/40

   >  [...] The context is the conversation starting at rust-lang/rfcs#3139
   >  https://github.com/rust-lang/rfcs/pull/3139#issuecomment-920296667
   >
   >  Fundamentally, we (cargo) want to sign some json (so PASETO is a good option)

and  https://github.com/rust-lang/rfcs/pull/3139#issuecomment-920296667:

   >  Based on discussion of these properties and potential implementations
   >  with security experts, we think it's possible to achieve all of these
   >  properties by using somthing like the PASETO v4.public format.

   >  There are not currently implementations of PASETO v4.public for Rust,
   >  but I have bean told by the maintainers of both Rust PASETO libraries
   >  that it is coming in the next month or so.

That was Sep 15, 2021 — now, that PR has been merged into Rust ... And indeed,
Cargo uses it: (Dec 2023)
https://github.com/rust-lang/cargo/blob/37bc5f0232a0bb72dedd2c14149614fd8cdae649/Cargo.toml#L68

    pasetors = { version = "0.6.7", features = ["v3", "paserk", "std", "serde"] }

It'd be nice to start supporting v4.local too & by default. [paseto_v4_local]
