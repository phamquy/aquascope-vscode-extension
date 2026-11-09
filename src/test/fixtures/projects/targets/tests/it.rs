#[test]
fn doubles_twice() {
    let once = targets::double(vec![1]);
    let twice = targets::double(once);
    assert_eq!(twice, vec![4]);
}
