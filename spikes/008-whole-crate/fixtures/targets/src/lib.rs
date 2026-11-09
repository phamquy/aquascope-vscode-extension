pub fn double(v: Vec<i32>) -> Vec<i32> {
    let mut out = v;
    for x in out.iter_mut() {
        *x *= 2;
    }
    out
}

#[cfg(test)]
mod tests {
    fn only_in_tests() -> String {
        let s = String::from("test");
        s
    }

    #[test]
    fn doubles() {
        assert_eq!(super::double(vec![1]), vec![2]);
        assert_eq!(only_in_tests(), "test");
    }
}
