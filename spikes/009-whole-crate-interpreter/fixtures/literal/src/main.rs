//! A string literal: the pinned fork's interpreter recurses forever reading `s` (upstream issues #75, #118).
fn main() {
    let s = "hi";
    let n = s.len();
    println!("{n}");
}
