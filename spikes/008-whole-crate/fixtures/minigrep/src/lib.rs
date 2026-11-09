//! The Rust Book's minigrep, split into modules (spec 008, AC1).
pub mod config;

pub use config::Config;

/// Whether matching ignores case.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Case {
    Sensitive,
    Insensitive,
}

pub fn search<'a>(query: &str, contents: &'a str) -> Vec<&'a str> {
    contents.lines().filter(|line| line.contains(query)).collect()
}

pub fn search_case_insensitive<'a>(query: &str, contents: &'a str) -> Vec<&'a str> {
    let query = query.to_lowercase();
    contents.lines().filter(|line| line.to_lowercase().contains(&query)).collect()
}

pub fn run(config: &Config, contents: &str) -> Vec<String> {
    let found = match config.case {
        Case::Sensitive => search(&config.query, contents),
        Case::Insensitive => search_case_insensitive(&config.query, contents),
    };
    found.into_iter().map(String::from).collect()
}
