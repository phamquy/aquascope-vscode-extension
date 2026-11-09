use ws_core::Inventory;

/// Uses the other member of the workspace (spec 008, AC3).
pub fn stock() -> usize {
    let mut inventory = Inventory::new();
    inventory.add("apple");
    let first = &inventory.items[0];
    let count = inventory.items.len();
    println!("{first}");
    count
}
