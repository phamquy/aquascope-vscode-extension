use serde::Serialize;

/// Derived with serde's proc macro, which cargo builds from crates.io (spec 008, D4 and R7).
#[derive(Serialize)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}

fn needs_serialize<T: Serialize>(_value: &T) {}

/// Uses the derived implementation, so it cannot be analysed if the derive failed to build.
pub fn check() -> i32 {
    let p = Point { x: 1, y: 2 };
    needs_serialize(&p);
    p.x + p.y
}

/// Does not use the derive.
pub fn shift(p: Point) -> Point {
    let moved = p;
    Point { x: moved.x + 1, y: moved.y }
}
