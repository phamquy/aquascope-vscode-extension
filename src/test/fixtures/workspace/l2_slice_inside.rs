// Slices that start partway into their text, which flashed and then removed every diagram (issue #83): one into a string literal of 14 characters, which the diagram shortens to its first 11 and its last, and one into a temporary String.
fn show(s: &str) {
    println!("{s}");
}

fn main() {
    show("  hello there ".trim());
    show(&String::from("abc")[1..]);
}
