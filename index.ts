type IdObject = Record<string, unknown>;

export class ReusableGenerator<T> implements IterableIterator<T> {
  private descriptors = new WeakMap<IdObject, number>();
  private results: IteratorResult<T>[] = [];
  private constructor(private gen: Iterator<T>, private id: IdObject) {}
  use(): ReusableGenerator<T> {
    const id = Object.create(null);
    const child = ReusableGenerator.childGenerator(this, id);
    return new ReusableGenerator(child, id);
  }
  rest(): ReusableGenerator<T> {
    const id = Object.create(null);
    const child = ReusableGenerator.childGenerator(this, id);
    this.descriptors.set(id, this.results.length);
    return new ReusableGenerator(child, id);
  }
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
  next(): IteratorResult<T> {
    return this.request(this.id);
  }

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
  repeat(n: number): ReusableGenerator<T> {
    const src = this.use();
    const gen = (function* () {
      const child = src.use();
      for (let i = 0; i < n; i++) {
        yield* child;
      }
    })();
    return reusable(gen);
  }
  map<R>(transform: (prev: T) => R): ReusableGenerator<R> {
    const src = this.use();
    const gen = (function* () {
      for (const prev of src) {
        yield transform(prev);
      }
    })();
    return reusable(gen);
  }
  flatMap(transform: (value: T) => Iterable<T>): ReusableGenerator<T> {
    const src = this.use();
    const gen = (function* () {
      for (const prev of src) {
        yield* transform(prev);
      }
    })();
    return reusable(gen);
  }
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
  skipWhile(predicate: (value: T) => boolean): ReusableGenerator<T> {
    const src = this.use();
    const gen = (function* (): Generator<T> {
      for (const value of src) {
        if (!predicate(value)) {
          break;
        }
        yield* src.rest();
      }
    })();
    return reusable(gen);
  }
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
  tail(): ReusableGenerator<T> {
    return this.skip(1);
  }
  concat(...items: Iterable<T>[]): ReusableGenerator<T> {
    return this.append(...items);
  }
  append(...items: Iterable<T>[]): ReusableGenerator<T> {
    const src = this.use();
    const gen = (function* (): Generator<T> {
      yield* src;
      for (const item of items) {
        for (const value of item) {
          yield value;
        }
      }
    })();
    return reusable(gen);
  }
  prepend(...items: Iterable<T>[]): ReusableGenerator<T> {
    const src = this.use();
    const gen = (function* (): Generator<T> {
      for (const item of items) {
        for (const value of item) {
          yield value;
        }
      }
      yield* src;
    })();
    return reusable(gen);
  }
  zip<R>(other: Iterator<R>): ReusableGenerator<[T, R]> {
    const src = this.use();
    const gen = (function* (): Generator<[T, R]> {
      for (const value of src) {
        const otherResult = other.next();
        if (otherResult.done) {
          break;
        }
        yield [value, otherResult.value];
      }
    })();
    return reusable(gen);
  }

  scanWith<R>(reducer: (acc: R, curr: T) => R, init: R): NonEmptyGenerator<R> {
    const src = this.use();
    const gen = (function* () {
      let acc = init;
      yield acc;
      for (const curr of src) {
        acc = reducer(acc, curr);
        yield acc;
      }
    })();
    return reusable(gen) as NonEmptyGenerator<R>;
  }
  scan(reducer: (acc: T, curr: T) => T): ReusableGenerator<T> {
    const src = this.use();
    const gen = (function* () {
      const first = src.next();
      if (!first.done) {
        let acc = first.value;
        yield acc;
        for (const curr of src.rest()) {
          acc = reducer(acc, curr);
          yield acc;
        }
      }
    })();
    return reusable(gen);
  }
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

  // Consumers
  head(): T | undefined {
    const head = this.use().next();
    return head.done ? head.value : undefined;
  }
  collect(): T[] {
    const collected: T[] = [];
    for (const value of this.use()) {
      collected.push(value);
    }
    return collected;
  }
  reduceWith<R>(reducer: (acc: R, curr: T) => R, init: R): R {
    let acc = init;
    for (const curr of this.use()) {
      acc = reducer(acc, curr);
    }
    return acc;
  }
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

  find(predicate: (value: T) => boolean): T | undefined {
    for (const value of this.use()) {
      if (predicate(value)) {
        return value;
      }
    }
  }
  findIndex(predicate: (value: T) => boolean): number {
    for (const [idx, value] of this.entries()) {
      if (predicate(value)) {
        return idx;
      }
    }
    return -1;
  }
  every(predicate: (value: T) => boolean): boolean {
    for (const value of this.use()) {
      if (!predicate(value)) {
        return false;
      }
    }
    return true;
  }
  some(predicate: (value: T) => boolean): boolean {
    for (const value of this.use()) {
      if (predicate(value)) {
        return true;
      }
    }
    return false;
  }
  champion(predicate: (champion: T, challenger: T) => boolean): T | undefined {
    const src = this.use();
    const first = src.next();
    if (first.done) {
      return undefined;
    }
    let champion = first.value;
    for (const challenger of src.rest()) {
      champion = predicate(champion, challenger) ? champion : challenger;
    }
    return champion;
  }

  [Symbol.iterator](): ReusableGenerator<T> {
    return this;
  }
  static reusable<T>(gen: Iterator<T>): ReusableGenerator<T> {
    return new ReusableGenerator<T>(gen, Object.create(null));
  }
  static from<T>(iterable: Iterable<T>): ReusableGenerator<T> {
    const gen = (function* (iterable) {
      yield* iterable;
    })(iterable);
    return reusable(gen);
  }
  static create<T>(first: T, ...items: T[]): NonEmptyGenerator<T>;
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

export interface NonEmptyGenerator<T> extends ReusableGenerator<T> {
  champion(predicate: (champion: T, challenger: T) => boolean): T;
  reduce(reducer: (acc: T, curr: T) => T): T;
  head(): T;
  use(): NonEmptyGenerator<T>;
  entries(): NonEmptyGenerator<[number, T]>;
  repeat(n: number): NonEmptyGenerator<T>;
  take(n: number): NonEmptyGenerator<T>;
  unique(): NonEmptyGenerator<T>;
  map<R>(transform: (prev: T) => R): NonEmptyGenerator<R>;
  inspect(procedure: (value: T) => void): NonEmptyGenerator<T>;
  concat(...items: Iterable<T>[]): NonEmptyGenerator<T>;
  append(...items: Iterable<T>[]): NonEmptyGenerator<T>;
  prepend(...items: Iterable<T>[]): NonEmptyGenerator<T>;
}

export const reusable: typeof ReusableGenerator.reusable = ReusableGenerator.reusable;
