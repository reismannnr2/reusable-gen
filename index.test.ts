import { reusable, ReusableGenerator } from './index';

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
});
