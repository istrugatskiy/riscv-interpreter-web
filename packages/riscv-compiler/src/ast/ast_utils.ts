/**
 * Utilities for working with the RISC-V AST.
 */
import { SyntaxNode, Tree } from '@lezer/common';
import { parser } from './riscv';

/**
 * Takes a string containing RISC-V code and returns a string representation of the code's AST.
 */
export const string_of_ast = (code: string) => {
    // Return a string representation of the node.

    const traverse_tree = (node: SyntaxNode, indentation: number) => {
        const children = children_of_node(node);
        let string_rep = `${' '.repeat(indentation)}${node.type.name}(`;
        for (const child of children) {
            string_rep += `\n${traverse_tree(child, indentation + 2)},`;
        }

        if (children.length === 0) {
            string_rep += `"${code.slice(node.from, node.to)}")`;
        } else {
            string_rep = string_rep.slice(0, string_rep.length - 1);
            string_rep += `\n${' '.repeat(indentation)})`;
        }

        return string_rep;
    };

    const top_node = parser.parse(code).topNode;
    return traverse_tree(top_node, 0);
};

/**
 * Gets the children of a lezer syntax node.
 */
export const children_of_node = (node: SyntaxNode) => {
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
 * Gets the string value of a syntax node given the source code.
 */
export const get_node_text = (source: string, node: SyntaxNode | null) => {
    if (node === null) {
        throw new Error('get_node_text() failed because the node was null.');
    }
    return source.substring(node.from, node.to);
};

/**
 * Creates a source map array mapping instruction_idx => {line string representation, line_no}.
 */
export const source_map_from_tree = (tree: Tree, source: string) => {
    source =
        source.replaceAll('\r\n', '\n').replaceAll('\r', '\n').trim() + '\n';
    return (
        tree.topNode
            .getChildren('Statement')
            // Remove lines that are only labels.
            .filter((statement) => statement.getChild('MacroExpr'))
            // First chop off the start of the line, then up until the end of the line.
            .map((statement) => ({
                string_rep: source.substring(
                    source.substring(0, statement.from).lastIndexOf('\n') + 1
                ),
                line_no: source.substring(0, statement.from).split('\n').length,
            }))
            .map(({ string_rep, line_no }) => ({
                string_rep: string_rep
                    .slice(0, string_rep.indexOf('\n'))
                    .trim(),
                line_no,
            }))
    );
};

/**
 * Suppose we had a tree an array of pure MacroExpressions.
 * This function creates a mapping from each label name to a corresponding macro expression that should be executed after the label.
 */
export const label_table_from_tree = (tree: Tree, source: string) => {
    const statements = tree.topNode.getChildren('Statement');
    const relative_labels = new Map<IntRange<0, 10>, number[]>();
    const labels_with_id = statements
        .map(
            (statement, statement_id) =>
                [statement.getChild('LabelDef'), statement_id] as const
        )
        .filter(
            (statement_id): statement_id is [SyntaxNode, number] =>
                statement_id[0] !== null
        );

    const label_map = new Map<string, number>();
    let prev_labels = 0;
    for (const [label, label_id] of labels_with_id) {
        const label_name = source.substring(label.from, label.to);
        if (/^[0-9]$/.test(label_name)) {
            const label_num = (label_name.charCodeAt(0) -
                '0'.charCodeAt(0)) as IntRange<0, 10>;
            if (!relative_labels.has(label_num)) {
                relative_labels.set(label_num, []);
            }
            relative_labels.get(label_num)?.push(label_id - prev_labels);
        } else {
            if (!label_map.has(label_name)) {
                label_map.set(label_name, label_id - prev_labels);
            }
        }

        // The label might be inline and therefore not affect prev_labels.
        if (!statements.at(label_id)?.getChild('MacroExpr')) {
            prev_labels++;
        }
    }

    return [label_map, relative_labels] as const;
};
