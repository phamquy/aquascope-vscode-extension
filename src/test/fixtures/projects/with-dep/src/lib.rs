/// A label for a number, formatted by the `itoa` crate from crates.io.
pub fn label(n: u64) -> String {
    let mut buffer = itoa::Buffer::new();
    let digits = buffer.format(n);
    let mut text = String::from("#");
    text.push_str(digits);
    text
}
