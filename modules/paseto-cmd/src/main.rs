use pasetors::claims::Claims;
use pasetors::keys::{Generate, SymmetricKey};
use pasetors::{local, Local, version4::V4, version2, version2::V2};
use std::env;
use std::{fmt::Write, num::ParseIntError};



fn main() {
   let args: Vec<String> = env::args().collect();

  // Later, handle & print errors: (rather than just unwrap & crash)
  //if let Err(e) = gen_token(args) {
  //  eprintln!("{}", e);
  //}

  let key_as_hex: &String = &args[1];
  let key: Vec<u8> = decode_hex(key_as_hex).unwrap();
  let key_bytes: &[u8] = key.as_slice();

  let msg: &String = &args[2];

  let sym_key: SymmetricKey<V2> = SymmetricKey::<V2>::from(key_bytes).unwrap();

  let token: String = version2::LocalToken::encrypt(&sym_key, msg.as_bytes(), None).unwrap();

  //dbg!(args);

  println!("{:}", token);
}


// See: https://stackoverflow.com/a/52992629
pub fn decode_hex(s: &str) -> Result<Vec<u8>, ParseIntError> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16))
        .collect()
}
