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
    hint: string;
};

export const string_of_compiler_error = ({
    error_type,
    detailed_error_msg,
    from,
    to,
    hint,
}: CompilerError) =>
    `** (${error_type}Error) **
${detailed_error_msg} @ range (${from.toString()},${to.toString()})!
Hint: ${hint}`;
