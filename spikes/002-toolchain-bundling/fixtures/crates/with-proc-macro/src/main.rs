// A crate whose dependencies include a proc macro and a build script, which need a linker.
use serde::Serialize;

#[derive(Serialize)]
struct Point {
    x: i32,
    y: i32,
}

fn main() {
    let p = Point { x: 1, y: 2 };
    let q = p;
    println!("{} {}", q.x, q.y);
}
