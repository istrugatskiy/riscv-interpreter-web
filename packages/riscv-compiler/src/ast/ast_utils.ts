import { SyntaxNode, Tree } from '@lezer/common';

/**
 * Get the children of a lezer syntax node.
 */
export const children_of = (node: SyntaxNode) => {
    const cur = node.cursor();
    const children: SyntaxNode[] = [];

    if (cur.firstChild()) {
        children.push(cur.node);
        while (cur.nextSibling()) {
            children.push(cur.node);
        }
    }

    return children;
};

/**
 * Construct a source map out of a lezer tree and the original source code.
 * This tool in effect creates a mapping, instruction_index+
 */
export const make_source_map = (tree: Tree) => {};

export const label_table_from_tree = (tree: Tree) => {};
