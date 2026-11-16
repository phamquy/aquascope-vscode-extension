// A closure inside a closure: the closure given to `thread::scope` spawns a `move` closure. Aquascope's
// driver panicked in rustc's borrow checker on it and the whole file failed with exit code 101 (T-065).
pub fn parallel_sum_scoped(data: &[u64], n_threads: usize) -> u64 {
    if data.is_empty() {
        return 0;
    }

    let n_threads = n_threads.max(1);
    let chunk_size = (data.len() + n_threads - 1) / n_threads;
    let mut sum = 0;

    std::thread::scope(|s| {
        let mut handles = Vec::new();
        for chunk in data.chunks(chunk_size) {
            handles.push(s.spawn(move || chunk.iter().sum::<u64>()));
        }

        for handle in handles {
            sum += handle.join().unwrap();
        }
    });

    sum
}

fn main() {
    println!("{}", parallel_sum_scoped(&[1, 2, 3, 4, 5], 2));
}
