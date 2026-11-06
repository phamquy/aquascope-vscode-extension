// Nested bodies: a function inside a function, and a closure.
fn outer() {
    fn inner(v: &mut Vec<i32>) {
        v.push(1);
    }
    let mut v = vec![];
    inner(&mut v);
    let f = |x: i32| x + v.len() as i32;
    f(1);
}
