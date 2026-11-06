// A type error, not a borrow error.
fn main() {
    let x: u32 = "a";
    println!("{x}");
}
