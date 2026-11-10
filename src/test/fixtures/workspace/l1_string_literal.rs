// A reference to a string literal, which Aquascope's interpreter could not read until the fork read it as its characters (feature 009, D7).
fn main() {
    let s = "hi";
    let n = s.len();
    println!("{n}");
}
