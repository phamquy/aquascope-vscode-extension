use proc_macro::{TokenStream, TokenTree};

/// Derives `hello()` on a struct, with no dependency. Building it needs a linker, as every proc macro does
/// (feature 008, AC6).
#[proc_macro_derive(Hello)]
pub fn hello(input: TokenStream) -> TokenStream {
    let mut tokens = input.into_iter();
    let name = loop {
        match tokens.next() {
            Some(TokenTree::Ident(ident)) if ident.to_string() == "struct" => break tokens.next().expect("a struct name").to_string(),
            Some(_) => continue,
            None => panic!("Hello derives only for a struct"),
        }
    };
    format!("impl {name} {{ pub fn hello() -> &'static str {{ \"hello\" }} }}").parse().expect("valid tokens")
}
