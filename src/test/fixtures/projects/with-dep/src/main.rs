//! A binary using the library, whose label comes from the crates.io dependency `itoa` (spec 009, AC4), and
//! holding a string literal (AC9).
fn main() {
    let title = "labels:";
    let first = with_dep::label(7);
    let second = with_dep::label(1234);
    println!("{title} {first} {second}");
}
