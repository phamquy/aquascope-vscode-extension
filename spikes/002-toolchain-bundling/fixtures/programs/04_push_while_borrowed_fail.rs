// Rust Book ch. 4.2: pushing while a borrow is live is rejected. Run with --should-fail.
fn main() {
    let mut v: Vec<i32> = vec![1, 2, 3];
    let num: &i32 = &v[2];
    v.push(4);
    println!("Third element is {}", *num);
}
