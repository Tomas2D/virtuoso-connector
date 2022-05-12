import { Task } from 'promise-based-task';
import { IChildTaskSuccessResponse } from '../types';

export class ChildTask extends Task<IChildTaskSuccessResponse['result']> {
  destructor() {
    this.reject(new Error(`Request has been cancelled`));
  }
}
