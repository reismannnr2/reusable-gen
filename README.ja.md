# reusable-gen

ジェネレータを再利用可能にする小規模なユーティリティライブラリです。

## 概要

JavaScript, TypeScript のジェネレータは遅延評価などに便利ですが、内部状態を消費するともう他の場所で使えないため、所有権のようなものを管理する必要がありました。

```javascript
// yields 1, 2, 3, 4, 5
const gen = (function*(){ for (let i = 0; i < 5; i++) { yield i; } })();

const foo = (gen) => [...gen];
const bar = (gen) => { for(const value of gen) { console.log(value); } }

console.log(foo(gen)); // ログ: [0, 1, 2, 3, 4]
bar(gen); // foo がすでに消費しているので何も出力されない
```

配列にしてしまうなどすれば楽に解決できますが、無限リストなどではそれはできないですし、遅延評価したい場合にも困ります。
そういうケースでの利用を想定しています。

```javascript
import { reusable } from 'reusable-gen';
const gen = reusable((function*(){ for (let i = 0; i < 5; i++) { yield i; } })());

const foo = (gen) => [...gen];
const bar = (gen) => { for(const value of gen) { console.log(value); } }

console.log([...gen]); //ログ [0, 1, 2, 3, 4]
console.log(foo(gen.use())); // ログ [0, 1, 2, 3, 4]
bar(gen.use()); // ログ 0, 1, 2, 3, 4, 5

// 途中まで使って残りの値のリストを作ることもできる
const base = gen.use();
// いくつか捨てる
gen.next();
gen.next();
const rest = gen.rest();

// "残りのリスト" も use() で複製できる
console.log([...rest]); // ログ [2, 3, 4]
console.log([...rest.use()]); // ログ [2, 3, 4]
```

## Install

npm

```
npm install @reismannnr2/reusable-gen
```

yarn

```
yarn add @reismannnr2/reusable-gen
```

## Usage

単にジェネレータのインスタンスを reusable() でラップしてから使うだけです。親ジェネレータを別のところで消費したりすると正しく動かないので注意してください。

"ある程度消費した後の残りのリスト" を保持したい場合は、 "use()して消費した直後" に rest() することで残りのリストを作れます。

```javascript
import { reusable } from 'reusable-gen';
const base = reusable((function*(){ for (let i = 0; i < 5; i++) { yield i; } })());

// 何回でも最初からイテレーションできるよ
console.log([...base.use()]);  // [0, 1, 2, 3, 4]
console.log([...base.use()]);  // [0, 1, 2, 3, 4]
console.log([...base.use()]);  // [0, 1, 2, 3, 4]

const parent = base.use();

// いくつか捨てる
parent.next();
parent.next();


// "残り" も何度でもイテレーション可能
const child = parent.rest();
console.log([...child.use()]); // [2, 3, 4];
console.log([...child.use()]); // [2, 3, 4];

// base はすでに子孫から何度も使われてるのでそのまま rest() しても空だよ
console.log([...base.rest()]) // []

// use() するとまた最初から呼べて "残り" も作れるよ
console.log([...base.use()]); // [0, 1, 2, 3, 4]
const x = base.use();
x.next();
x.next();
x.next();
x.next();
console.log([...x.rest()]); // [4]
```

## 配列風メソッド

map(), filter() などの配列風のメソッドをあれこれ持っています。
詳細はDocコメントにて。
