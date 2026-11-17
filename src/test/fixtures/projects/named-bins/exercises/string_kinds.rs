fn string_slice(arg: &str) {
    println!("{arg}");
}

fn string(arg: String) {
    println!("{arg}");
}

fn main() {
    string_slice("blue");
    string("red".to_string());
    string_slice("  hello there ".trim());
}
