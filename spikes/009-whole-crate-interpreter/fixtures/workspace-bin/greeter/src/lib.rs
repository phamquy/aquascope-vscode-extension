pub fn greet(name: &str) -> String {
    let mut text = String::from("Hello, ");
    text.push_str(name);
    text
}
