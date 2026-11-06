// Declares a module file the single-file crate does not have (E0583 expected).
mod other;

fn main() {
    let s = String::from("hi");
    other::show(&s);
}
