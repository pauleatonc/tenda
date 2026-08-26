import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: './schema.graphql',
  documents: './src/**/*.graphql',
  generates: {
    './src/generated/graphql.ts': {
      plugins: [
        {
          typescript: {
            typesPrefix: 'Schema',
          },
        },
        {
          'typescript-operations': {
            typesPrefix: 'Operation',
          },
        },
        {
          'typed-document-node': {
            typesPrefix: 'Operation',
          },
        },
      ],
      config: {
        useTypeImports: true,
      },
    },
  },
}

export default config
