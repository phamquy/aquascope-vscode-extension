//! Binary search tree with Option<Box<Node>>.
//! Supports removal, height, and lazy depth-first traversal.
//! Stretch: generic over T: Ord.
#[derive(Debug, Default)]
pub struct Bst {
    root: Option<Box<Node>>,
}

#[derive(Debug)]
struct Node {
    key: i32,
    left: Option<Box<Node>>,
    right: Option<Box<Node>>,
}
pub enum TraversalOrder {
    PreOrder,
    InOrder,
    PostOrder,
}

pub struct BstIter<'a> {
    stack: Vec<(&'a Node, bool)>,
    order: TraversalOrder,
}

impl<'a> Iterator for BstIter<'a> {
    type Item = &'a i32;
    fn next(&mut self) -> Option<Self::Item> {
        while let Some((node, ready)) = self.stack.pop() {
            if ready {
                return Some(&node.key);
            }

            // The stack is LIFO, so push in the REVERSE of the visit order:
            // the last item pushed is the first one visited.
            // `false` = subtree not expanded yet, `true` = node itself, ready to yield.
            match self.order {
                // Visit order: root -> left -> right
                TraversalOrder::PreOrder => {
                    if let Some(right) = node.right.as_deref() {
                        self.stack.push((right, false)); // 3rd
                    }
                    if let Some(left) = node.left.as_deref() {
                        self.stack.push((left, false)); // 2nd
                    }
                    self.stack.push((node, true)); // 1st
                }
                // Visit order: left -> root -> right
                TraversalOrder::InOrder => {
                    if let Some(right) = node.right.as_deref() {
                        self.stack.push((right, false)); // 3rd
                    }
                    self.stack.push((node, true)); // 2nd
                    if let Some(left) = node.left.as_deref() {
                        self.stack.push((left, false)); // 1st
                    }
                }
                // Visit order: left -> right -> root
                TraversalOrder::PostOrder => {
                    self.stack.push((node, true)); // 3rd
                    if let Some(right) = node.right.as_deref() {
                        self.stack.push((right, false)); // 2nd
                    }
                    if let Some(left) = node.left.as_deref() {
                        self.stack.push((left, false)); // 1st
                    }
                }
            }
        }
        None
    }
}


impl Bst {
    pub fn new() -> Self { 
        Self { root: None }
    }

    /// Lazily yields borrowed keys in the selected depth-first order.
    ///
    /// Pre-order visits root/left/right, in-order left/root/right, and
    /// post-order left/right/root. Auxiliary storage is O(tree height).
    pub fn iter(&self, order: TraversalOrder) -> BstIter<'_> {
        let mut iter: BstIter<'_> = BstIter {
            stack: Vec::new(),
            order,
        };
        if let Some(root) = self.root.as_deref() {
            iter.stack.push((root, false));
        }
        iter
    }

    /// Returns false if the key was already present.
    pub fn insert(&mut self, key: i32) -> bool { 
        let mut root = &mut self.root;
        while let Some(node) = root {
            if key < node.key {
                root = &mut node.left;
            } else if key > node.key {
                root = &mut node.right;
            } else {
                return false;
            }
        }
        *root = Some(Box::new(Node {
            key,
            left: None,
            right: None,
        }));
        true
    }
    
    pub fn contains(&self, key: i32) -> bool { 
        let mut root = &self.root;
        while let Some(node) = root {
            if key < node.key {
                root = &node.left;
            } else if key > node.key {
                root = &node.right;
            } else {
                return true;
            }
        }
        false
    }
    pub fn pre_order(&self) -> Vec<i32> {
        let mut result = Vec::new();
        fn pre_order_rec(node: &Option<Box<Node>>, result: &mut Vec<i32>) {
            if let Some(n) = node {
                result.push(n.key);
                pre_order_rec(&n.left, result);
                pre_order_rec(&n.right, result);
            }
        }
        pre_order_rec(&self.root, &mut result);
        result
    }

    pub fn in_order(&self) -> Vec<i32> {
        let mut result = Vec::new();
        fn in_order_rec(node: &Option<Box<Node>>, result: &mut Vec<i32>) {
            if let Some(n) = node {
                in_order_rec(&n.left, result);
                result.push(n.key);
                in_order_rec(&n.right, result);
            }
        }
        in_order_rec(&self.root, &mut result);
        result
    }

    pub fn remove(&mut self, key: i32) -> bool {
        fn remove_rec(node: &mut Option<Box<Node>>, key: i32) -> bool {
            if let Some(n) = node {
                if key < n.key {
                    return remove_rec(&mut n.left, key);
                } else if key > n.key {
                    return remove_rec(&mut n.right, key);
                } else {
                   *node = match (n.left.take(), n.right.take()) {
                       (None, None) => None,
                       (Some(left), None) => Some(left),
                       (None, Some(right)) => Some(right),
                       (Some(left), Some(right)) => {
                           let mut min = right;
                           let mut min_ref = &mut min;
                           while let Some(ref mut l) = min_ref.left {
                               min_ref = l;
                           }
                           min_ref.left = Some(left);
                           Some(min)
                       }
                   };
                   return true;
                }
            }
            false
        }
        remove_rec(&mut self.root, key)
    }

    pub fn height(&self) -> i32 {
        fn height_rec(node: &Option<Box<Node>>) -> i32 {
            if let Some(n) = node {
                1 + std::cmp::max(height_rec(&n.left), height_rec(&n.right))
            } else {
                0
            }
        }
        height_rec(&self.root)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn insert_contains_order() {
        let mut t = Bst::new();
        for k in [5, 3, 8, 1, 4, 9] { assert!(t.insert(k)); }
        assert!(!t.insert(5));
        assert!(t.contains(4));
        assert!(!t.contains(7));
        assert_eq!(t.in_order(), vec![1, 3, 4, 5, 8, 9]);
    }

    #[test]
    fn iter_yields_keys_in_each_dfs_order() {
        let mut t = Bst::new();
        for key in [5, 3, 8, 1, 4, 7, 9, 6] {
            t.insert(key);
        }

        for (order, expected) in [
            (TraversalOrder::InOrder, vec![1, 3, 4, 5, 6, 7, 8, 9]),
            (TraversalOrder::PreOrder, vec![5, 3, 1, 4, 8, 7, 6, 9]),
            (TraversalOrder::PostOrder, vec![1, 4, 3, 6, 7, 9, 8, 5]),
        ] {
            let mut iter = t.iter(order);
            assert_eq!(iter.by_ref().copied().collect::<Vec<_>>(), expected);
            assert_eq!(iter.next(), None);
            assert_eq!(iter.next(), None);
        }
    }

    #[test]
    fn iter_handles_empty_single_node_and_skewed_trees() {
        for keys in [vec![], vec![5], vec![1, 2, 3, 4], vec![4, 3, 2, 1]] {
            let mut t = Bst::new();
            for &key in &keys {
                t.insert(key);
            }

            let mut sorted = keys.clone();
            sorted.sort();
            let reversed: Vec<_> = keys.iter().rev().copied().collect();
            for (order, expected) in [
                (TraversalOrder::InOrder, sorted),
                (TraversalOrder::PreOrder, keys),
                (TraversalOrder::PostOrder, reversed),
            ] {
                assert_eq!(t.iter(order).copied().collect::<Vec<_>>(), expected);
            }
        }
    }

    #[test]
    fn remove_leaf_and_node_with_one_child() {
        let mut t = Bst::new();
        for key in [5, 3, 8, 2] {
            t.insert(key);
        }

        assert!(t.remove(2));
        assert_eq!(t.in_order(), vec![3, 5, 8]);
        assert!(t.remove(3));
        assert_eq!(t.in_order(), vec![5, 8]);
        assert!(!t.remove(42));
        assert_eq!(t.in_order(), vec![5, 8]);
    }

    #[test]
    fn remove_node_with_two_children() {
        let mut t = Bst::new();
        for key in [5, 3, 8, 1, 4, 7, 9, 6] {
            t.insert(key);
        }

        assert!(t.remove(5));
        assert!(!t.contains(5));
        assert_eq!(t.in_order(), vec![1, 3, 4, 6, 7, 8, 9]);
    }

    #[test]
    fn height_is_zero_for_empty_tree_and_tracks_longest_path() {
        let mut t = Bst::new();
        assert_eq!(t.height(), 0);

        for key in [5, 3, 8, 1, 4] {
            t.insert(key);
        }
        assert_eq!(t.height(), 3);
    }
}
