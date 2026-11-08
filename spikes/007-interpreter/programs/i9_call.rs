// A value moved into a function and a new one returned.
fn shout(s: String) -> String {
    let mut t = s;
    t.push('!');
    t
}

fn main() {
    let a = String::from("hi");
    let b = shout(a);
    println!("{b}");
}
