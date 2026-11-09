//! A binary with a module and no library: every function is in the binary's crate.
mod shapes;

use shapes::Rect;

fn main() {
    let rect = Rect::new(3, 4);
    let area = rect.area();
    let label = format!("{area}");
    println!("{label}");
}
