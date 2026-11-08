// Reads a line from standard input.
fn main() {
    let mut line = String::new();
    std::io::stdin().read_line(&mut line).unwrap();
    println!("{line}");
}
