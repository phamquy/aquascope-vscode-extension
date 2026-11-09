fn main() {
    let message = String::from("build script");
    println!("cargo:rerun-if-changed=build.rs");
    drop(message);
}
