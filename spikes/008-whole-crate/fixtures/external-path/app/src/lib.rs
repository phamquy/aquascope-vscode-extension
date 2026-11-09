use ext_shared::Note;

/// Uses a path dependency outside its own workspace (spec 008, D1).
pub fn first_note() -> String {
    let note = Note { text: String::from("remember") };
    let text = note.text;
    text
}
