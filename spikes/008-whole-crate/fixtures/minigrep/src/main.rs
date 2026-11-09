use minigrep::{Config, run};

fn main() {
    let config = Config::parse(std::env::args().skip(1)).unwrap_or_else(|err| {
        eprintln!("Problem parsing arguments: {err}");
        std::process::exit(1);
    });
    let contents = String::from("Rust:\nsafe, fast, productive.\nPick three.");
    let lines = run(&config, &contents);
    for line in lines {
        println!("{line}");
    }
}
