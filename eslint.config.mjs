// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        linterOptions: {
            reportUnusedDisableDirectives: 'off',
        },
        languageOptions: {
            parserOptions: {
                project: true,
                // @ts-expect-error
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        files: ['./packages/**/*.ts', './src/**/*.ts', './@types/**/*.ts'],

        extends: [
            eslint.configs.recommended,
            tseslint.configs.strictTypeChecked,
            tseslint.configs.stylisticTypeChecked,
            {
                rules: {
                    '@typescript-eslint/consistent-type-definitions': [
                        'error',
                        'type',
                    ],
                    '@typescript-eslint/naming-convention': [
                        'error',
                        {
                            selector: [
                                'variable',
                                'function',
                                'parameter',
                                'property',
                                'method',
                                'accessor',
                            ],
                            leadingUnderscore: 'allow',
                            format: ['snake_case'],
                        },
                        {
                            selector: [
                                'class',
                                'interface',
                                'typeAlias',
                                'enum',
                                'typeLike',
                                'typeParameter',
                            ],
                            format: ['PascalCase'],
                        },
                        {
                            selector: 'default',
                            format: ['StrictPascalCase'],
                        },
                    ],
                },
            },
        ],
    }
);
