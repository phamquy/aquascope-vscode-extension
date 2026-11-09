pub struct Inventory {
    pub items: Vec<String>,
}

impl Inventory {
    pub fn new() -> Self {
        Inventory { items: Vec::new() }
    }

    pub fn add(&mut self, item: &str) {
        self.items.push(item.to_string());
    }
}
