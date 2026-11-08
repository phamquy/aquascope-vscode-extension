pub struct Config {
    pub query: String,
    pub path: String,
    pub ignore_case: bool,
}

impl Config {
    /// Build from args (excluding program name). Return Err with a usage message on bad input.
    pub fn parse(args: impl Iterator<Item = String>) -> Result<Config, String> {
        let mut args = args.peekable();
        let query = match args.next() {
            Some(arg) => arg,
            None => return Err("Missing query".into()),
        };
        let path = match args.next() {
            Some(arg) => arg,
            None => return Err("Missing path".into()),
        };
        let ignore_case = args.any(|arg| arg == "-i");

        Ok(Config { query, path, ignore_case })
    }
}

pub fn search<'a>(query: &str, contents: &'a str) -> Vec<&'a str> {
    contents.lines().filter(|line| line.contains(query)).collect()
}

pub fn search_case_insensitive<'a>(query: &str, contents: &'a str) -> Vec<&'a str> {
    contents.lines().filter(|line| line.to_lowercase().contains(&query.to_lowercase())).collect()
}
