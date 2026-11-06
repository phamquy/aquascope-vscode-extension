// A crate with one crates.io dependency and no build script.
fn main() {
    let mut buf = itoa::Buffer::new();
    let s = String::from(buf.format(42u32));
    let t = s;
    println!("{t}");
}
