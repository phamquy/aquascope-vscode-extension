//! A binary whose own modules name each other through `crate::`, which the one-crate build changes.
mod cli;
mod helpers;

fn main() {
    let n = cli::parse(" 21 ");
    let d = bin_crate_paths::double(n);
    println!("{d}");
}
