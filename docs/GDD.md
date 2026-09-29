# Project Crown — Trading Game

## Pitch

A simple, real-time regional trading game. Buy low, sell high, grow your cash, and upgrade your warehouse. It is about moving goods between markets—not running a city.

## Core loop

1. Check commodity prices at the selected market.
2. Buy goods that are cheap, within your cash and cargo limits.
3. Switch to another market where those goods sell for more.
4. Sell cargo and watch realized profit.
5. Upgrade the warehouse to carry more goods per run.
6. Repeat as market prices move.

## Markets

Four markets have distinct price profiles:

- **Port Azure:** coastal imports and inexpensive fish.
- **Ironridge:** mining town with cheap coal, iron, and copper.
- **Greenvale:** farming valley with inexpensive grain and timber.
- **Crown City:** capital market with strong demand for tools.

Prices move every 12 seconds. Each market quotes a buy and sell price with a small spread.

## Goods

Grain, fish, timber, stone, coal, iron ore, copper, fuel, and tools. Goods use one cargo slot per unit. The trading board displays current prices and cargo held. Buy and sell quantities are directly editable.

## Infrastructure

There is one upgrade: the warehouse. Its level raises cargo capacity. Upgrade costs rise with each level; there are six levels.

## Money & saves

Start with ◈12,500. Buying goods deducts cash. Selling adds revenue and updates realized profit/loss using the average cost of the remaining stock. Progress is kept in local browser storage.

## Style & implementation

2D pixel-inspired exchange interface, small pixel route map, vanilla JavaScript UI, HTML Canvas powered by KaboomJS. Designed for a quick, readable browser game with minimal menus and no city-management systems.
