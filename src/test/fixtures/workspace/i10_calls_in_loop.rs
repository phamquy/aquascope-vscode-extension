// A function of the program called 30 times in a loop: each call adds steps (feature 007 AC10).
fn add(a: u64, b: u64) -> u64 {
    let c = a + b;
    c
}

fn main() {
    let mut sum = 0;
    for i in 0..30 {
        sum = add(sum, i);
    }
    println!("{sum}");
}
