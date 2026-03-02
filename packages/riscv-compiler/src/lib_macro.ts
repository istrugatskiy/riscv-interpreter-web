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
import { coords_of_index, type CompilerError } from './compiler_errors';
import { str_distance } from './string_distance';

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
) =>
    ({
        name,
        arglist_type,
        expand,
        // One of these casts is a subset of the other, therefore the cast "makes sense" and the types do sufficiently overlap.
    }) as unknown as {
        name: string;
        arglist_type: ArgumentType[];
        expand: (
            args: ValidArgumentShapes[keyof ValidArgumentShapes]
        ) => Instruction[];
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

    // Expanding the AST works in stages to allow good error messages:
    // 1) Find all macros that have the same name (like addi)
    // 2) Find all macros with the correct number of arguments (like addi/3)
    // 3) Finally ensure that the arguments match up the right types and expand (like addi/3 [register, register, immediate])
    // 4) Make sure there is no ambiguity and finally expand the macro.
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

                const [line, col] = coords_of_index(
                    source,
                    macro_name_node.from
                );
                return [
                    {
                        error_type: 'UnboundMacro',
                        detailed_error_msg: `No macro named ${macro_name}`,
                        from: macro_name_node.from,
                        to: macro_name_node.to,
                        line,
                        col,
                        hint: `Did you mean one of the following?\n * ${nearest_macros}`,
                    },
                ];
            }

            const correct_length_macros = correct_name_macros.filter(
                ({ arglist_type }) => arglist_type.length === macro_args.length
            );

            if (correct_length_macros.length === 0) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const expected_macro = correct_name_macros[0]!;
                const expected_length = expected_macro.arglist_type.length;

                const first_arg = macro_args.at(0);
                const last_arg = macro_args.at(-1);

                const from_idx =
                    first_arg !== undefined ? first_arg.from : macro_expr.to;

                const to_idx =
                    last_arg !== undefined ? last_arg.to : macro_expr.to;

                const [line, col] = coords_of_index(source, from_idx);

                return [
                    {
                        error_type: 'UnexpectedArgumentCount',
                        detailed_error_msg: `${string_of_def_macro(expected_macro)} expects ${expected_length.toString()} arguments but got ${macro_args.length.toString()}`,
                        from: from_idx,
                        to: to_idx,
                        line,
                        col,
                        hint: undefined,
                    },
                ];
            }

            // Store a list of [def_macro_block, expansion]
            const macro_expansions = correct_length_macros.map(
                (
                    macro_expr,
                    macro_idx
                ): [DefMacroExpr, Instruction[] | CompilerError[]] => {
                    const mapped_args = macro_args.map(
                        (argument, arg_type_idx) =>
                            parse_arg({
                                // clearly non-null value...
                                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                type: macro_expr.arglist_type[arg_type_idx]!,
                                source,
                                argument,
                                label_context: labels,
                                macro_expr,
                                macro_idx,
                            })
                    );

                    if (
                        mapped_args.every(
                            (arg) =>
                                typeof arg !== 'object' ||
                                !('error_type' in arg)
                        )
                    ) {
                        return [
                            macro_expr,
                            macro_expr.expand(
                                mapped_args as ValidArgumentShapes[keyof ValidArgumentShapes]
                            ),
                        ] as const;
                    }

                    return [
                        macro_expr,
                        mapped_args.filter(
                            (arg) =>
                                typeof arg === 'object' && 'error_type' in arg
                        ),
                    ] as const;
                }
            );

            const correct_type_macros = macro_expansions.filter(
                ([, expansion]) =>
                    expansion.every(
                        (maybe_inst): maybe_inst is Instruction =>
                            !('error_type' in maybe_inst)
                    )
            );

            if (correct_type_macros.length > 1) {
                const [line, col] = coords_of_index(source, macro_expr.from);
                return [
                    {
                        error_type: 'AmbiguousMacroExpr',
                        detailed_error_msg: `${node_val(macro_expr)} can be interpreted multiple ways`,
                        from: macro_expr.from,
                        to: macro_expr.to,
                        line,
                        col,
                        hint: `This is likely a bug in the interpreter. The following macro definitions accept your expression:\n${correct_type_macros.map(([macro_definition]) => string_of_def_macro(macro_definition)).join('\n * ')}`,
                    },
                ];
            }

            const macro = correct_type_macros[0];
            if (macro === undefined) {
                // We know macro_expansions[0] is not undefined since correct_length_macros.length > 0.
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const [, error_messages] = macro_expansions[0]!;
                return error_messages as CompilerError[];
            }

            return {
                instructions: macro[1] as Instruction[],
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

export const bytecode_of_string = (
    macros: DefMacroExpr[],
    code: string
): Program | CompilerError[] => {
    const tree = parser.parse(code);
    if (tree.length !== code.length) {
        throw new Error('Internal parsing error in Lezer.');
    }

    const parsing_errors: { from: number; to: number; bad_node: string }[] = [];
    tree.iterate({
        enter: (node) => {
            const { from, to, type } = node;
            if (type.isError) {
                parsing_errors.push({
                    from,
                    to,
                    bad_node: code.substring(from, to),
                });
            }
            // If the type is an error,
            // skip all children of the error so as to not duplicate messages.
            return !type.isError;
        },
    });

    if (parsing_errors.length) {
        return parsing_errors.map(({ from, to, bad_node }): CompilerError => {
            const [line, col] = coords_of_index(code, from);
            return {
                error_type: 'Parser',
                detailed_error_msg: `Unexpected token "${bad_node}"`,
                from,
                to,
                line,
                col,
                hint: undefined,
            };
        });
    }

    return expand_ast(tree, code, macros);
};

export const collect_warnings = (macros: DefMacroExpr[], code: string) => {
    if (code.at(-1) !== '\n') {
        return [
            {
                from: code.length,
                to: code.length,
                severity: 'warning',
                message: `** (NoNewlineWarning) **
File does not end with a newline @ range (${code.length.toString()},${code.length.toString()})!
Hint: Add a newline at the end of your RISC-V file (the compiler does this automatically)`,
            },
        ] as const;
    }

    return [];
};
