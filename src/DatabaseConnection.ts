import { TaskMap } from 'promise-based-task';
import { ChildTask } from './utils/ChildTask';
import { fork, ChildProcess } from 'child_process';
import * as path from 'path';

import type { SparqlQuery } from '@tpluscode/sparql-builder/lib';
import type { TemplateResult } from '@tpluscode/rdf-string/lib/TemplateResult';
import type {
  IDatabaseConnectionConfig,
  IChildTask,
  IChildTaskErrorResponse,
  ChildTaskResponse,
  IChildTaskSuccessResponse,
  IDatabaseConnection,
} from './types';
import { queryToString, responseToTriples } from './helpers';

export class DatabaseConnection implements IDatabaseConnection {
  // Task related properties
  protected tasks = new TaskMap<string, ChildTask>();
  protected taskToProcess = new WeakMap<ChildProcess, string[]>();
  protected lastTaskId = 0;
  protected readonly maxQueryTimeout: number = 0;

  // Pool related properties
  protected childProcessIndex = 0;
  protected childProcesses: ChildProcess[] = [];
  protected readonly maxPoolSize: number = 1;

  constructor(protected readonly options: IDatabaseConnectionConfig) {
    this.maxQueryTimeout = Math.max(Number(options.maxQueryTimeout) || 0, 0);
    this.maxPoolSize = Math.max(Number(options.poolSize) || 1, 1);
  }

  /**
   * Executes ISQL query or procedure
   * @param query
   * @param procedureCalls
   */
  async rawQuery<T>(query: string, procedureCalls = false): Promise<T> {
    const command: IChildTask = {
      id: String(++this.lastTaskId),
      method: 'rawQuery',
      params: [query, procedureCalls],
    };

    return this.sendCommand<T>(command);
  }

  /**
   * Execute SPARQL query
   * @param query
   * @param checkVoidExpression (Virtuoso internal)
   */
  async query<T extends any = any>(
    query: string | SparqlQuery | TemplateResult<unknown>,
    checkVoidExpression = true,
  ): Promise<T> {
    const queryString = queryToString(query);

    const command: IChildTask = {
      id: String(++this.lastTaskId),
      method: 'query',
      params: [queryString, checkVoidExpression],
    };

    return this.sendCommand<T>(command);
  }

  /**
   * Cancel all running queries and destroy all connections
   * class instance can be re-used later
   */
  destroy() {
    this.childProcesses.forEach((childProcess) => childProcess.disconnect());
    this.childProcesses.length = 0;
    this.childProcessIndex = 0;
    this.tasks.clear();
  }

  protected resolveTask(message: IChildTaskSuccessResponse) {
    this.tasks.get(message.id)?.resolve(message.result);
    this.tasks.delete(message.id);
  }

  protected rejectTask(message: IChildTaskErrorResponse) {
    this.tasks.get(message.id)?.reject(message.error);
    this.tasks.delete(message.id);
  }

  /**
   * Send command to the child process
   * @param command
   * @protected
   */
  protected async sendCommand<T>(command: IChildTask): Promise<T> {
    if (this.lastTaskId >= Number.MAX_SAFE_INTEGER) {
      this.lastTaskId = 0;
    }

    const childProcess = this.getChild();
    childProcess.send(command);

    const task = new ChildTask();
    this.tasks.set(command.id, task);
    if (this.taskToProcess.has(childProcess)) {
      this.taskToProcess.get(childProcess)!.push(command.id);
    } else {
      this.taskToProcess.set(childProcess, [command.id]);
    }

    let timeoutId: NodeJS.Timeout | undefined;
    if (this.maxQueryTimeout > 0) {
      timeoutId = setTimeout(() => {
        task.reject(new Error(`Query timeout has been exceeded!`));
        this.destroyChild(childProcess);
      }, this.maxQueryTimeout * 1000);
    }

    return task.finally(() => clearTimeout(timeoutId)) as Promise<T>;
  }

  /**
   * Creates child process, adds it to the pool and bind event handlers
   */
  protected initChild(): void {
    const childProcess = fork(
      path.join(__dirname, './DatabaseConnection.child' + path.extname(__filename)),
      [JSON.stringify(this.options)],
      {
        detached: true,
      },
    );

    childProcess.once('error', () => {
      this.destroyChild(childProcess);
    });

    childProcess.on('message', (message: ChildTaskResponse) => {
      if ('error' in message) {
        this.rejectTask(message);

        if (message.error.includes('Connection to the server lost')) {
          this.destroy();
          return;
        }

        if (
          message.error.includes('Connection failed') ||
          message.error.includes('Broken pipe') ||
          message.error.includes('Connection refused')
        ) {
          this.destroyChild(childProcess);
        }
        return;
      }

      if (message.result === null || message.result === undefined) {
        return this.resolveTask(message);
      }

      responseToTriples(message).then((result: typeof message['result']) => {
        this.resolveTask({
          ...message,
          result,
        });
      });
    });

    this.childProcesses.push(childProcess);
  }

  /**
   * Retrieve child process from the pool (Round Robin Load Balancing)
   * @protected
   */
  protected getChild(): ChildProcess {
    if (this.childProcesses.length < this.maxPoolSize) {
      this.initChild();
      this.childProcessIndex++;
      return this.childProcesses[this.childProcesses.length - 1];
    }

    if (this.childProcessIndex >= Number.MAX_SAFE_INTEGER) {
      this.childProcessIndex = 0;
    }

    const child = this.childProcesses[this.childProcessIndex % this.childProcesses.length];
    this.childProcessIndex++;
    return child;
  }

  /**
   * Disconnect and remove the child process from the pool
   * @param childProcess
   * @protected
   */
  protected destroyChild(childProcess: ChildProcess): void {
    const index = this.childProcesses.findIndex((el) => el === childProcess);
    if (index > -1) {
      if (this.taskToProcess.has(childProcess)) {
        this.taskToProcess.get(childProcess)!.forEach((id) => {
          this.tasks.delete(id);
        });
        this.taskToProcess.get(childProcess)!.length = 0;
      }
      this.childProcesses.splice(index, 1);
    }
    if (childProcess && childProcess.connected) {
      childProcess.disconnect();
    }
  }
}

export default DatabaseConnection;
