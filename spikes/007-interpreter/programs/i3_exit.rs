// The program exits early with a non-zero code.
fn main() {
    let s = String::from("bye");
    println!("{s}");
    std::process::exit(3);
}
