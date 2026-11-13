// `let … else` that returns early, followed by more branching (feature 010, AC8).
pub fn first_word_len(text: Option<String>, fallback: String) -> usize {
    let Some(line) = text else {
        return fallback.len();
    };
    let Some(word) = line.split_whitespace().next() else {
        return 0;
    };
    if word.len() > fallback.len() {
        word.len()
    } else {
        fallback.len()
    }
}

fn main() {
    println!("{}", first_word_len(Some(String::from("hello world")), String::from("x")));
}
