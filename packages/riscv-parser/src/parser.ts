import { InterpreterError } from './lib_macro';

export type MacroExpr = {
    name: string;
    args: string[];
    // The representation of the original line (including comments, its original spacing, etc.)
    string_rep: string;
    // The source code line from which this macro was derived.
    code_line: number;
};
export type RiscvIR = {
    labels: Map<string, number>;
    code_lines: MacroExpr[];
};

// Thrown when a line does not contain one valid statement.
// A valid line is defined as follows:
// named_literal = a-z, A-Z, ., 0-9, _, +,- (note no commas in named_literals, can't start with digit)
// argument = [preceeding_spaces][named_literal symbols as well as open and close parens no spaces in the middle, may start with digit][ending_spaces]
// label = named_literal:
// macro_expr = named_literal[at least one space][zero or more arguments separated by commas]
// valid_line = [preceeding_spaces][label | macro_expr | or nothing][ending_spaces][optional comment (hashtag followed by arbitrary characters)][newline]

export const parse_file = (source: string): RiscvIR | InterpreterError[] => {
    const remove_comment = (line: string) => {
        const [code] = line.split('#');
        return code ?? '';
    };
    // Classic well designed and easy to use text systems :)))))
    const lines = source
        .split(/\r\n|\r|\n/g)
        .map((line, line_no) => ({
            string_rep: line.trim(),
            code_line: line_no + 1,
            normalized: remove_comment(line).trim().replaceAll(/ [ ]*/g, ' '),
        }))
        .filter(({ normalized }) => normalized)
        .map((line, idx) => ({ ...line, effective_line_no: idx + 1 }));
    const label_pred = ({ normalized }: { normalized: string }) =>
        /^[a-zA-Z0-9_.]+:$/.test(normalized) &&
        !((normalized.at(0) ?? '0') >= '0' && (normalized.at(0) ?? '0') <= '9');
    const instr_pred = ({ normalized }: { normalized: string }) =>
        // Sus half GPT regex...
        /^[a-zA-Z_][a-zA-Z0-9_.]*(\s+((\s*[0-9a-zA-Z_.()+\s-]+\s*)(,\s*[0-9a-zA-Z_.()+\s-]+\s*)*)?)?$/.test(
            normalized
        );
    const invalid_lines = lines.filter(
        (line) => !label_pred(line) && !instr_pred(line)
    );
    if (invalid_lines.length) {
        return invalid_lines.map(({ normalized, string_rep, code_line }) => ({
            error_type: 'Parser',
            detailed_error_msg: `"${string_rep}" does not satisfy LabelDef | MacroExpr`,
            line: code_line,
            hint: `Here is how your statement was normalized by the interpreter:\n${normalized}`,
        }));
    }
    let prev_lines = 0;
    const labels = lines
        .filter(label_pred)
        .reduce((map, { normalized, effective_line_no }) => {
            prev_lines++;
            return map.set(
                normalized.substring(0, normalized.length - 1),
                effective_line_no - prev_lines + 1
            );
        }, new Map<string, number>());
    const instructions = lines
        .filter((line) => !label_pred(line))
        .map(({ normalized, string_rep, code_line }) => {
            const [name, ...rest] = normalized.split(' ');
            if (!name)
                throw new Error(`** (InternalError) **
Illegal parser state on expression: ${string_rep}
Normalized as: ${normalized}`);

            const args =
                rest.length == 0
                    ? []
                    : rest
                          .join(' ')
                          .split(',')
                          .map((arg) => arg.trim());
            return { name, args, string_rep, code_line };
        });
    return {
        labels,
        code_lines: instructions,
    };
};

export const string_of_macro = ({
    name,
    args,
    string_rep,
    code_line,
}: MacroExpr) =>
    `${name}/${args.length.toString()} [${args.join(
        ', '
    )}] from ${string_rep} @@ line ${code_line.toString()}`;
