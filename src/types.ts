import type { SparqlQuery } from '@tpluscode/sparql-builder/lib';
import type { TemplateResult } from '@tpluscode/rdf-string/lib/TemplateResult';

export interface IDatabaseConnection {
  rawQuery<T extends any = any>(query: string, procedureCalls: boolean): Promise<T>;
  query<T extends any = any>(
    query: string | SparqlQuery | TemplateResult<unknown>,
    checkVoidExpression: boolean,
  ): Promise<T>;
}

export interface IDatabaseConnectionConfig {
  url: string;
  username: string;
  password: string;
  driverPath: string;
  lazy?: boolean;
  maxQueryTimeout?: number;
  poolSize?: number;
}

// Child process can only retrieve simple literal values
type SerializedTypes<T extends unknown[]> = T extends []
  ? []
  : T extends [infer H, ...infer R]
  ? H extends string | boolean | number | null | undefined
    ? [H, ...SerializedTypes<R>]
    : never
  : T;

export interface IChildTask<K extends keyof IDatabaseConnection = keyof IDatabaseConnection> {
  id: string;
  method: K;
  params: SerializedTypes<Parameters<IDatabaseConnection[K]>>;
}

type _ChildTaskResponse<K extends keyof IDatabaseConnection> = {
  id: string;
  method: K;
};

export type IChildTaskSuccessResponse<
  K extends keyof IDatabaseConnection = keyof IDatabaseConnection,
> = _ChildTaskResponse<K> & {
  result: Awaited<ReturnType<IDatabaseConnection[K]>>;
};

export type IChildTaskErrorResponse<
  K extends keyof IDatabaseConnection = keyof IDatabaseConnection,
> = _ChildTaskResponse<K> & {
  error: string;
};

export type ChildTaskResponse<K extends keyof IDatabaseConnection = keyof IDatabaseConnection> =
  | IChildTaskSuccessResponse<K>
  | IChildTaskErrorResponse<K>;
