pub struct LinkedStack<T> {
    head: Option<Box<Node<T>>>,
}

struct Node<T> {
    value: T,
    next: Option<Box<Node<T>>>,
}

impl<T> LinkedStack<T> {
    pub fn new() -> Self {
        Self { head: None }
    }

    pub fn push(&mut self, t: T) {
        let new_node = Box::new(Node {
            value: t,
            next: self.head.take(),
        });
        self.head = Some(new_node);
    }

    pub fn pop(&mut self) -> Option<T> {
        self.head.take().map(|node| {
            self.head = node.next;
            node.value
        })
    }

    pub fn peek(&self) -> Option<&T> {
        self.head.as_ref().map(|node| &node.value)
    }
}
