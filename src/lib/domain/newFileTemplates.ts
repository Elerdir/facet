/** Templates for the "new file" picker: name, extension and starter content. */

export interface NewFileTemplate {
  id: string;
  name: string;
  extension: string;
  content: string;
  builtin: boolean;
}

const t = (id: string, name: string, extension: string, content: string): NewFileTemplate => ({
  id,
  name,
  extension,
  content,
  builtin: true,
});

export const BUILTIN_TEMPLATES: NewFileTemplate[] = [
  t(
    "java",
    "Java",
    "java",
    'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
  ),
  t(
    "csharp",
    "C#",
    "cs",
    'namespace App;\n\npublic static class Program\n{\n    public static void Main(string[] args)\n    {\n        Console.WriteLine("Hello, World!");\n    }\n}\n',
  ),
  t(
    "python",
    "Python",
    "py",
    'def main() -> None:\n    print("Hello, World!")\n\n\nif __name__ == "__main__":\n    main()\n',
  ),
  t("php", "PHP", "php", '<?php\n\ndeclare(strict_types=1);\n\necho "Hello, World!";\n'),
  t(
    "html",
    "HTML",
    "html",
    '<!doctype html>\n<html lang="cs">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Dokument</title>\n  </head>\n  <body>\n    \n  </body>\n</html>\n',
  ),
  t(
    "css",
    "CSS",
    "css",
    ":root {\n  --accent: #4aa3ff;\n}\n\nbody {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n}\n",
  ),
  t(
    "typescript",
    "TypeScript",
    "ts",
    'export function main(): void {\n  console.log("Hello, World!");\n}\n\nmain();\n',
  ),
  t("rust", "Rust", "rs", 'fn main() {\n    println!("Hello, World!");\n}\n'),
  t("json", "JSON", "json", '{\n  "name": ""\n}\n'),
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
      name: c.name,
      extension: c.extension,
      content: c.content,
      builtin: false,
    })),
  ];
}
