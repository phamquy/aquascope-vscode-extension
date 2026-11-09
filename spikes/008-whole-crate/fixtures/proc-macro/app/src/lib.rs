#[derive(pm_derive::Hello)]
pub struct Greeting {
    pub text: String,
}

pub fn greet() -> String {
    let greeting = Greeting { text: String::from("hi") };
    greeting.text
}
