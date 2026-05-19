// TODO: Remove this once it is added to
// This is the interface for the new Observable API
// https://wicg.github.io/observable/
// I tried using https://github.com/darionco/bikeshed-to-ts
// but I couldn't get it working quickly enough.
// So I ended up translating from the Bike Shed format (spec.bs) into .ts manually myself
// It might contain some mistakes in the translation.
// I tried replacing some "any" with Generics. Not sure if is correct though.

interface Subscriber<T> {
  next(value: T): void;
  error(error: any): void;
  complete(): void;
  addTeardown(teardown: () => void): void;

  // True after the Subscriber is created, up until either
  // complete()/error() are invoked, or the subscriber unsubscribes. Inside
  // complete()/error(), this attribute is true.
  readonly active: boolean;

  readonly signal: AbortSignal;
}

// SubscribeCallback is where the Observable "creator's" code lives. It's
// called when subscribe() is called, to set up a new subscription.
type SubscribeCallback<T> = (subscriber: Subscriber<T>) => void;
type ObservableSubscriptionCallback<T> = (value: T) => void;

interface SubscriptionObserver<T> {
  next: ObservableSubscriptionCallback<T>;
  error: ObservableSubscriptionCallback<any>;
  complete: VoidFunction;
}

type ObservableInspectorAbortHandler<T> = (value: T) => void;

interface ObservableInspector<T> {
  next: ObservableSubscriptionCallback<T>;
  error: ObservableSubscriptionCallback<any>;
  complete: VoidFunction;

  subscribe: VoidFunction;
  abort: ObservableInspectorAbortHandler<any>;
}

type ObserverUnion<T> =
  | ObservableSubscriptionCallback<T>
  | SubscriptionObserver<T>;
type ObservableInspectorUnion<T> =
  | ObservableSubscriptionCallback<T>
  | ObservableInspector<T>;

interface SubscribeOptions {
  signal: AbortSignal;
}

type Predicate<T> = (value: T, index: number) => boolean;
type Reducer<TA, TC> = (accumulator: TA, currentValue: TC, index: number) => TA;
type Mapper<TI, TO> = (value: TI, index: number) => TO;
// Differs from Mapper only in return type, since this callback is exclusively
// used to visit each element in a sequence, not transform it.
type Visitor<T> = (value: T, index: number) => void;

// This callback returns an `any` that must convert into an `Observable`, via
// the `Observable` conversion semantics.
type CatchCallback = (value: any) => any;

type Containers<T> =
  | Observable<T>
  | AsyncIterable<T>
  | Iterable<T>
  | Promise<T>;

interface ObservableEventListenerOptions {
  capture: boolean;
  passive: boolean;
}

interface Observable<T> {
  subscribe(observer?: ObserverUnion<T>, options?: SubscribeOptions): void;

  // Observable-returning operators. See "Operators" section in the spec.
  //
  // takeUntil() can consume promises, iterables, async iterables, and other
  // observables.
  takeUntil(value: Containers<T>): Observable<T>;
  map<TO>(mapper: Mapper<T, TO>): Observable<TO>;
  filter(predicate: Predicate<T>): Observable<T>;
  take(amount: number): Observable<T>;
  drop(amount: number): Observable<T>;
  flatMap<TO>(mapper: Mapper<T, Containers<TO>>): Observable<TO>;
  switchMap<TO>(mapper: Mapper<T, TO>): Observable<TO>;
  inspect(inspectorUnion?: ObservableInspectorUnion<T>): Observable<T>;
  catch(callback: CatchCallback): Observable<T>;
  finally(callback: VoidFunction): Observable<T>;

  // Promise-returning operators.
  toArray(options?: SubscribeOptions): Promise<Array<T>>;
  forEach(callback: Visitor<T>, options?: SubscribeOptions): Promise<undefined>;
  every(predicate: Predicate<T>, options?: SubscribeOptions): Promise<boolean>;
  first(options?: SubscribeOptions): Promise<T>;
  last(options?: SubscribeOptions): Promise<T>;
  find(predicate: Predicate<T>, options?: SubscribeOptions): Promise<T>;
  some(predicate: Predicate<T>, options?: SubscribeOptions): Promise<boolean>;
  reduce<TA>(
    reducer: Reducer<TA, T>,
    initialValue?: TA,
    options?: SubscribeOptions,
  ): Promise<TA>;
}

interface ObservableConstructor {
  new <T>(callback: SubscribeCallback<T>): Observable<T>;

  // Constructs a native Observable from value if it's any of the following:
  //   - Observable
  //   - AsyncIterable
  //   - Iterable
  //   - Promise
  from<T>(value: Containers<T>): Observable<T>;
}

declare var Observable: ObservableConstructor;

// reference: https://www.typescriptlang.org/docs/handbook/declaration-merging.html#global-augmentation

interface EventTarget {
  when(
    type: string,
    options?: ObservableEventListenerOptions,
  ): Observable<Event>;
}
