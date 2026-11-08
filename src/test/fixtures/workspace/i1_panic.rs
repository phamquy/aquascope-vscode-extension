// A runtime panic: indexing a Vec out of bounds.
fn main() {
    let v = vec![1, 2];
    let x = v[5];
    println!("{x}");
}
