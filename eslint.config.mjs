import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: ['DEVELOPMENT_PLAN.md'],
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    'unused-imports/no-unused-vars': 'warn',
    'unused-imports/no-unused-imports': 'warn',
  },
})
