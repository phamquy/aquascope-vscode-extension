// A failed assertion after two steps.
fn main() {
    let a = 1 + 1;
    let b = String::from("two");
    assert_eq!(a, 3, "{b}");
}
