use pm_derive::Hello;

#[derive(Hello)]
pub struct Greeting {
    pub text: String,
}

/// Uses the method the proc macro derives, so it builds only once the macro does (feature 008, AC6).
pub fn greet() -> String {
    let greeting = Greeting { text: String::from(Greeting::hello()) };
    let text = greeting.text;
    text
}

/// Does not use the macro's output.
pub fn shout(text: &str) -> String {
    let loud = text.to_uppercase();
    loud
}
