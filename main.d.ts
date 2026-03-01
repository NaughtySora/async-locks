
type AsyncCallback = (...args: any[]) => Promise<any>;

interface IsolateOptions<C extends AsyncCallback> {
  args: Parameters<C>;
  signal?: AbortSignal;
}

export class Semaphore {
  constructor(concurrency?: number);
  enter(signal?: AbortSignal): Promise<void>;
  isolate<C extends AsyncCallback>(
    callback: C,
    option?: IsolateOptions<C>
  ): Promise<ReturnType<C>>;
  empty: boolean;
}