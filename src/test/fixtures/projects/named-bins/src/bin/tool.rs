fn push_twice(v: &mut Vec<i32>, n: i32) {
    v.push(n);
    v.push(n);
}

fn main() {
    let mut v = Vec::new();
    push_twice(&mut v, 1);
    println!("{v:?}");
}
