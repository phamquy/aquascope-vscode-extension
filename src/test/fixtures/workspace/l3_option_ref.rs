// A reference into an enum's payload, from rustlings' options3, which failed with exit code 101 (issue #88): `p` points at the Point inside Some, after the Option's tag.
#[derive(Debug)]
struct Point {
    x: i32,
    y: i32,
}

fn main() {
    let optional_point = Some(Point { x: 100, y: 200 });

    match &optional_point {
        Some(p) => println!("Coordinates are {},{}", p.x, p.y),
        _ => panic!("No match!"),
    }

    println!("{optional_point:?}");
}
