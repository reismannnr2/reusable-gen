type IdObject = Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IteratorTypes<T extends Iterator<any>[]> = {
  [P in keyof T]: T[P] extends Iterator<infer U> ? U : never;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IteratorResultTypes<T extends Iterator<any>[]> = {
  [P in keyof T]: T[P] extends Iterator<infer U> ? IteratorResult<U> : never;
};

/**
 * Utility class which makes iterator reusable with use() method.
 * It also provides array-like iterator manipulating methods, for example filter() or map().
 */
export class ReusableGenerator<T> implements IterableIterator<T> {
  private descriptors = new WeakMap<IdObject, number>();
  private results: IteratorResult<T>[] = [];
  private constructor(private gen: Iterator<T>, private id: IdObject) {}
  private request(id: IdObject): IteratorResult<T> {
    const idx = this.descriptors.get(id) ?? 0;
    if (this.results.length === idx) {
      const result = this.gen.next();
      if (result.done) {
        return result;
      }
      this.results.push(result);
      this.descriptors.set(id, idx + 1);
      return result;
    }
    const result = this.results[idx];
    this.descriptors.set(id, idx + 1);
    return result;
  }

  /**
   * Returns an iterator that iterates values from first.
   */
  use(): ReusableGenerator<T> {
    const id = Object.create(null);
    const child = ReusableGenerator.childGenerator(this, id);
    return new ReusableGenerator(child, id);
  }

  /**
   * Returns an iterator that iterates rest values.
   * The base iterator yields 1, 2, 3, 4, 5 and 1, 2, 3 are already yielded,
   * then base.rest() yields 4, 5.
   */
  rest(): ReusableGenerator<T> {
    const id = Object.create(null);
    const child = ReusableGenerator.childGenerator(this, id);
    this.descriptors.set(id, this.results.length);
    return new ReusableGenerator(child, id);
  }

  next(): IteratorResult<T> {
    return this.request(this.id);
  }

  /**
   * Returns an iterator which yields, [number, T]. Just like Array.prototype.entries()
   */
  entries(): ReusableGenerator<[number, T]> {
    const src = this.use();
    let idx = 0;
    const gen = (function* (): Generator<[number, T]> {
      for (const value of src) {
        yield [idx, value];
        idx += 1;
      }
    })();
    return reusable(gen);
  }

  /**
   * Returns iterator that iterates base iterator repeatedly.
   * @param n How many times repeat the base iterator.
   */
  repeat(n: number): ReusableGenerator<T> {
    const src = this.use();
    const gen = (function* () {
      for (let i = 0; i < n; i++) {
        const child = src.use();
        yield* child;
      }
    })();
    return reusable(gen);
  }

  /**
   * Map the iterated values just like Array.prototype.map
   * @param transform callback which transform  each iterated value into another value.
   */
  map<R>(transform: (prev: T) => R): ReusableGenerator<R> {
    const src = this.use();
    const gen = (function* () {
      for (const prev of src) {
        yield transform(prev);
      }
    })();
    return reusable(gen);
  }

  /**
   * Just like Array.prototype.flatMap, but should be return an iterable thing.
   * @param transform callback which transform each iterated value into another iterator.
   */
  flatMap<R>(transform: (value: T) => Iterable<R>): ReusableGenerator<R> {
    const src = this.use();
    const gen = (function* () {
      for (const prev of src) {
        yield* transform(prev);
      }
    })();
    return reusable(gen);
  }

  /**
   * Utility function for debugging, iterated value won't be changed.
   * Be careful that it does not do anything, when the iterator isn't consumed.
   * @param procedure callback which takes each value as an argument.
   */
  inspect(procedure: (value: T) => void): ReusableGenerator<T> {
    const src = this.use();
    const gen = (function* () {
      for (const value of src) {
        procedure(value);
        yield value;
      }
    })();
    return reusable(gen);
  }

  /**
   * Filters the iterated values just like Array.prototype.filter
   * @param predicate callback which returns boolean whether the value should be yielded or not.
   */
  filter(predicate: (value: T) => boolean): ReusableGenerator<T> {
    const src = this.use();
    const gen = (function* () {
      for (const value of src) {
        if (predicate(value)) {
          yield value;
        }
      }
    })();
    return reusable(gen);
  }

  /**
   * Returns iterator which iterates unique values from the base.
   * In other words, it iterates the value only when it appears for the first time.
   */
  unique(): ReusableGenerator<T> {
    const src = this.use();
    const gen = (function* () {
      const set = new Set<T>();
      for (const value of src) {
        if (!set.has(value)) {
          set.add(value);
          yield value;
        }
      }
    })();
    return reusable(gen);
  }

  /**
   * Returns an iterator which iterates first n values of the base iterator
   * @param n How many elements should be iterated at most.
   */
  take(n: number): ReusableGenerator<T> {
    const src = this.use();
    let idx = 0;
    const gen =
      n > 0
        ? (function* () {
            for (const value of src) {
              yield value;
              idx += 1;
              if (idx >= n) {
                break;
              }
            }
          })()
        : (function* () {})();
    return reusable(gen);
  }

  /**
   * Returns an iterator which iterates base iterator values until predicate returns false.
   * @param predicate callback which returns whether iteration should be continued or not.
   */
  takeWhile(predicate: (value: T) => boolean): ReusableGenerator<T> {
    const src = this.use();
    const gen = (function* () {
      for (const value of src) {
        if (predicate(value)) {
          yield value;
        } else {
          break;
        }
      }
    })();
    return reusable(gen);
  }

  /**
   * Returns an iterator which skips first n element of the base iterator, and yields rest elements.
   * First n elements will not be consumed until the skip iterator called next() method first.
   * @param n How many elements should be skipped
   */
  skip(n: number): ReusableGenerator<T> {
    const src = this.use();
    if (n <= 0) {
      return src;
    }
    const gen = (function* (): Generator<T> {
      for (let i = 0; i < n; i++) {
        const result = src.next();
        if (result.done) {
          break;
        }
      }
      yield* src.rest();
    })();
    return reusable(gen);
  }

  /**
   * Returns an iterator which skip some values until predicate returns false.
   * @param predicate callback which returns whether iteration should start or not.
   */
  skipWhile(predicate: (value: T) => boolean): ReusableGenerator<T> {
    const src = this.use();
    const gen = (function* (): Generator<T> {
      for (const value of src) {
        if (!predicate(value)) {
          yield value;
          break;
        }
      }
      yield* src.rest();
    })();
    return reusable(gen);
  }

  /**
   * Slice iterator just like Array.prototype.slice, but it does not consider negative parameter.
   * It will not consume the base iterator until the slice iterator called next() method first.
   * @param start
   * @param end not included
   */
  slice(start: number, end?: number): ReusableGenerator<T> {
    const src = this.skip(start);
    if (end === undefined) {
      return src;
    }
    if (end <= start) {
      return ReusableGenerator.from([]);
    }
    return src.take(end - start);
  }

  /**
   * Returns an iterator that skips first value of the base iterator
   */
  tail(): ReusableGenerator<T> {
    return this.skip(1);
  }

  /**
   * Returns an iterator which iterates the base iterator first, and later given iterators.
   * @param iterables which should be iterated after the base iterator
   */
  concat<R = T>(...iterables: Iterable<T | R>[]): ReusableGenerator<T | R> {
    return this._append(iterables);
  }

  /**
   * Returns an iterator which iterates the base iterator first, and later given iterators.
   * @param iterables which should be iterated after the base iterator
   */
  append<R = T>(...iterables: Iterable<T | R>[]): ReusableGenerator<T | R> {
    return this._append(iterables);
  }

  private _append<R = T>(iterables: Iterable<T | R>[]) {
    const src = this.use();
    const gen = (function* (): Generator<T | R> {
      yield* src;
      for (const item of iterables) {
        for (const value of item) {
          yield value;
        }
      }
    })();
    return reusable(gen);
  }

  /**
   * Returns an iterator which iterates given iterators first, and later the base.
   * @param iterables which should be iterated before the base iterator
   */
  prepend<R = T>(...iterables: Iterable<T | R>[]): ReusableGenerator<T | R> {
    return this._prepend(iterables);
  }

  private _prepend<R = T>(iterables: Iterable<T | R>[]): ReusableGenerator<T | R> {
    const src = this.use();
    const gen = (function* (): Generator<T | R> {
      for (const item of iterables) {
        for (const value of item) {
          yield value;
        }
      }
      yield* src;
    })();
    return reusable(gen);
  }

  /**
   * Returns an iterator which iterates tuple of base and other iterator values.
   * It stops iterating when the base or given iterator is done.
   * @param others iterators which should be iterated with the base in parallel
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zip<R extends Iterator<any>[]>(...others: R): ReusableGenerator<[T, ...IteratorTypes<R>]> {
    const src = this.use();
    const gen = (function* (): Generator<[T, ...IteratorTypes<R>]> {
      for (const value of src) {
        const results = others.map((i) => i.next()) as IteratorResultTypes<R>;
        if (results.some((r) => r.done)) {
          break;
        }
        const values = results.map((r) => r.value) as IteratorTypes<R>;
        yield [value, ...values];
      }
    })();
    return reusable(gen);
  }

  /**
   * Returns an iterator which iterates scanned value.
   * Works like Array.prototype.reduce, but it iterates midway state.
   * When the base iterates 1, 2, 3, and init is 0, you passed (a, b) => a + b, in order to calculate sum, then the result is:
   *   [0, 1, 3, 5, 8] which means 0, 0 + 1 = 1, 1 + 2 = 3, 3 + 2 = 5, 5 + 3 = 8
   * @param scanner callback that takes midway state and the iterating value as arguments.
   * @param init initial value
   */
  scanWith<R>(scanner: (acc: R, curr: T) => R, init: R): NonEmptyReusableGenerator<R> {
    const src = this.use();
    const gen = (function* () {
      let acc = init;
      for (const curr of src) {
        acc = scanner(acc, curr);
        yield acc;
      }
    })();
    return reusable(gen) as NonEmptyReusableGenerator<R>;
  }

  /**
   * Returns an iterator which iterates scanned value.
   * Works like Array.prototype.reduce, but it iterates midway state.
   * When the base iterates 1, 2, 3, and you passed (a, b) => a + b, in order to calculate sum, then the result is:
   *   [3, 5, 8] which means 1 + 2 = 3, 3 + 2 = 5, 5 + 3 = 8
   * @param scanner callback that takes midway state and the iterating value as arguments.
   */
  scan<R = T>(scanner: (acc: T | R, curr: T) => R): ReusableGenerator<R> {
    const src = this.use();
    const gen = (function* (): Generator<R> {
      const first = src.next();
      if (!first.done) {
        let acc: T | R = first.value;
        for (const curr of src.rest()) {
          acc = scanner(acc, curr);
          yield acc;
        }
      }
    })();
    return reusable(gen);
  }

  /**
   * Returns an iterator that is guaranteed to iterate at least one value.
   * It consumes the first value of the base in order to check the base has at least one element,
   * and if there are no element for the base, it throws.
   */
  asNonEmpty(): NonEmptyReusableGenerator<T> {
    const src = this.use();
    const first = src.next();
    if (first.done) {
      throw new TypeError('Method asNonEmpty() is called for ReusableGenerator, but it was empty!');
    }
    return this.use() as NonEmptyReusableGenerator<T>;
  }

  /**
   * Returns an iterator which yields values of the base reversely.
   * It consumes tha base iterator it called first, since it does not know what is the last item of the base.
   */
  reverse(): ReusableGenerator<T> {
    const src = this.use();
    const gen = (function* () {
      const items = src.collect().reverse();
      for (const value of items) {
        yield value;
      }
    })();
    return reusable(gen);
  }

  // Consumers
  /**
   * Returns the first value of the iterator, undefined when the iterator is done.
   */
  head(): T | undefined {
    const head = this.use().next();
    return head.done ? undefined : head.value;
  }

  /**
   * Consumes the iterator and return as an array. Works just like [...iterable];
   * Be careful it results in infinite loop if inner generator is infinite list.
   */
  collect(): T[] {
    const collected: T[] = [];
    for (const value of this.use()) {
      collected.push(value);
    }
    return collected;
  }

  /**
   * Consumes the iterator and return reduced value. just works like Array.prototype.reduce
   * @param reducer
   * @param init
   */
  reduceWith<R>(reducer: (acc: R, curr: T) => R, init: R): R {
    let acc = init;
    for (const curr of this.use()) {
      acc = reducer(acc, curr);
    }
    return acc;
  }

  /**
   * Consumes the iterator and return reduced value. just works like Array.prototype.reduce
   * @param reducer
   */
  reduce(reducer: (acc: T, curr: T) => T): T | undefined;
  reduce<R = T>(reducer: (acc: T | R, curr: T) => R, onEmpty: () => R): T | R;
  reduce<R = T>(reducer: (acc: T | R, curr: T) => R, onEmpty?: () => R): T | R | undefined {
    const gen = this.use();
    const result = gen.next();
    if (result.done) {
      return onEmpty ? onEmpty() : undefined;
    }
    let acc: T | R = result.value;
    for (const curr of gen) {
      acc = reducer(acc, curr);
    }
    return acc;
  }

  /**
   * Consumes the iterator and return the first value which satisfies the testing function.
   * Works just like Array.prototype.find
   * @param predicate callback
   */
  find(predicate: (value: T) => boolean): T | undefined {
    for (const value of this.use()) {
      if (predicate(value)) {
        return value;
      }
    }
  }

  /**
   * Consumes the iterator and return the index of the first value which satisfies the testing function.
   * Returns -1 if none
   * Works just like Array.prototype.findIndex
   * @param predicate callback
   */
  findIndex(predicate: (value: T) => boolean): number {
    for (const [idx, value] of this.entries()) {
      if (predicate(value)) {
        return idx;
      }
    }
    return -1;
  }

  /**
   * Returns if all the elements of the iterator satisfies the testing function or not.
   * Works just like Array.prototype.every
   * @param predicate
   */
  every(predicate: (value: T) => boolean): boolean {
    for (const value of this.use()) {
      if (!predicate(value)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns if at least one of the elements of the iterator satisfies the testing function or not.
   * Works just like Array.prototype.some
   * @param predicate
   */
  some(predicate: (value: T) => boolean): boolean {
    for (const value of this.use()) {
      if (predicate(value)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns the *champion* value that continued to win the challengers.
   * For example, it works like Math.max() when (champion, challenger) => champion >= challenger is passed.
   * @param hasDefended callback which returns if champion has defended or not
   */
  champion(hasDefended: (champion: T, challenger: T) => boolean): T | undefined {
    const src = this.use();
    const first = src.next();
    if (first.done) {
      return undefined;
    }
    let champion = first.value;
    for (const challenger of src.rest()) {
      champion = hasDefended(champion, challenger) ? champion : challenger;
    }
    return champion;
  }

  [Symbol.iterator](): ReusableGenerator<T> {
    return this;
  }

  /**
   * Wraps given iterator with ReusableGenerator.
   * @param iterator
   */
  static reusable<T>(iterator: Iterator<T>): ReusableGenerator<T> {
    return new ReusableGenerator<T>(iterator, Object.create(null));
  }

  /**
   * Wraps given iterable with ReusableGenerator.
   * @param iterable
   */
  static from<T>(iterable: Iterable<T>): ReusableGenerator<T> {
    const gen = (function* (iterable) {
      yield* iterable;
    })(iterable);
    return reusable(gen);
  }

  /**
   * Creates a NonEmptyReusableGenerator that iterates given values.
   * @param first
   * @param items
   */
  static create<T>(first: T, ...items: T[]): NonEmptyReusableGenerator<T>;
  /**
   *Creates a ReusableGenerator that iterates given values.
   * @param items
   */
  static create<T>(...items: T[]): ReusableGenerator<T>;
  static create<T>(...items: T[]): ReusableGenerator<T> {
    return ReusableGenerator.from(items);
  }

  private static *childGenerator<T>(parent: ReusableGenerator<T>, id: IdObject) {
    let result: IteratorResult<T> | null = null;
    while (!result?.done) {
      result = parent.request(id);
      if (!result.done) {
        yield result.value;
      }
    }
  }
}

/**
 * ReusableGenerator which is guaranteed to iterate at least one value.
 * Some method certainly returns value, some returns NonEmptyReusableGenerator.
 * filter(), slice() or skip(), etc returns normal ReusableGenerator yet,
 * since they may iterate nothing even if the base iterates some values.
 */
export interface NonEmptyReusableGenerator<T> extends ReusableGenerator<T> {
  /**
   * Returns an iterator that iterates values from first.
   */
  use(): NonEmptyReusableGenerator<T>;
  /**
   * Returns an iterator which yields, [number, T]. Just like Array.prototype.entries()
   */
  entries(): NonEmptyReusableGenerator<[number, T]>;

  /**
   * Returns iterator that iterates base iterator repeatedly.
   * @param n How many times repeat the base iterator.
   */
  repeat(n: number): NonEmptyReusableGenerator<T>;

  /**
   * Map the iterated values just like Array.prototype.map
   * @param transform callback which transform  each iterated value into another value.
   */
  map<R>(transform: (prev: T) => R): NonEmptyReusableGenerator<R>;

  /**
   * Utility function for debugging, iterated value won't be changed.
   * Be careful that it does not do anything, when the iterator isn't consumed.
   * @param procedure callback which takes each value as an argument.
   */
  inspect(procedure: (value: T) => void): NonEmptyReusableGenerator<T>;

  /**
   * Returns an iterator which iterates first n values of the base iterator
   * @param n How many elements should be iterated at most.
   */
  take(n: number): NonEmptyReusableGenerator<T>;

  /**
   * Returns iterator which iterates unique values from the base.
   * In other words, it iterates the value only when it appears for the first time.
   */
  unique(): NonEmptyReusableGenerator<T>;

  /**
   * Returns an iterator which iterates the base iterator first, and later given iterators.
   * @param iterables which should be iterated after the base iterator
   */
  concat(...iterables: Iterable<T>[]): NonEmptyReusableGenerator<T>;

  /**
   * Returns an iterator which iterates the base iterator first, and later given iterators.
   * @param iterables which should be iterated after the base iterator
   */
  append(...iterables: Iterable<T>[]): NonEmptyReusableGenerator<T>;

  /**
   * Returns an iterator which iterates given iterators first, and later the base.
   * @param iterables which should be iterated before the base iterator
   */
  prepend(...iterables: Iterable<T>[]): NonEmptyReusableGenerator<T>;

  /**
   * Returns an iterator which yields values of the base reversely.
   * It consumes tha base iterator it called first, since it does not know what is the last item of the base.
   */
  reverse(): NonEmptyReusableGenerator<T>;
  /**
   * Returns the first value of the iterator.
   */
  head(): T;

  /**
   * Consumes the iterator and return reduced value. just works like Array.prototype.reduce
   * @param reducer
   */
  reduce(reducer: (acc: T, curr: T) => T): T;

  /**
   * Returns the *champion* value that continued to win the challengers.
   * For example, it works like Math.max() when (champion, challenger) => champion >= challenger is passed.
   * @param hasDefended callback which returns if champion has defended or not
   */
  champion(hasDefended: (champion: T, challenger: T) => boolean): T;
}

/**
 * Wraps given iterator with ReusableGenerator.
 * @param iterator
 */
export const reusable: typeof ReusableGenerator.reusable = ReusableGenerator.reusable;
export const rgen: typeof ReusableGenerator.create = ReusableGenerator.create;
export const intoRgen: typeof ReusableGenerator.from = ReusableGenerator.from;
