/** Templates for the "new file" picker, grouped by language with variants. */

export interface NewFileTemplate {
  id: string;
  language: string;
  name: string;
  extension: string;
  content: string;
  builtin: boolean;
}

const t = (
  id: string,
  language: string,
  name: string,
  extension: string,
  content: string,
): NewFileTemplate => ({ id, language, name, extension, content, builtin: true });

export const BUILTIN_TEMPLATES: NewFileTemplate[] = [
  // Java
  t(
    "java-class",
    "Java",
    "Třída",
    "java",
    "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}\n",
  ),
  t(
    "java-interface",
    "Java",
    "Rozhraní",
    "java",
    "public interface MyInterface {\n    void doSomething();\n}\n",
  ),
  t(
    "java-record",
    "Java",
    "Record",
    "java",
    "public record MyRecord(String name, int value) {\n}\n",
  ),
  t(
    "java-enum",
    "Java",
    "Enum",
    "java",
    "public enum MyEnum {\n    FIRST,\n    SECOND,\n    THIRD\n}\n",
  ),
  // C#
  t(
    "csharp-class",
    "C#",
    "Třída",
    "cs",
    "namespace App;\n\npublic class MyClass\n{\n    public void DoSomething()\n    {\n    }\n}\n",
  ),
  t(
    "csharp-interface",
    "C#",
    "Rozhraní",
    "cs",
    "namespace App;\n\npublic interface IMyInterface\n{\n    void DoSomething();\n}\n",
  ),
  t(
    "csharp-record",
    "C#",
    "Record",
    "cs",
    "namespace App;\n\npublic record MyRecord(string Name, int Value);\n",
  ),
  t(
    "csharp-enum",
    "C#",
    "Enum",
    "cs",
    "namespace App;\n\npublic enum MyEnum\n{\n    First,\n    Second,\n    Third,\n}\n",
  ),
  // Python
  t(
    "python-script",
    "Python",
    "Skript",
    "py",
    'def main() -> None:\n    print("Hello, World!")\n\n\nif __name__ == "__main__":\n    main()\n',
  ),
  t(
    "python-class",
    "Python",
    "Třída",
    "py",
    'class MyClass:\n    def __init__(self, name: str) -> None:\n        self.name = name\n\n    def greet(self) -> str:\n        return f"Hello, {self.name}!"\n',
  ),
  // PHP
  t("php-script", "PHP", "Skript", "php", '<?php\n\ndeclare(strict_types=1);\n\necho "Hello, World!";\n'),
  t(
    "php-class",
    "PHP",
    "Třída",
    "php",
    "<?php\n\ndeclare(strict_types=1);\n\nclass MyClass\n{\n    public function __construct(\n        private readonly string $name,\n    ) {\n    }\n}\n",
  ),
  // HTML / CSS
  t(
    "html-page",
    "HTML",
    "Stránka",
    "html",
    '<!doctype html>\n<html lang="cs">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Dokument</title>\n  </head>\n  <body>\n    \n  </body>\n</html>\n',
  ),
  t(
    "css-stylesheet",
    "CSS",
    "Stylesheet",
    "css",
    ":root {\n  --accent: #4aa3ff;\n}\n\nbody {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n}\n",
  ),
  // TypeScript
  t(
    "ts-module",
    "TypeScript",
    "Modul",
    "ts",
    'export function main(): void {\n  console.log("Hello, World!");\n}\n\nmain();\n',
  ),
  t(
    "ts-class",
    "TypeScript",
    "Třída",
    "ts",
    "export class MyClass {\n  constructor(private readonly name: string) {}\n\n  greet(): string {\n    return `Hello, ${this.name}!`;\n  }\n}\n",
  ),
  t(
    "ts-interface",
    "TypeScript",
    "Rozhraní",
    "ts",
    "export interface MyInterface {\n  name: string;\n  doSomething(): void;\n}\n",
  ),
  // Rust
  t("rust-main", "Rust", "Program", "rs", 'fn main() {\n    println!("Hello, World!");\n}\n'),
  t(
    "rust-struct",
    "Rust",
    "Struktura",
    "rs",
    "pub struct MyStruct {\n    name: String,\n}\n\nimpl MyStruct {\n    pub fn new(name: impl Into<String>) -> Self {\n        Self { name: name.into() }\n    }\n}\n",
  ),
  t(
    "rust-trait",
    "Rust",
    "Trait",
    "rs",
    "pub trait MyTrait {\n    fn do_something(&self);\n}\n",
  ),
  // JSON
  t("json-object", "JSON", "Objekt", "json", '{\n  "name": ""\n}\n'),
];

export interface CustomTemplate {
  name: string;
  extension: string;
  content: string;
}

/** Built-ins plus user-defined templates (from settings). */
export function allTemplates(custom: CustomTemplate[]): NewFileTemplate[] {
  return [
    ...BUILTIN_TEMPLATES,
    ...custom.map((c, i) => ({
      id: `custom-${i}`,
      language: "Vlastní",
      name: c.name,
      extension: c.extension,
      content: c.content,
      builtin: false,
    })),
  ];
}

/** Unique languages in display order (for grouping in the settings UI). */
export function templateLanguages(templates: NewFileTemplate[]): string[] {
  const seen: string[] = [];
  for (const tpl of templates) {
    if (!seen.includes(tpl.language)) seen.push(tpl.language);
  }
  return seen;
}
