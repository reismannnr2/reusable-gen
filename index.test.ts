import { reusable, ReusableGenerator, rgen, intoRgen } from './index';

describe('ReusableGenerator', () => {
  test('should be always done for done generator', () => {
    expect([...ReusableGenerator.from([])]).toHaveLength(0);
    expect(
      (() => {
        const gen = (function* () {
          yield 1;
        })();
        gen.next();
        const rg = reusable(gen);
        return [...rg.use()];
      })(),
    ).toHaveLength(0);
  });
  test('should yield same values for instances created same time', () => {
    const gen = (function* () {
      yield { inner: 1 };
      yield { inner: 2 };
      yield { inner: 3 };
    })();
    const base = reusable(gen);
    const [a, b] = [base.use(), base.use()];
    expect(a.next().value).toBe(b.next().value);
    expect(b.next().value).toBe(a.next().value);
    expect(a.next().value).toBe(b.next().value);
    expect(a.next()).toEqual({ done: true });
  });
  test('should yield only rest values for instances created by rest() method in the middle of iteration', () => {
    const gen = (function* () {
      yield 1;
      yield 2;
      yield 3;
    })();
    const base = reusable(gen).use();
    base.next();
    expect([...base.rest()]).toEqual([2, 3]);
    expect([...base.rest()]).toEqual([]);
    expect([...base.use()]).toEqual([1, 2, 3]);
    expect([...base.use().rest()]).toEqual([1, 2, 3]);
  });
  test('entries() should yield values with index', () => {
    expect(ReusableGenerator.create(1, 2, 3).entries().collect()).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ]);
  });
  test('repeat() should yield values repeatedly', () => {
    expect(ReusableGenerator.create(1, 2, 3).repeat(3).collect()).toEqual([1, 2, 3, 1, 2, 3, 1, 2, 3]);
  });
  test('map() should yield transformed value', () => {
    expect(
      ReusableGenerator.create(1, 2, 3)
        .map((v) => v * 2)
        .collect(),
    ).toEqual([2, 4, 6]);
  });
  test('flatMap() should iterate iterables returned by transform', () => {
    expect(
      ReusableGenerator.create(1, 2, 3)
        .flatMap((v) => [v, v + 2])
        .collect(),
    ).toEqual([1, 3, 2, 4, 3, 5]);
  });
  test('inspect() does not change iterators but call given function', () => {
    const mockFn = jest.fn();
    ReusableGenerator.create(1, 2, 3).inspect(mockFn).collect();
    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(mockFn.mock.calls).toEqual([[1], [2], [3]]);
  });
  test('filter() should iterate only values which satisfies predicate', () => {
    expect(
      ReusableGenerator.create(1, 2, 3, 4, 5, 6)
        .filter((v) => v % 2 === 0)
        .collect(),
    ).toEqual([2, 4, 6]);
  });
  test('unique() should yield values when it appeared for the first time', () => {
    expect(rgen(1, 2, 1, 2, 3, 4, 4).unique().collect()).toEqual([1, 2, 3, 4]);
  });
  describe('take()', () => {
    test('should yield only the first n values', () => {
      expect(ReusableGenerator.create(1, 2, 3, 4, 5).take(3).collect()).toEqual([1, 2, 3]);
      expect(ReusableGenerator.create(1, 2, 3).take(3).collect()).toEqual([1, 2, 3]);
    });
    test('should return empty iterator for 0 or negative counts', () => {
      expect(ReusableGenerator.create(1, 2, 3).take(-1).collect()).toEqual([]);
    });
  });
  test('takeWhile() should stop iterating after predicate has returned false', () => {
    expect(
      ReusableGenerator.create(1, 2, 3, 2, 1)
        .takeWhile((v) => v < 3)
        .collect(),
    ).toEqual([1, 2]);
  });
  describe('skip()', () => {
    test('should not yield the first n values', () => {
      expect(ReusableGenerator.create(1, 2, 3, 4, 5, 6).skip(3).collect()).toEqual([4, 5, 6]);
      expect(rgen(1, 2, 3).skip(10).collect()).toEqual([]);
    });
    test('should return just a child of base iterator for 0 or negative count', () => {
      expect(ReusableGenerator.create(1, 2, 3).skip(0).collect()).toEqual([1, 2, 3]);
    });
  });
  test('skipWhile() should start yielding after predicate has returned false', () => {
    expect(
      ReusableGenerator.create(1, 2, 3, 4, 5, 1, 2)
        .skipWhile((v) => v < 3)
        .collect(),
    ).toEqual([3, 4, 5, 1, 2]);
  });
  describe('slice()', () => {
    test('should iterate only the values of which index is in [start, end)', () => {
      expect(rgen(0, 1, 2, 3, 4, 5).slice(2, 5).collect()).toEqual([2, 3, 4]);
    });
    test('should just works like skip() when end is omitted', () => {
      expect(rgen(1, 2, 3, 4, 5).slice(3).collect()).toEqual([4, 5]);
    });
    test('should return empty iterator if end equals to or less than start', () => {
      expect(rgen(1, 2, 3, 4, 5).slice(2, 1).collect()).toEqual([]);
    });
  });
  test('tail() should work just like skip(1)', () => {
    expect(rgen(1, 2, 3).tail().collect()).toEqual([2, 3]);
  });
  test('concat(), append() should iterate the base iterator and given iterables', () => {
    expect(rgen(1, 2, 3).concat([4, 5], rgen(6, 7)).collect()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(rgen(1, 2, 3).append([4, 5], rgen(6, 7)).collect()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  test('prepend() should iterate given iterables and the base iterator', () => {
    expect(rgen(1, 2, 3).prepend([4, 5], rgen(6, 7)).collect()).toEqual([4, 5, 6, 7, 1, 2, 3]);
  });
  describe('zip()', () => {
    test('should iterate the base iterator and given iterators parallel', () => {
      expect(rgen(1, 2, 3).zip(rgen('a', 'b', 'c'), rgen(true, false, true)).collect()).toEqual([
        [1, 'a', true],
        [2, 'b', false],
        [3, 'c', true],
      ]);
    });
    test('should stop iterating if at least one of the iterators done', () => {
      expect(rgen(1, 2, 3).zip(rgen('a', 'b', 'c'), rgen(true, true)).collect()).toEqual([
        [1, 'a', true],
        [2, 'b', true],
      ]);
    });
  });
  test('scanWith() should iterate accumulative values of reducing', () => {
    expect(
      rgen('1', '2', '3')
        .scanWith((acc, curr) => acc + parseInt(curr), 0)
        .collect(),
    ).toEqual([1, 3, 6]);
  });
  describe('scan()', () => {
    test('should iterate accumulative values of reducing', () => {
      expect(
        rgen(1, 2, 3)
          .scan((acc, curr) => acc + curr)
          .collect(),
      ).toEqual([3, 6]);
    });
    test('should return an empty iterator if the base done', () => {
      expect(
        rgen<number>()
          .scan((acc, curr) => acc + curr)
          .collect(),
      ).toEqual([]);
    });
  });
  describe('asNonEmpty()', () => {
    test('returns a copy of the base iterator', () => {
      expect(rgen(1, 2, 3).asNonEmpty().collect()).toEqual([1, 2, 3]);
    });
    test('should throw if the base is empty', () => {
      expect(() => rgen().asNonEmpty()).toThrow();
    });
  });
  test('reverse() should iterate the base reversely', () => {
    expect(rgen(1, 2, 3).reverse().collect()).toEqual([3, 2, 1]);
  });
  describe('head()', () => {
    test('should return undefined for the empty iterator', () => {
      expect(rgen().head()).toBeUndefined();
    });
    test('should return the first value of the iterator', () => {
      expect(rgen(1, 2, 3).head()).toBe(1);
    });
  });
  test('collect() should consume the base iterator and returns an array', () => {
    expect(rgen(1, 2, 3).collect()).toEqual([1, 2, 3]);
  });
  test('reduceWith() should return reduced value', () => {
    expect(rgen(1, 2, 3).reduceWith((acc, curr) => acc + curr, 1)).toBe(7);
  });
  describe('reduce()', () => {
    test('should return reduced value', () => {
      expect(rgen(1, 2, 3).reduce((acc, curr) => acc + curr)).toBe(6);
    });
    test('should return undefined if the iterator is empty and no onEmpty callback given', () => {
      expect(rgen<number>().reduce((acc, curr) => acc + curr)).toBeUndefined();
    });
    test('should return result of onEmpty callback if the iterator is empty', () => {
      expect(
        rgen<number>().reduce(
          (acc, curr) => acc + curr,
          () => 20,
        ),
      ).toBe(20);
    });
  });
  describe('find()', () => {
    test('should return the first value which satisfies predicate', () => {
      expect(rgen(1, 2, 3, 4, 5).find((v) => v > 3)).toBe(4);
    });
    test('should return undefined if no value which satisfies predicate found', () => {
      expect(rgen(1, 2, 3, 4, 5).find((v) => v > 10)).toBeUndefined();
    });
  });
  describe('findIndex()', () => {
    test('should return the index of the value which satisfies predicate found', () => {
      expect(rgen(1, 2, 3, 4, 5).findIndex((v) => v > 2)).toBe(2);
    });
    test('should return -1 if no value which satisfies predicate found', () => {
      expect(rgen(1, 2, 3, 4, 5).findIndex((v) => v > 10)).toBe(-1);
    });
  });
  describe('every()', () => {
    test('should return true if all the values satisfy predicate', () => {
      expect(rgen(1, 2, 3, 4, 5).every((v) => v > 0)).toBe(true);
    });
    test('should return true if at least one of the values does not satisfy predicate', () => {
      expect(rgen(1, 2, -3, 4, 5).every((v) => v > 0)).toBe(false);
    });
  });
  describe('some()', () => {
    test('should return false if all the values do not satisfy predicate', () => {
      expect(rgen(1, 2, 3, 4, 5).some((v) => v < 0)).toBe(false);
    });
    test('should return true if at least one of the values satisfies predicate', () => {
      expect(rgen(1, 2, -3, 4, 5).some((v) => v < 0)).toBe(true);
    });
  });
  describe('champion()', () => {
    test('should return undefined if the iterator is empty', () => {
      expect(rgen<number>().champion((champion, challenger) => champion > challenger)).toBeUndefined();
    });
    test('should return a value which won to all challenger', () => {
      expect(rgen(1, 3, 2, 5, 4).champion((champion, challenger) => champion > challenger)).toBe(5);
    });
  });
  test('intoRgen() should create an generator from an iterable', () => {
    expect(intoRgen([1, 2, 3]).collect()).toEqual([1, 2, 3]);
  });
});
