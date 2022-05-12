import { JDBC, Java } from '@naxmefy/jdbc';
import { mergeWith, min, noop, omit } from 'lodash';
import { ResultSet, Statement, Connection } from '@naxmefy/jdbc';
import type { IChildTask, ChildTaskResponse, IDatabaseConnection } from './types';
import type { IDatabaseConnectionConfig } from './types';

class DatabaseConnectionChild implements IDatabaseConnection {
  protected readonly db: JDBC;

  async destroy() {
    const connection = await this.db.getConnection(false);
    if (connection) {
      await connection.close();
    }
  }

  constructor(options: IDatabaseConnectionConfig) {
    const { driverPath, lazy = true } = options;

    const jv = new Java(true, false);
    if (!jv.isJvmCreated()) {
      jv.addClasspath([driverPath]);
    }

    const config = mergeWith(
      {
        className: 'virtuoso.jdbc4.Driver',
        maxidle: 24 * 60 * 60 * 1000,
        properties: {},
        url: 'URL_MISSING',
      },
      omit<IDatabaseConnectionConfig>(options, 'driverPath', 'lazy', 'maxQueryTimeout'),
      <T>(objValue: T, srcValue: T) => {
        if (srcValue !== undefined) {
          return srcValue;
        }
        return objValue;
      },
    );

    this.db = new JDBC(config);
    if (lazy !== true) {
      this.db.getConnection(true).then(noop);
    }
  }

  protected isQueryWithResult(query: string): boolean {
    const countIndex = query.match(/COUNT/i)?.index ?? -1;
    const selectIndex = query.match(/SELECT/i)?.index ?? -1;
    const constructIndex = query.match(/CONSTRUCT/i)?.index ?? -1;
    const askIndex = query.match(/CONSTRUCT/i)?.index ?? -1;

    const sMin =
      min([countIndex, selectIndex, constructIndex, askIndex].filter((i) => i !== -1)) ?? Infinity;
    if (sMin === 0) {
      return true;
    }

    const deleteIndex = query.match(/DELETE/i)?.index ?? -1;
    const insertIndex = query.match(/INSERT/i)?.index ?? -1;
    const clearIndex = query.match(/INSERT/i)?.index ?? -1;
    const rMin = min([deleteIndex, insertIndex, clearIndex].filter((i) => i !== -1)) ?? Infinity;

    return sMin < rMin;
  }

  protected async execute(
    query: string,
    statement: Statement,
    connection: Connection,
    checkVoidExpression: boolean,
  ) {
    const isSelect = this.isQueryWithResult(query);

    const prefix = [`SPARQL define output:format "JSON"`];
    if (checkVoidExpression) {
      prefix.push(`define sql:signal-void-variables 1`);
    }

    const fullQuery = prefix.join(' ').concat(query).concat('\n');

    const resultSet = await statement.executeQuery(fullQuery).catch((err: Error) => {
      connection.close();
      throw err;
    });

    if (!isSelect) {
      return null;
    }

    const results = await resultSet.fetchAllResults();
    return results[0]['callret-0'];
  }

  async rawQuery<T>(query: string, procedureCalls = false): Promise<T> {
    const connection = await this.db.getConnection(true);

    const statement = await connection.createStatement();
    const processor = statement[procedureCalls ? 'executeUpdate' : 'executeQuery'];

    const rawResults: ResultSet | number = await processor(query).catch((err: Error) => {
      connection.close();
      throw err;
    });

    if (typeof rawResults !== 'object') {
      return rawResults as unknown as T;
    }
    return rawResults.fetchAllResults() as unknown as Promise<T>;
  }

  async query<T>(queryString: string, checkVoidExpression = true): Promise<T> {
    console.info(`Waiting for connection...`);
    const connection = await this.db.getConnection(true);
    console.info(`Creating statement...`);
    const statement = await connection.createStatement();

    console.info(`Executing...`);
    return this.execute(queryString, statement, connection, checkVoidExpression);
  }
}

// Initialize database connection
const options = JSON.parse(process.argv[2]) as IDatabaseConnectionConfig;
const db = new DatabaseConnectionChild(options);

// Helper function for sending responses to parent process
function respondWithMessage(message: ChildTaskResponse) {
  if (!process.connected) {
    return;
  }
  process.send(message);
}

process.on('message', function (message: IChildTask) {
  log(`Processing task ${message.id}`);
  db[message.method]
    .call(db, ...message.params)
    .then((response) => {
      respondWithMessage({
        id: message.id,
        method: message.method,
        result: response,
      });
    })
    .catch((err) => {
      console.error(err);
      respondWithMessage({
        id: message.id,
        method: message.method,
        error: typeof err === 'string' ? err : String(err),
      });
    })
    .finally(() => {
      console.info(`Processing of task with ID: ${message.id} done!`);
    });
});

function log(...params: unknown[]) {
  if (process.env.NODE_ENV !== 'test') {
    console.debug(...params);
  }
}

function terminate() {
  log(`${DatabaseConnectionChild.name}: Shutdown the child process...`);
  db.destroy().finally(() => {
    log(`${DatabaseConnectionChild.name}: Child process has been disconnected`);
    process.exit(0);
  });
}

process.once('disconnect', terminate);
process.once('sigint', terminate);
process.once('sigterm', terminate);
process.once('sigkill', terminate);
