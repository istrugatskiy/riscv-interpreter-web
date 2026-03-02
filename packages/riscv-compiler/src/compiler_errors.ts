export type CompilerError = {
    error_type:
        | 'UnboundMacro'
        | 'Parser'
        | 'UnexpectedArgumentCount'
        | 'UnexpectedArgument'
        | 'AmbiguousMacroExpr';
    detailed_error_msg: string;
    from: number;
    to: number;
    line: number;
    col: number;
    hint: string | undefined;
};

/**
 * coords_of_index(source, index) is the [line number, column number] of the index in the source string.
 */
export const coords_of_index = (source_string: string, index: number) => {
    const newline_indexed_source = source_string
        .substring(0, index)
        .split('\n');
    const line = newline_indexed_source.length;
    const col = newline_indexed_source.at(-1)?.length ?? 1;

    return [line, col + 1] as const;
};

export const string_of_compiler_error = ({
    detailed_error_msg,
    line,
    col,
    hint,
}: CompilerError) =>
    `${detailed_error_msg} at line ${line.toString()}, col ${col.toString()}` +
    (hint !== undefined ? `\nHint: ${hint}` : '');
