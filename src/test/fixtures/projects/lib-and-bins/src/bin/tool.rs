mod util {
    pub fn triple(n: u32) -> u32 {
        n * 3
    }
}

fn main() {
    let n = crate::util::triple(2);
    println!("{n}");
}
