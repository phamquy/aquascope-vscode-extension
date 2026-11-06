// A type error in one function and a borrow error in another.
fn type_error() -> u32 {
    let x: u32 = "a";
    x
}

fn main() {
    let mut v = vec![1, 2, 3];
    let first = &v[0];
    v.push(4);
    println!("{first}");
}
