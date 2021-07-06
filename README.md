# reusable-gen

utility class for make generator reusable

## Overview

`reusable-gen` is a very small library to use generators as reusable list.

JS-TS generators are very useful for lazy evaluation, but also stateful and non-reusable.

Think, you want to pass lazy-evaluating list for some functions or object:

```javascript
// yields 1, 2, 3, 4, 5
const gen = (function*(){ for (let i = 0; i < 5; i++) { yield i; } })();

const foo = (gen) => [...gen];
const bar = (gen) => { for(const value of gen) { console.log(value); } }

console.log(foo(gen)); // prints [0, 1, 2, 3, 4]
bar(gen); // prints none! nothing is logged since gen is already consumed.
```

The most simple solution is pre-evaluate generator and convert into an array.
That's very simple but in some case we can't or don't want to do that, 
for example, want to keep lazy evaluation or treating infinite list.

That's this library is for.

```javascript
import { reusable } from 'reusable-gen';
const gen = reusable((function*(){ for (let i = 0; i < 5; i++) { yield i; } })());

const foo = (gen) => [...gen];
const bar = (gen) => { for(const value of gen) { console.log(value); } }

console.log([...gen]); //logs [0, 1, 2, 3, 4]
console.log(foo(gen.use())); // logs [0, 1, 2, 3, 4]
bar(gen.use()); // logs 0, 1, 2, 3, 4, 5

// also we can use "rest" values of list.
const base = gen.use();
// discard some values
gen.next();
gen.next();
const rest = gen.rest();
console.log([...rest]); // logs [2, 3, 4]
console.log([...rest.use()]); // logs [2, 3, 4]
```

## Install

```
npm install @reismannnr2/reusable-gen
```

or if you prefer yarn to npm

```
yarn add @reismannnr2/reusable-gen
```

## Usage

Just wrap generator instance with reusable() and call ReusableGenerator#use() method when you want to iterate from first element.

If you want to create a child generator which iterates "rest" values of parent generator, then call ReusableGenerator#rest() after some values popped from parent.

```javascript
import { reusable } from 'reusable-gen';
const base = reusable((function*(){ for (let i = 0; i < 5; i++) { yield i; } })());

// all children created by use() iterates from first values.
console.log([...base.use()]);  // [0, 1, 2, 3, 4]
console.log([...base.use()]);  // [0, 1, 2, 3, 4]
console.log([...base.use()]);  // [0, 1, 2, 3, 4]

const parent = base.use();

// discard some elements.
parent.next();
parent.next();

const child = parent.rest();
console.log([...child.use()]); // [2, 3, 4];
console.log([...child.use()]); // [2, 3, 4];

// be careful, since base is already called by many descendants, so base.rest() iterates nothing.
console.log([...base.rest()]) // []

// but you can iterate from first by base.use():
console.log([...base.use()]);
```

## Array-like methods

Some array-like methods like map() and filter(), etc are provided.

See the doc comment for details.

## let method

I added `let()` method for this class. It takes a function which takes `this` as an argument,
and just call it and return the result of it.

It allows you to a function which takes `ReusableGenerator<T>` as an argument.

```typescript
// We can't define such method for ReusableGenerator<number> since TypeScript doesn't have specialization.
// but...
function max(gen: ReusableGenerator<number>): number | undefined {
  return gen.champion((champ, challenger) => champ >= challenger);
}

// with let you can call the function in method chain.
const maxItem = rgen('1', '2', '3').map((v) => parseInt(v)).let(max);
```
