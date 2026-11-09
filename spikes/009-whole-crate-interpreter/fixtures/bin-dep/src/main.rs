//! A binary using a crates.io dependency, vendored so the probe needs no network.
fn label(n: u64) -> String {
    let mut buffer = itoa::Buffer::new();
    let digits = buffer.format(n);
    let mut text = String::from("#");
    text.push_str(digits);
    text
}

fn main() {
    let first = label(7);
    let second = label(1234);
    println!("{first} {second}");
}
