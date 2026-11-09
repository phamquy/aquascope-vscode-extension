pub struct Rect {
    width: u32,
    height: u32,
}

impl Rect {
    pub fn new(width: u32, height: u32) -> Rect {
        Rect { width, height }
    }

    pub fn area(&self) -> u32 {
        let area = self.width * self.height;
        area
    }
}
