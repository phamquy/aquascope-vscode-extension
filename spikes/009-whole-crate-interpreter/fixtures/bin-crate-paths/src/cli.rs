use crate::helpers::trim;

pub fn parse(text: &str) -> i32 {
    let digits = trim(text);
    digits.parse().unwrap()
}
