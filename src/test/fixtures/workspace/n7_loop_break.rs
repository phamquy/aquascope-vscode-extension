// A plain loop with `if … { break; }`, on which Aquascope's stepper panicked and the whole file
// failed with exit code 101 (issue #68). `describe` is a function without loops.
fn count(v: &Vec<i32>) -> usize {
    let mut i = 0;
    loop {
        if i >= v.len() {
            break;
        }
        i += 1;
    }
    i
}

fn describe(s: String) -> usize {
    let t = s;
    t.len()
}

fn main() {
    println!("{} {}", count(&vec![1, 2]), describe(String::from("x")));
}
