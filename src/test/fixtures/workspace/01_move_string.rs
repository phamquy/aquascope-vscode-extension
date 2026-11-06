// Rust Book ch. 4.1: a String is moved, so s1 loses its permissions.
fn main() {
    let s1 = String::from("hello");
    let s2 = s1;
    println!("{s2}, world!");
}
