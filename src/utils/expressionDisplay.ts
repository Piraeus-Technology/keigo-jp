const LONG_EXPRESSION_THRESHOLD = 15;

export function isLongExpression(value: string): boolean {
  return value.length > LONG_EXPRESSION_THRESHOLD;
}

export function getDetailHeaderTitle(params: {
  key: string;
  type: 'verb' | 'expression';
}): string {
  return params.type === 'expression' && isLongExpression(params.key)
    ? 'Expression'
    : params.key;
}
