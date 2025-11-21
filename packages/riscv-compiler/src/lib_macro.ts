import { parser } from './ast/riscv';
import { SyntaxNode, Tree } from '@lezer/common';
import {
    children_of_node,
    get_node_text,
    label_table_from_tree,
    source_map_from_tree,
} from './ast/ast_utils';
import {
    ArgumentType,
    parse_arg,
    string_of_argument_type,
    ValidArgumentShapes,
} from './arguments';
import { type CompilerError } from './compiler_errors';

type ValidArgumentsOf<Arg extends ArgumentType[]> = {
    [Index in keyof Arg]: ValidArgumentShapes[Arg[Index]['name']];
};

export type DefMacroExpr = ReturnType<typeof def_macro>;

export const string_of_def_macro = ({
    name,
    arglist_type,
}: {
    name: string;
    arglist_type: ArgumentType[];
}) =>
    `${name}/${arglist_type.length.toString()} [${arglist_type.map(string_of_argument_type).join(', ')}]`;

/**
 * Note that multi-line macros (with several bytecode instructions) will set the pc
 * to the pc of the last instruction only. So if there was a beq followed by addi's,
 * the beq would be meaningless. If there were multiple adds, pc would only go up by 4.
 */
export const def_macro = <ArgumentList extends ArgumentType[]>(
    name: string,
    arglist_type: ArgumentList,
    expand: (args: ValidArgumentsOf<ArgumentList>) => Instruction[]
) => {
    return {
        name,
        arglist_type,
        try_expand: (
            macro_expr: SyntaxNode,
            source: string,
            argument_list: SyntaxNode[],
            label_context: Map<string, number>
        ): Instruction[] | CompilerError[] => {
            if (argument_list.length !== arglist_type.length) {
                const first_arg = argument_list.at(0);
                const last_arg = argument_list.at(-1);

                return [
                    {
                        error_type: 'UnexpectedArgumentCount',
                        detailed_error_msg: `${string_of_def_macro({ name, arglist_type })} expects ${arglist_type.length.toString()} arguments but got ${argument_list.length.toString()}`,
                        from:
                            first_arg !== undefined
                                ? first_arg.from
                                : macro_expr.to,
                        to:
                            last_arg !== undefined
                                ? last_arg.to
                                : macro_expr.to,
                        hint: `Make sure you have ${arglist_type.length.toString()} arguments.`,
                    },
                ];
            }
            const mapped_args = argument_list.map((argument, arg_type_idx) =>
                parse_arg({
                    // clearly non-null value...
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    type: arglist_type[arg_type_idx]!,
                    source,
                    argument,
                    label_context,
                    macro_expr: { name, arglist_type },
                })
            );

            if (
                mapped_args.every(
                    (arg) => typeof arg !== 'object' || !('error_type' in arg)
                )
            ) {
                return expand(mapped_args as ValidArgumentsOf<ArgumentList>);
            }

            return mapped_args.filter(
                (arg) => typeof arg === 'object' && 'error_type' in arg
            );
        },
    };
};

// Find similar macros using fuzzy searching:
// See: https://en.wikipedia.org/wiki/Levenshtein_distance#Iterative_with_two_matrix_rows
const str_distance = (s: string, t: string) => {
    const m = s.length,
        n = t.length;
    let v0: number[] = [],
        v1: number[] = [];

    for (let i = 0; i <= n; i++) {
        v0[i] = i;
    }

    for (let i = 0; i < m; i++) {
        v1[0] = i + 1;
        for (let j = 0; j < n; j++) {
            const deletion_cost = (v0[j + 1] ?? 0) + 1;
            const insertion_cost = (v1[j] ?? 0) + 1;
            const substition_cost =
                s[i] === t[j] ? (v0[j] ?? 0) : (v0[j] ?? 0) + 1;
            v1[j + 1] = Math.min(
                deletion_cost,
                insertion_cost,
                substition_cost
            );
        }

        const temp_v0 = v0;
        v0 = v1;
        v1 = temp_v0;
    }

    return v0[n] ?? 0;
};

export const expand_ast = (
    tree: Tree,
    source: string,
    macros: DefMacroExpr[]
): Program | CompilerError[] => {
    const source_map = source_map_from_tree(tree, source);
    const labels = label_table_from_tree(tree, source);
    const macro_expressions_with_source = tree.topNode
        .getChildren('Statement')
        .filter((statement) => statement.getChild('MacroExpr'))
        .map((statement, statement_id) => ({
            macro_expr: statement.getChild('MacroExpr'),
            ...source_map[statement_id],
        }))
        // Make sure that all of our macro expressions are valid.
        .filter(
            (
                instruction
            ): instruction is {
                macro_expr: SyntaxNode;
                string_rep: string;
                line_no: number;
            } => {
                if (
                    instruction.macro_expr !== null &&
                    instruction.string_rep !== undefined &&
                    instruction.line_no !== undefined
                ) {
                    return true;
                }
                throw new Error(
                    "Illegal compiler state: Instructions and source map don't match up. Alternatively, lezer's getChild call is not deterministic."
                );
            }
        );

    const node_val = get_node_text.bind(undefined, source);

    const instructions_with_errors = macro_expressions_with_source.map(
        ({ macro_expr, string_rep, line_no }): CompilerError[] | Program[0] => {
            const macro_name_node = macro_expr.getChild('MacroName');
            if (macro_name_node === null) {
                throw new Error('Macro expression has no macro name.');
            }
            const macro_name = node_val(macro_name_node);
            const arglist = macro_expr.getChild('ArgList');
            const macro_args =
                arglist !== null
                    ? children_of_node(arglist).filter(
                          // We need to filter out comment blocks since multiline comments can appear in arbitrary places.
                          (potential_comment) =>
                              potential_comment.type.name !== 'Comment'
                      )
                    : [];

            const correct_name_macros = macros.filter(
                ({ name }) => macro_name === name
            );

            if (correct_name_macros.length === 0) {
                const nearest_macros = macros
                    .toSorted(
                        (macro1, macro2) =>
                            str_distance(macro1.name, macro_name) -
                            str_distance(macro2.name, macro_name)
                    )
                    .slice(0, 3)
                    .map(string_of_def_macro)
                    .join('\n * ');
                return [
                    {
                        error_type: 'UnboundMacro',
                        detailed_error_msg: `No macro named ${macro_name}`,
                        from: macro_name_node.from,
                        to: macro_name_node.to,
                        hint: `Did you mean one of the following:\n * ${nearest_macros}`,
                    },
                ];
            }

            const correct_length_macros = correct_name_macros.filter(
                ({ arglist_type }) => arglist_type.length === macro_args.length
            );

            const expandable_macros = correct_length_macros.filter((macro) =>
                macro
                    .try_expand(macro_expr, source, macro_args, labels)
                    .every(
                        (maybe_inst): maybe_inst is Instruction =>
                            !('error_type' in maybe_inst)
                    )
            );

            if (expandable_macros.length > 1) {
                return [
                    {
                        error_type: 'AmbiguousMacroExpr',
                        detailed_error_msg: `${node_val(macro_expr)} can be interpreted multiple ways`,
                        from: macro_expr.from,
                        to: macro_expr.to,
                        hint: `This is likely a bug in the interpreter. The following macro definitions accept your expresion:\n${expandable_macros.map(string_of_def_macro).join('\n * ')}`,
                    },
                ];
            }

            const macro = expandable_macros[0];
            if (macro === undefined) {
                if (correct_length_macros.length > 0) {
                    return correct_length_macros[0]?.try_expand(
                        macro_expr,
                        source,
                        macro_args,
                        labels
                    ) as CompilerError[];
                }
                return correct_name_macros[0]?.try_expand(
                    macro_expr,
                    source,
                    macro_args,
                    labels
                ) as CompilerError[];
            }

            return {
                instructions: macro.try_expand(
                    macro_expr,
                    source,
                    macro_args,
                    labels
                ) as Instruction[],
                string_rep,
                line_no,
            };
        }
    );

    const errors = instructions_with_errors.filter((inst) =>
        Array.isArray(inst)
    );

    if (errors.length !== 0) return errors.flat();
    return instructions_with_errors as Program;
};

export const bytecode_of_string = (macros: DefMacroExpr[], code: string) => {
    code = code.trimEnd() + '\n';
    const tree = parser.parse(code);
    if (tree.length !== code.length) {
        throw new Error('Internal parsing error in Lezer.');
    }

    const parsing_errors: { from: number; to: number }[] = [];
    tree.iterate({
        enter: ({ from, to, type }) => {
            if (type.isError) {
                parsing_errors.push({ from, to });
            }
            // If the type is an error,
            // skip all children of the error so as to not duplicate messages.
            return !type.isError;
        },
    });

    if (parsing_errors.length) {
        // TODO: give more specific error ranges
        return parsing_errors.map(({ from, to }) => ({
            error_type: 'Parser',
            detailed_error_msg: 'Syntax Error',
            from,
            to,
            hint: 'Your code should look like the following: LabelDef ":" space* | MacroExpr | (LabelDef ":" space* MacroExpr)',
        })) as CompilerError[];
    }

    return expand_ast(tree, code, macros);
};
