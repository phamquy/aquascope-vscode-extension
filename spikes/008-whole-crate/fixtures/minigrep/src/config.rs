use crate::Case;

pub struct Config {
    pub query: String,
    pub path: String,
    pub case: Case,
}

impl Config {
    /// Builds a configuration from the arguments after the program name (issue #31's function).
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
        let case = if args.any(|arg| arg == "-i") { Case::Insensitive } else { Case::Sensitive };
        Ok(Config { query, path, case })
    }

    pub fn describe(&self) -> String {
        let mut text = self.query.clone();
        text.push_str(" in ");
        text.push_str(&self.path);
        text
    }
}
