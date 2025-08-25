/* eslint-disable @typescript-eslint/naming-convention */
import {
    LanguageSupport,
    LRLanguage,
    foldNodeProp,
    indentNodeProp,
    foldInside,
} from '@codemirror/language';
import { parser } from './riscv';
import { styleTags, tags } from '@lezer/highlight';

export const riscv_language = LRLanguage.define({
    name: 'riscv',
    parser: parser.configure({
        props: [
            styleTags({
                Comment: tags.lineComment,
                Register: tags.variableName,
                Immediate: tags.number,
                LabelName: tags.propertyName,
                MacroName: tags.macroName,
            }),
            indentNodeProp.add({
                Application: (context) =>
                    context.column(context.node.from) + context.unit,
            }),
            foldNodeProp.add({
                Application: foldInside,
            }),
        ],
    }),
    languageData: {
        commentTokens: { line: '#' },
    },
});

export const riscv = () => new LanguageSupport(riscv_language);
