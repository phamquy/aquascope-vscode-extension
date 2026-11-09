use minigrep::search;

#[test]
fn one_result() {
    let contents = "safe, fast, productive.";
    assert_eq!(search("fast", contents), vec!["safe, fast, productive."]);
}
