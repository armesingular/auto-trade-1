const SYMBOL = 'bnbusd_perp';
const chalk = require('chalk');
const async = require('async');
//````

const api = require('./lib/api');
const { SELL, BUY } = require('./lib/api');

const MAX_GRIDs = 5;
const STEP = 0.25;

let markPrice = -1;

api.coinMStream(SYMBOL, (err, result) => {
    if (err != null) console.error(err);
    else {
        const data = result.data;
        switch (data.e) {
            case 'markPriceUpdate':
                {
                    //const time = new Date(data.E).toLocaleString();
                    if (markPrice < 0) {
                        markPrice = parseFloat(data.p);
                        const price = Math.round(markPrice * 1000) / 1000;
                        console.log('MARK:', price);

                        // buildOrders(price, 0, (err, result) => {
                        //     if (err) console.error(err);
                        //     else console.log('Initialized GRIDs');
                        // });

                        // pairOrders(price, (err, result) => {
                        //     if (err) console.error(err);
                        //     else console.log('Initialized GRIDs');
                        // });
                    }
                }
                break;
            case 'bookTicker':
                break;
            default:
                console.log(data);
        }

    }
});

const buildOrders = (price, quantity, done) => {
    quantity = parseInt(quantity);
    price = parseFloat(price);

    const allocGrids = (qty) => Array.from({ length: MAX_GRIDs - qty }, (_, k) => k + qty + 1);
    const buys = (allocGrids, quantity, price, done) => {
        const initGrids = allocGrids(quantity);
        const prices = initGrids.map((_, i) => price - ((i + 1) * STEP));
        api.placeBuyOrders(SYMBOL, prices, done);
    }
    const sells = (allocGrids, quantity, price, done) => {
        const initGrids = allocGrids(Math.abs(quantity));
        const prices = initGrids.map((_, i) => price + ((i + 1) * STEP));
        api.placeSellOrders(SYMBOL, prices, done);
    }


    if (quantity < 0) {
        const ss = (done) => sells(allocGrids, quantity, price, done);
        const bs = (done) => buys(allocGrids, 0, price, done);
        async.parallel([ss, bs], done);
    }
    if (quantity > 0) {
        const ss = (done) => sells(allocGrids, 0, price, done);
        const bs = (done) => buys(allocGrids, quantity, price, done);
        async.parallel([ss, bs], done);
    }
    if (quantity == 0) {
        const ss = (done) => sells(allocGrids, 0, price, done);
        const bs = (done) => buys(allocGrids, 0, price, done);
        async.parallel([ss, bs], done);
    }
}

const pairOrders = (price, done) => {
    const bs = (done) => api.placeSellOrder(SYMBOL, price + STEP, done);
    const ss = (done) => api.placeBuyOrder(SYMBOL, price - STEP, done);
    async.parallel([ss, bs], done);
}

api.coinMEventsStream((err, result) => {
    if (err != null) console.error(err);
    else {
        const data = result.data;
        switch (data.e) {
            case 'ORDER_TRADE_UPDATE':
                {
                    const o = data.o;
                    if (o.X == 'FILLED') {
                        const price = parseFloat(o.p);
                        console.info(o.X, (o.S == BUY ? chalk.green('BUY') : chalk.red('SELL')), price);
                        // const cancelAll = (done) => api.cancelAll(SYMBOL, done);
                        // const placeOrders = (done) => buildOrders(entryPrice, quantity, done);
                        // async.series([cancelAll, placeOrders], (err, result) => {
                        //     if (err) console.error(err);
                        //     else {
                        //         if (false && Math.abs(quantity) == MAX_GRIDs) {
                        //             console.log('Do flip');
                        //             api.cancelAll(SYMBOL, (err, result) => {
                        //                 if (err) {
                        //                     console.error(err);
                        //                     process.exit(0);
                        //                 }
                        //                 else {
                        //                     const exit = (err, result) => {
                        //                         if (err) console.error(err);
                        //                         process.exit(0);
                        //                     }
                        //                     if (isBuy) api.marketSell(SYMBOL, MAX_GRIDs + 1, exit);
                        //                     else api.marketBuy(SYMBOL, MAX_GRIDs + 1, exit);;
                        //                 }
                        //             });
                        //         }
                        //     }
                        // });
                    }
                }
                break;
            case 'ACCOUNT_UPDATE':
                {
                    const time = new Date(data.E).toLocaleString();
                    const P = data.a.P.filter(p => p.s.toLowerCase() == SYMBOL);
                    if (P.length) {
                        const p = P[0];

                        const quantity = parseInt(p.pa);
                        const ep = Math.round(parseFloat(p.ep) * 1000) / 1000;
                        const entryPrice = (ep > 0 ? ep : markPrice);

                        const side = (quantity > 0 ? chalk.green('BUY') : (quantity < 0 ? chalk.red('SELL') : chalk.white('CLOSED')));
                        console.info('POSITION', side, entryPrice, quantity);

                        // const cancelAll = (done) => api.cancelAll(SYMBOL, done);
                        // const placeOrders = (done) => pairOrders(entryPrice, done);
                        // async.series([cancelAll, placeOrders], (err, result) => {
                        //     if (err) console.error(err);
                        //     else {

                        //     }
                        // });

                    }
                }
            default:
            //console.log(data);
        }


    }
});

