// Rust Book ch. 5.3: a &mut self method call borrows the struct mutably.
struct Rect {
    width: u32,
    height: u32,
}

impl Rect {
    fn grow(&mut self, by: u32) {
        self.width += by;
        self.height += by;
    }
    fn area(&self) -> u32 {
        self.width * self.height
    }
}

fn main() {
    let mut r = Rect { width: 3, height: 4 };
    r.grow(1);
    println!("{}", r.area());
}
