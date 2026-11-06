// Rust Book ch. 4.1: moving a Box transfers ownership of the heap data.
fn main() {
    let a = Box::new([0; 1_000_000]);
    let b = a;
    println!("{}", b.len());
}
