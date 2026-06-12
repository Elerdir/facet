//! Pure detection/decoding helpers for binary files and text encodings.
//! Kept free of filesystem access so they are straightforward to unit-test.

use encoding_rs::Encoding;

/// Heuristic: a NUL byte in the sample means the content is binary. This is the
/// same cheap test editors and `git` use and is reliable in practice.
pub fn is_binary(sample: &[u8]) -> bool {
    sample.contains(&0)
}

/// Guess the encoding of a (possibly partial) byte sample.
pub fn detect_encoding(sample: &[u8]) -> &'static Encoding {
    let mut detector = chardetng::EncodingDetector::new();
    detector.feed(sample, true);
    detector.guess(None, true)
}

/// Human-readable encoding name for a sample (BOM and UTF-8 take priority).
pub fn encoding_name(sample: &[u8]) -> String {
    if let Some((encoding, _)) = Encoding::for_bom(sample) {
        return encoding.name().to_string();
    }
    if std::str::from_utf8(sample).is_ok() {
        return "UTF-8".to_string();
    }
    detect_encoding(sample).name().to_string()
}

/// Decode bytes to a String, returning the encoding actually used.
///
/// Priority: BOM → valid UTF-8 (fast path) → detected legacy encoding. Decoding
/// is lossy for invalid sequences rather than failing.
pub fn decode(bytes: &[u8]) -> (String, String) {
    if let Some((encoding, _)) = Encoding::for_bom(bytes) {
        let (text, _, _) = encoding.decode(bytes);
        return (text.into_owned(), encoding.name().to_string());
    }
    if let Ok(text) = std::str::from_utf8(bytes) {
        return (text.to_owned(), "UTF-8".to_string());
    }
    let encoding = detect_encoding(bytes);
    let (text, actual, _) = encoding.decode(bytes);
    (text.into_owned(), actual.name().to_string())
}

/// Encode text into the requested encoding for saving. UTF-16 variants are
/// hand-rolled (encoding_rs only decodes UTF-16); legacy encodings go through
/// encoding_rs by label (windows-1250, iso-8859-2, …).
pub fn encode_text(contents: &str, encoding: &str) -> Result<Vec<u8>, String> {
    match encoding.to_ascii_lowercase().as_str() {
        "utf-8" => Ok(contents.as_bytes().to_vec()),
        "utf-8-bom" => {
            let mut out = vec![0xEF, 0xBB, 0xBF];
            out.extend_from_slice(contents.as_bytes());
            Ok(out)
        }
        "utf-16le" => {
            let mut out = vec![0xFF, 0xFE];
            for unit in contents.encode_utf16() {
                out.extend_from_slice(&unit.to_le_bytes());
            }
            Ok(out)
        }
        "utf-16be" => {
            let mut out = vec![0xFE, 0xFF];
            for unit in contents.encode_utf16() {
                out.extend_from_slice(&unit.to_be_bytes());
            }
            Ok(out)
        }
        other => {
            let enc = Encoding::for_label(other.as_bytes())
                .ok_or_else(|| format!("Neznámé kódování: {other}"))?;
            let (bytes, _, had_errors) = enc.encode(contents);
            if had_errors {
                return Err(format!(
                    "Text obsahuje znaky, které nelze uložit v kódování {other}."
                ));
            }
            Ok(bytes.into_owned())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_utf16le_roundtrip() {
        let bytes = encode_text("Příliš žluťoučký", "utf-16le").unwrap();
        let (text, name) = decode(&bytes);
        assert_eq!(text, "Příliš žluťoučký");
        assert_eq!(name, "UTF-16LE");
    }

    #[test]
    fn encodes_utf8_bom() {
        let bytes = encode_text("ahoj", "utf-8-bom").unwrap();
        assert_eq!(&bytes[..3], &[0xEF, 0xBB, 0xBF]);
        assert_eq!(&bytes[3..], "ahoj".as_bytes());
    }

    #[test]
    fn encodes_windows_1250_and_rejects_unrepresentable() {
        let ok = encode_text("Žluťoučký kůň", "windows-1250").unwrap();
        assert!(!ok.is_empty());
        assert!(encode_text("日本語", "windows-1250").is_err());
        assert!(encode_text("x", "no-such-encoding").is_err());
    }

    #[test]
    fn detects_binary_via_null_byte() {
        assert!(is_binary(b"ab\0cd"));
        assert!(!is_binary(b"hello world"));
        assert!(!is_binary("příliš".as_bytes()));
    }

    #[test]
    fn decodes_valid_utf8_through_fast_path() {
        let (text, name) = decode("příliš žluťoučký kůň".as_bytes());
        assert_eq!(text, "příliš žluťoučký kůň");
        assert_eq!(name, "UTF-8");
    }

    #[test]
    fn decodes_utf16le_with_bom() {
        let bytes = [0xFF, 0xFE, b'H', 0x00, b'i', 0x00];
        let (text, name) = decode(&bytes);
        assert_eq!(text, "Hi");
        assert_eq!(name, "UTF-16LE");
    }

    #[test]
    fn decodes_non_utf8_without_failing() {
        // 0xE8 is 'č' in Windows-1250 and invalid as standalone UTF-8; decoding
        // must fall back to a legacy encoding rather than error.
        let (text, _name) = decode(&[0xE8]);
        assert!(!text.is_empty());
    }
}
