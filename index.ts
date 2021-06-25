type IdObject = Record<string, unknown>;

class ReusableGenerator<T> {
  private descriptors = new WeakMap<IdObject, number>();
  private results: IteratorResult<T>[] = [];
  private constructor(private gen: Generator<T>, private id: IdObject) {}
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
  [Symbol.iterator](): ReusableGenerator<T> {
    return this;
  }
  static reusable<T>(gen: Generator<T>): ReusableGenerator<T> {
    return new ReusableGenerator<T>(gen, Object.create(null));
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

export type { ReusableGenerator };
export const reusable: typeof ReusableGenerator.reusable = ReusableGenerator.reusable;
