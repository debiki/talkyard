use pasetors::claims::{Claims}; //, ClaimsValidationRules};
use pasetors::keys::{Generate, SymmetricKey};
use pasetors::{local, Local, version4::V4, version2::V2};
// use core::slice::SlicePattern; — VSCode auto-added this? I didn't. Results in:
//   error[E0658]: use of unstable library feature 'slice_pattern': stopgap trait for slice patterns
//   note: see issue #56345 <https://github.com/rust-lang/rust/issues/56345> for more information
//use pasetors::token::UntrustedToken;
//use core::convert::TryFrom;
use std::env;

  use std::{fmt::Write, num::ParseIntError};

use pasetors::version2; // ::LocalToken;


fn mainv4() { // -> Result<(), dyn Error> {
   println!("Hello, claimed world v4!");

   let args: Vec<String> = env::args().collect();
   dbg!(args);

  // Setup the default claims, which include `iat` and `nbf` as the current time and `exp` of one hour.
  // Add a custom `data` claim as well.
  let mut claims: Claims = Claims::new().unwrap(); // ?;
  claims.add_additional("data", "A secret, encrypted message").unwrap(); // ?;

  // Generate the key and encrypt the claims.
  let sk: SymmetricKey::<V4> = SymmetricKey::<V4>::generate().unwrap(); // ?;
  let token: String = local::encrypt(&sk, &claims, None, Some(b"implicit assertion")).unwrap(); // ?;

  println!("Token: {:?}", token);
}



fn main() {
   // println!("Hello, claimed world v2!");
   if let Err(e) = foo() {
    eprintln!("{}", e);
    // handle the error properly here
  }

   let args: Vec<String> = env::args().collect();

  // Setup the default claims, which include `iat` and `nbf` as the current time and `exp` of one hour.
  // Add a custom `data` claim as well.
  let mut claims: Claims = Claims::new().unwrap(); // ?;
  claims.add_additional("data", "A secret, encrypted message").unwrap(); // ?;

  // Generate the key and encrypt the claims.
  let sk_new: SymmetricKey::<V2> = SymmetricKey::<V2>::generate().unwrap(); // ?;

  // Create a `SymmetricKey` from `bytes`.
  let key_as_hex: &String = &args[1];
  let key: Vec<u8> = decode_hex(key_as_hex).unwrap(); //: &String = &args[1];
  let key_bytes: &[u8] = key.as_slice();


  let msg: &String = &args[2];

  let sk: SymmetricKey<V2> = SymmetricKey::<V2>::from(key_bytes).unwrap();

  let token: String = version2::LocalToken::encrypt(&sk, msg.as_bytes(), None).unwrap(); // ?;
  /*

  let lk = version2::LocalToken::encrypt();
 */
  //dbg!(args);
  println!("{:}", token);
}


  // From: https://stackoverflow.com/a/52992629
  pub fn decode_hex(s: &str) -> Result<Vec<u8>, ParseIntError> {
      (0..s.len())
          .step_by(2)
          .map(|i| u8::from_str_radix(&s[i..i + 2], 16))
          .collect()
  }
