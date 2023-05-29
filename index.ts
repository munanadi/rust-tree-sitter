import Parser, {
  SyntaxNode,
  Query,
  QueryCapture,
  Tree,
} from "tree-sitter";
// @ts-ignore
import Rust from "tree-sitter-rust";
import {
  rustCode,
  simpleRustCode,
  rustFunc,
} from "./rustCode";
import * as fs from "fs";

// Create a new parser instance for Rust
const parser = new Parser();
parser.setLanguage(Rust);

// S Expressions to parse the rust code
const Expressions = {
  Macro: {
    expression: `(macro_invocation macro: (identifier)) @macroIdentifier`,
    name: "macroIdentifier",
  },
  Use: {
    expression: `((use_declaration argument: (use_wildcard) )) @use`,
    name: "use",
  },
  Let: {
    expression: `(let_declaration pattern: _ value: _) @letDeclaration`,
    name: "letDeclaration",
  },
  Assignment: {
    expression: `(assignment_expression left: _ right: _) @assignment`,
    name: "assignment",
  },
  Functions: {
    expression: `(function_item (visibility_modifier) name: (identifier) parameters: _ return_type: _ body: _) @functionBlock`,
    name: "functionBlock",
  },
  Attributes: {
    expression: `(attribute_item (meta_item (identifier) @attributeName arguments : _ @attributeArgs))@attributeItem`,
    name: "attributeItem",
  },
  Modules: {
    expression: `(mod_item name: _) @modItem`,
    name: "modItem",
  },
  Structs: {
    expression: `(struct_item name: _ body: _) @structItem`,
    name: "structItem",
  },
};

// Parse the rust code
const tree = parser.parse(rustFunc);
const rootNode = tree.rootNode;

// console.log(rootNode.toString());

fs.writeFileSync("./output.json", rootNode.toString());

function traverseAST(
  node: SyntaxNode,
  expression: { expression: string; name: string }
) {
  const attributeItems = new Query(
    Rust,
    expression.expression
  );
  const name = expression.name;

  const captures = attributeItems.captures(rootNode);
  const capturesFilterByName = captures.filter(
    (x: { name: string }) => x.name == name
  );

  const grouped = capturesFilterByName.map(
    (c: QueryCapture) => {
      const node = c.node;

      const result: any = {
        text: node.text,
        row: node.startPosition.row,
        column: node.startPosition.column,
      };

      return result;
    }
  );

  console.log(grouped);
}

traverseAST(rootNode, Expressions.Attributes);
