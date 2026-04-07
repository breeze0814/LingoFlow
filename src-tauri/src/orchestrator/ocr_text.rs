const MAX_EMPTY_LINES: usize = 1;

pub fn normalize_ocr_text(text: &str) -> String {
    text.replace("\r\n", "\n")
        .replace('\r', "\n")
        .lines()
        .map(normalize_line)
        .collect::<Vec<String>>()
        .join("\n")
        .split('\n')
        .fold((Vec::new(), 0usize), |(mut lines, mut empty_run), line| {
            if line.is_empty() {
                empty_run += 1;
                if empty_run <= MAX_EMPTY_LINES {
                    lines.push(String::new());
                }
                return (lines, empty_run);
            }
            empty_run = 0;
            lines.push(line.to_string());
            (lines, empty_run)
        })
        .0
        .join("\n")
        .trim()
        .to_string()
}

fn normalize_line(line: &str) -> String {
    let collapsed = line
        .chars()
        .filter(|ch| !is_ignored_char(*ch))
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ");
    trim_edge_noise(&collapsed)
}

fn is_ignored_char(ch: char) -> bool {
    matches!(
        ch,
        '\u{0000}'..='\u{0008}'
            | '\u{000B}'
            | '\u{000C}'
            | '\u{000E}'..='\u{001F}'
            | '\u{007F}'
            | '\u{200B}'
            | '\u{200C}'
            | '\u{200D}'
            | '\u{2060}'
            | '\u{FEFF}'
    )
}

fn trim_edge_noise(line: &str) -> String {
    let mut current = line.trim().to_string();
    loop {
        let next = trim_once(&current);
        if next == current {
            return current;
        }
        current = next;
    }
}

fn trim_once(line: &str) -> String {
    let without_start = trim_start_noise(line);
    trim_end_noise(&without_start)
}

fn trim_start_noise(line: &str) -> String {
    let Some(first) = line.chars().next() else {
        return String::new();
    };
    let Some(last) = line.chars().next_back() else {
        return String::new();
    };
    if !should_strip_start(first, last) {
        return line.to_string();
    }
    line.chars()
        .skip(1)
        .collect::<String>()
        .trim_start()
        .to_string()
}

fn trim_end_noise(line: &str) -> String {
    let Some(first) = line.chars().next() else {
        return String::new();
    };
    let Some(last) = line.chars().next_back() else {
        return String::new();
    };
    if !should_strip_end(first, last) {
        return line.to_string();
    }
    let mut chars = line.chars();
    chars.next_back();
    chars.collect::<String>().trim_end().to_string()
}

fn should_strip_start(first: char, last: char) -> bool {
    if matching_closer(first).is_some_and(|expected| expected == last) {
        return false;
    }
    is_opening_noise(first) || is_closing_noise(first)
}

fn should_strip_end(first: char, last: char) -> bool {
    if matching_opener(last).is_some_and(|expected| expected == first) {
        return false;
    }
    is_opening_noise(last) || is_closing_noise(last)
}

fn matching_closer(ch: char) -> Option<char> {
    match ch {
        '"' => Some('"'),
        '\'' => Some('\''),
        '`' => Some('`'),
        '“' => Some('”'),
        '‘' => Some('’'),
        '«' => Some('»'),
        '‹' => Some('›'),
        '「' => Some('」'),
        '『' => Some('』'),
        '《' => Some('》'),
        '〈' => Some('〉'),
        '（' => Some('）'),
        '(' => Some(')'),
        '[' => Some(']'),
        '【' => Some('】'),
        '{' => Some('}'),
        _ => None,
    }
}

fn matching_opener(ch: char) -> Option<char> {
    match ch {
        '"' => Some('"'),
        '\'' => Some('\''),
        '`' => Some('`'),
        '”' => Some('“'),
        '’' => Some('‘'),
        '»' => Some('«'),
        '›' => Some('‹'),
        '」' => Some('「'),
        '』' => Some('『'),
        '》' => Some('《'),
        '〉' => Some('〈'),
        '）' => Some('（'),
        ')' => Some('('),
        ']' => Some('['),
        '】' => Some('【'),
        '}' => Some('{'),
        _ => None,
    }
}

fn is_opening_noise(ch: char) -> bool {
    matches!(
        ch,
        '"' | '\''
            | '`'
            | '“'
            | '‘'
            | '«'
            | '‹'
            | '「'
            | '『'
            | '《'
            | '〈'
            | '（'
            | '('
            | '['
            | '【'
            | '{'
            | '|'
            | '¦'
            | '•'
            | '·'
            | '●'
            | '▪'
            | '■'
            | '◆'
            | '※'
            | '*'
            | '#'
            | '='
            | '~'
            | '^'
    )
}

fn is_closing_noise(ch: char) -> bool {
    matches!(
        ch,
        '"' | '\''
            | '`'
            | '”'
            | '’'
            | '»'
            | '›'
            | '」'
            | '』'
            | '》'
            | '〉'
            | '）'
            | ')'
            | ']'
            | '】'
            | '}'
            | '|'
            | '¦'
            | '•'
            | '·'
            | '●'
            | '▪'
            | '■'
            | '◆'
            | '※'
            | '*'
            | '#'
            | '='
            | '~'
            | '^'
    )
}

#[cfg(test)]
mod tests {
    use super::normalize_ocr_text;

    #[test]
    fn trims_unbalanced_quotes_and_symbols() {
        assert_eq!(normalize_ocr_text("“Hello world"), "Hello world");
        assert_eq!(normalize_ocr_text("Hello world”"), "Hello world");
        assert_eq!(normalize_ocr_text("|『Hello world"), "Hello world");
    }

    #[test]
    fn keeps_balanced_wrappers() {
        assert_eq!(normalize_ocr_text("“Hello world”"), "“Hello world”");
        assert_eq!(normalize_ocr_text("【Hello world】"), "【Hello world】");
    }

    #[test]
    fn removes_invisible_chars_and_preserves_paragraphs() {
        assert_eq!(
            normalize_ocr_text("\u{200B}  Hello   world \n\n\n\u{FEFF}Line  2  "),
            "Hello world\n\nLine 2"
        );
    }
}
