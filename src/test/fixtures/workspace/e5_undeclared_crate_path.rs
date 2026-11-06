// Calls an external crate by path without a use (E0433 expected).
fn main() {
    let n = rand::random::<u8>();
    let s = n.to_string();
    let t = s;
    println!("{t}");
}
