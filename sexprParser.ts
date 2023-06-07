// Full credit to https://github.com/xaedes/online-sexpr-format
// from where I stole this code.

class SParser {
  _line: number;
  _stream: string;
  _col: number;
  _pos: number;
  constructor(stream: string) {
    this._line = this._col = this._pos = 0;
    this._stream = stream;
  }

  static not_whitespace_or_end = /^(\S|$)/;
  static space_quote_paren_escaped_or_end =
    /^(\s|\\|"|'|`|,|\(|\)|$)/;
  static string_or_escaped_or_end = /^(\\|"|$)/;
  static string_delimiters = /["]/;
  static quotes = /['`,]/;
  static quotesMap: Record<string, string> = {
    "'": "quote",
    "`": "quasiquote",
    ",": "unquote",
  };

  error(msg: any): any {
    let e = new Error("Syntax error: " + msg) as any;
    e.line = this._line + 1;
    e.col = this._col + 1;
    return e;
  }

  peek(): any {
    if (this._stream.length == this._pos) return "";
    return this._stream[this._pos];
  }

  consume(): string {
    if (this._stream.length == this._pos) return "";

    let c = this._stream[this._pos];
    this._pos += 1;

    if (c == "\r") {
      if (this.peek() == "\n") {
        this._pos += 1;
        c += "\n";
      }
      this._line++;
      this._col = 0;
    } else if (c == "\n") {
      this._line++;
      this._col = 0;
    } else {
      this._col++;
    }

    return c;
  }

  until(regex: RegExp) {
    let s = "";

    while (!regex.test(this.peek())) {
      s += this.consume();
    }

    return s;
  }

  string(): any {
    // consume "
    let delimiter = this.consume();

    let str = "";

    while (true) {
      str += this.until(SParser.string_or_escaped_or_end);
      let next = this.peek();

      if (next == "") {
        return this.error("Unterminated string literal");
      }

      if (next == delimiter) {
        this.consume();
        break;
      }

      if (next == "\\") {
        this.consume();
        next = this.peek();

        if (next == "r") {
          this.consume();
          str += "\r";
        } else if (next == "t") {
          this.consume();
          str += "\t";
        } else if (next == "n") {
          this.consume();
          str += "\n";
        } else if (next == "f") {
          this.consume();
          str += "\f";
        } else if (next == "b") {
          this.consume();
          str += "\b";
        } else {
          str += this.consume();
        }

        continue;
      }

      str += this.consume();
    }

    // wrap in object to make strings distinct from symbols
    return new String(str);
  }

  atom(): any {
    if (SParser.string_delimiters.test(this.peek())) {
      return this.string();
    }

    let atom: string = "";

    while (true) {
      atom += this.until(
        SParser.space_quote_paren_escaped_or_end
      );
      let next = this.peek();

      if (next == "\\") {
        this.consume();
        atom += this.consume();
        continue;
      }

      break;
    }

    return atom;
  }

  quoted(): any {
    let q = this.consume() as unknown as any;
    let quote: string = SParser.quotesMap[q];

    if (quote == "unquote" && this.peek() == "@") {
      this.consume();
      quote = "unquote-splicing";
      q = ",@";
    }

    // ignore whitespace
    this.until(SParser.not_whitespace_or_end);
    let quotedExpr: any = this.expr();

    if (quotedExpr instanceof Error) {
      return quotedExpr;
    }

    // nothing came after '
    if (quotedExpr === "") {
      return this.error(
        "Unexpected `" + this.peek() + "` after `" + q + "`"
      );
    }

    return [quote, quotedExpr];
  }

  expr(): any {
    // ignore whitespace
    this.until(SParser.not_whitespace_or_end);

    if (SParser.quotes.test(this.peek())) {
      return this.quoted();
    }

    let expr: any =
      this.peek() == "(" ? this.list() : this.atom();

    // ignore whitespace
    this.until(SParser.not_whitespace_or_end);

    return expr;
  }

  list() {
    if (this.peek() != "(") {
      return this.error(
        "Expected `(` - saw `" + this.peek() + "` instead."
      );
    }

    this.consume();

    let ls: string[] = [];
    let v = this.expr();

    if (v instanceof Error) {
      return v;
    }

    if (v !== "") {
      ls.push(v);

      while ((v = this.expr()) !== "") {
        if (v instanceof Error) return v;
        ls.push(v);
      }
    }

    if (this.peek() != ")") {
      return this.error(
        "Expected `)` - saw: `" + this.peek() + "`"
      );
    }

    // consume that closing paren
    this.consume();

    return ls;
  }
}

class SexpressionParser {
  constructor(stream: string) {
    let parser = new SParser(stream);
    let expression = parser.expr();

    if (expression instanceof Error) {
      return expression;
    }

    // if anything is left to parse, it's a syntax error
    if (parser.peek() != "") {
      return parser.error(
        "Superfluous characters after expression: `" +
          parser.peek() +
          "`"
      );
    }

    return expression;
  }
  static Parser = SParser;
  static SyntaxError = Error;
}

function indent_recurse_tree(
  tree: any,
  current_indent: string,
  indent: string
) {
  let endl = "\n";
  let result = "";
  if (Array.isArray(tree)) {
    result += current_indent + "(" + endl;
    let next_indent = current_indent + indent;
    for (let i = 0; i < tree.length; ++i) {
      result += indent_recurse_tree(
        tree[i],
        next_indent,
        indent
      );
    }
    result += current_indent + ")" + endl;
  } else if (typeof tree == "string") {
    // some atom or number
    result += current_indent + tree + endl;
  } else {
    // a string with "
    result += current_indent + '"' + tree + '"' + endl;
  }
  return result;
}
function indent_sexpr(sexpr: string, indent: string) {
  let tree = new SexpressionParser(sexpr);
  let result = indent_recurse_tree(tree, "", indent);
  return result;
}

/**
 * This function takes a string and returns a formatted S-expression
 * @param text text to format
 * @param indent number of spaces for indent
 * @returns the foramtted s-expressions
 */
export function indentSExpr(
  text: string,
  indent: number = 2
): string {
  let indentation = "";
  for (let i = 0; i < indent; ++i) indentation += " ";
  text = indent_sexpr(text, indentation);

  return text;
}

// Minify the tree

// function minify_recurse_tree(tree) {
//   let result = "";
//   if (Array.isArray(tree)) {
//     result += "(";
//     for (let i = 0; i < tree.length; ++i) {
//       if (i > 0) {
//         result += " ";
//       }
//       result += minify_recurse_tree(tree[i]);
//     }
//     result += ")";
//   } else if (typeof tree == "string") {
//     // some atom or number
//     result += tree;
//   } else {
//     // a string with "
//     result += '"' + tree + '"';
//   }
//   return result;
// }
// function minify_sexpr(sexpr) {
//   let tree = sexpressionParser(sexpr);
//   let result = minify_recurse_tree(tree);
//   return result;
// }
// function minify() {
//   let textarea = document.getElementById("text");
//   textarea.value = minify_sexpr(textarea.value);
//   localStorage.setItem(
//     "online_sexpr_format_last_text",
//     textarea.value
//   );
// }
