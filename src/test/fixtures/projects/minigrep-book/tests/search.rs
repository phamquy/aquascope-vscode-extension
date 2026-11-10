//! An integration test, which the program never runs: Show Stack and Heap from here finds no steps (spec 009, AC8).
use minigrep::search;

#[test]
fn one_result() {
    let contents = "Rust:\nsafe, fast, productive.\nPick three.";
    assert_eq!(vec!["safe, fast, productive."], search("duct", contents));
}
