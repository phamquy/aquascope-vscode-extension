//! A second binary, under src/bin, run with the library as one crate.
fn main() {
    let loud = two_bins::shout("psst");
    let quiet = loud.to_lowercase();
    println!("{quiet}");
}
