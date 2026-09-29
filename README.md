# ◈ Project Crown

A small pixel-art resource trading game for the browser. Buy goods in one regional market, switch to another market, and sell where the price is better. Spend profits on a bigger warehouse so you can carry more cargo.

## Run locally

```bash
npm start
```

Open [http://localhost:5173](http://localhost:5173). No build step is required.

## The game

- **Trade:** Buy and sell nine basic goods at four regional exchanges.
- **Prices:** Regional prices differ and move every 12 seconds. The exchange shows the best current price gaps.
- **Cargo:** Goods take one cargo space each. Selling a good realizes profit or loss against its average purchase price.
- **Infrastructure:** Upgrade one thing—the warehouse—to increase your cargo capacity.
- **Save:** Cash, cargo, warehouse level, and trade history are stored locally in the browser.

The UI is vanilla JavaScript and HTML/CSS. KaboomJS draws the small pixel-art regional route map.

## Files

- `index.html` — game screen
- `css/style.css` — pixel-terminal visual style
- `js/trader.js` — simple market, cargo, trade, warehouse, save, and map logic
- `js/vendor/kaboom.mjs` — vendored KaboomJS browser engine
- `docs/GDD.md` — concise game design
