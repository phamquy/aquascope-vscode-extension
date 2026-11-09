use proc_macro::TokenStream;

/// A derive that adds nothing; building it needs a linker, as every proc macro does.
#[proc_macro_derive(Hello)]
pub fn hello(_input: TokenStream) -> TokenStream {
    TokenStream::new()
}
