// Uses an external crate the single-file crate does not have (E0432 expected).
use serde::Serialize;

#[derive(Serialize)]
struct Point {
    x: i32,
}

fn main() {
    let p = Point { x: 1 };
    let q = p;
    println!("{}", q.x);
}
