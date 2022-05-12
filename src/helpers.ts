import type { SparqlQuery } from '@tpluscode/sparql-builder/lib';
import { TemplateResult } from '@tpluscode/rdf-string/lib/TemplateResult';
import { IChildTaskSuccessResponse } from './types';
import VirtuosoResultParser from './utils/VirtuosoResult.parser';

export function queryToString(query: string | SparqlQuery | TemplateResult<unknown>) {
  if (typeof query === 'string') {
    return query;
  }
  if ('build' in (query as object)) {
    return (query as SparqlQuery).build();
  }
  if ('toString' in (query as object)) {
    return query.toString();
  }

  throw new Error(`"query" parameter is invalid type`);
}

export function responseToTriples(message: IChildTaskSuccessResponse) {
  const parser = new VirtuosoResultParser();
  parser.write(message.result);
  parser.end();

  return new Promise((resolve, reject) => {
    const parts: unknown[] = [];
    parser
      .on('data', (data) => parts.push(data))
      .on('error', reject)
      .on('end', () => resolve(parts));
  });
}
