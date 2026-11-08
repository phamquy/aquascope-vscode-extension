// Undefined behaviour: reading through a pointer after its Box is dropped.
fn main() {
    let b = Box::new(5);
    let p: *const i32 = &*b;
    drop(b);
    let x = unsafe { *p };
    println!("{x}");
}
