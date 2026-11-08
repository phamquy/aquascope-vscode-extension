// Never ends.
fn main() {
    let mut n: u64 = 0;
    loop {
        n = n.wrapping_add(1);
    }
}
