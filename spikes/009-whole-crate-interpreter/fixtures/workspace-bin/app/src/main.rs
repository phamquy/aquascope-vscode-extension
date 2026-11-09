//! A binary member using a library member, and reading a file named relative to the working folder.
fn main() {
    let names = std::fs::read_to_string("names.txt").unwrap();
    for name in names.lines() {
        let greeting = greeter::greet(name);
        println!("{greeting}");
    }
}
