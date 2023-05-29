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
  Macro: `(macro_invocation macro: (identifier)) @macroIdentifier`,
  Use: `((use_declaration argument: (use_wildcard) )) @use`,
  Let: `(let_declaration pattern: _ value: _) @letDeclaration`,
  Assignment: `(assignment_expression left: _ right: _) @assignment`,
  Functions: `(function_item (visibility_modifier) name: (identifier) parameters: _ return_type: _ body: _) @functionBlock`,
  Attributes: `(attribute_item (meta_item (identifier) @attributeName arguments : _ @attributeArgs))@attributeItem`,
  Modules: `(mod_item name: _) @modeItem`,
  Structs: `(struct_item name: _ body: _) @structItem`,
};

// Parse the rust code
const tree = parser.parse(rustFunc);
const rootNode = tree.rootNode;

// console.log(rootNode.toString());

fs.writeFileSync("./output.json", rootNode.toString());

function traverseAST(node: SyntaxNode, expression: string) {
  const attributeItems = new Query(Rust, expression);

  // const rep = attributeItems.captures(node);
  // for (let r of rep) {
  //   console.log(r.node.text);

  //   const attributeName =
  //     r["name"] === "attributeName" ? r.node.text : null;
  //   const attributeArgs =
  //     r["name"] === "attributeArgs" ? r.node.text : null;

  //   console.log({ attributeName, attributeArgs });

  //   // break;
  // }

  const ast = capturesByName(
    tree,
    attributeItems,
    "attributeItem"
  );
  console.log(ast);
}

traverseAST(rootNode, Expressions.Attributes);

// Get the captures corresponding to a capture name
function capturesByName(
  tree: Tree,
  query: Query,
  name: string
) {
  return formatCaptures(
    tree,
    query
      .captures(tree.rootNode)
      .filter((x: { name: string }) => x.name == name)
  ).map((x: any) => {
    delete x.name;
    return x;
  });
}

// Given a raw list of captures, extract the row, column and text.
function formatCaptures(
  tree: any,
  captures: QueryCapture[]
) {
  return captures.map((c: QueryCapture) => {
    const node = c.node;

    const result: any = {
      text: node.text,
      row: node.startPosition.row,
      column: node.startPosition.column,
    };

    return result;
  });
}
