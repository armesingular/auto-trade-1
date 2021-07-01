const WebSocket = require('ws');

const subscribeStream = (wsUrl, option, onChanged) => {
    const terminateWS = (ws) => {
        //console.log(`Terminating zombie futures WebSocket: ${ws.url}`);
        if (ws.readyState === WebSocket.OPEN) {
            ws.terminate();
            clearInterval(ws.pingPongId);
        }
    }

    const ws = new WebSocket(wsUrl);
    ws.on('open', _ => {
        const request = JSON.stringify(option);
        ws.send(request);
        ws.pingPongId = setInterval(() => {
            if (ws.isAlive) {
                ws.isAlive = false;
                if (ws.readyState === WebSocket.OPEN) ws.ping(_);
            }
            else terminateWS(ws);
        }, 30000);
    });
    ws.on('pong', _ => ws.isAlive = true);
    ws.on('error', (ws, err) => onChanged(err));
    ws.on('close', (code, reason) => onChanged({ isClosed: true }));
    ws.on('message', data => {
        ws.isAlive = true;

        const json = JSON.parse(data);
        if (json.id == option.id) onChanged(null, { data: { e: 'connected' } });
        else onChanged(null, json);
    });
}

const coinMStream = (symbol, done) => {
    const wsUrl = 'wss://dstream.binance.com/stream';
    const params = [
        symbol + '@markPrice@1s',
        symbol + '@bookTicker',
    ];
    const requestMarkPrice = { method: 'SUBSCRIBE', params: params, 'id': (+new Date()) }
    const onChanged = (err, result) => {
        if (err != null) {
            done(err);
            if (err.isClosed) subscribeStream(wsUrl, requestMarkPrice, onChanged);  //reconnecting
        }
        else done(err, result);
    }
    subscribeStream(wsUrl, requestMarkPrice, onChanged);
}


const { API_KEY, API_SECRET } = require('./credentials');
const SELL = 'SELL', BUY = 'BUY';
const BASE_URL = 'https://dapi.binance.com';
const HEADERS = {
    "User-Agent": "Mozilla/4.0 (compatible; Node Binance API)",
    "Content-type": "application/x-www-form-urlencoded",
    "X-MBX-APIKEY": API_KEY,
}
const METHOD = (type) => ({
    headers: HEADERS,
    //"body": "",
    "method": type,
    "mode": "cors"
});

const qs = require("querystring");
const fetch = require('node-fetch');
const crypto = require('crypto');

function signature(queryString) {
    return crypto
        .createHmac('sha256', API_SECRET)
        .update(queryString)
        .digest('hex');
}

const listOrders = (symbol, done) => {
    const ts = 'timestamp=' + (new Date()).getTime();
    const queryString = 'symbol=' + symbol + '&' + ts;
    const sig = signature(queryString);
    const url = BASE_URL + '/dapi/v1/openOrders?' + queryString + '&signature=' + sig;
    fetch(url, METHOD("GET"))
        .then(res => res.json())
        .then(json => json.code ? done(json) : done(null, json));
}

function serialize(obj) {
    const replacer1 = new RegExp('{', 'g');
    const replacer2 = new RegExp('"', 'g');
    const replacer3 = new RegExp('}', 'g');
    const json = JSON.stringify(obj);
    const rep1 = json.replace(replacer1, '%7B');
    const rep2 = rep1.replace(replacer2, '%22');
    const rep3 = rep2.replace(replacer3, '%7D');

    return rep3;
}

const placeOrders = (prices, side, symbol, done) => {
    if (prices.length) {
        prices = prices.map(p => Math.round(parseFloat(p) * 1000) / 1000);
        const batch = prices.map(p => ({
            symbol: symbol,
            type: 'LIMIT',
            side: side,
            quantity: "1",
            timeInForce: "GTC",
            price: p.toString(),
        }));

        const ts = '&timestamp=' + (new Date()).getTime();
        const recvWindow = '&recvWindow=5000';
        const queryString = 'batchOrders=' + serialize(batch) + ts;
        const signed = '&signature=' + signature(queryString);
        const url = BASE_URL + '/dapi/v1/batchOrders?' + queryString + signed;
        fetch(url, METHOD("POST"))
            .then(res => res.json())
            .then(json => json.code ? done(json) : done(null, json));
    }
    else done(null, {});
}

const placeSellOrders = (symbol, prices, done) => placeOrders(prices, SELL, symbol, done);

const placeBuyOrders = (symbol, prices, done) => placeOrders(prices, BUY, symbol, done);

const placeOrder = (side, price, symbol, done) => {
    price = parseFloat(price);
    const s = 'symbol=' + symbol;
    const type = '&type=' + 'LIMIT';
    const sd = '&side=' + side;
    const quantity = '&quantity=' + '1';
    const timeInForce = '&timeInForce=' + 'GTC';
    const p = '&price=' + price.toFixed(3).toString();
    const ts = '&timestamp=' + (new Date()).getTime();
    const queryString = s + type + sd + quantity + timeInForce + p + ts;
    const signed = '&signature=' + signature(queryString);
    const url = BASE_URL + '/dapi/v1/order?' + queryString + signed;
    fetch(url, METHOD('POST'))
        .then(res => res.json())
        .then(json => json.code ? done(json) : done(null, json));
}

const placeSellOrder = (symbol, price, done) => placeOrder(SELL, price, symbol, done);

const placeBuyOrder = (symbol, price, done) => placeOrder(BUY, price, symbol, done);

const market = (symbol, side, quantity, done) => {
    const s = 'symbol=' + symbol;
    const type = '&type=' + 'MARKET';
    const sd = '&side=' + side;
    const q = '&quantity=' + quantity.toString();
    const ts = '&timestamp=' + (new Date()).getTime();
    const queryString = s + type + sd + q + ts;
    const signed = '&signature=' + signature(queryString);
    const url = BASE_URL + '/dapi/v1/order?' + queryString + signed;
    fetch(url, METHOD('POST'))
        .then(res => res.json())
        .then(json => json.code ? done(json) : done(null, json));
}

const marketBuy = (symbol, quantity, done) => market(symbol, BUY, quantity, done);
const marketSell = (symbol, quantity, done) => market(symbol, SELL, quantity, done);

const cancelOrder = (symbol, orderId, done) => {
    const s = 'symbol=' + symbol;
    const o = '&orderId=' + orderId;
    const ts = '&timestamp=' + (new Date()).getTime();
    const queryString = s + o + ts;
    const signed = '&signature=' + signature(queryString);
    const url = BASE_URL + '/dapi/v1/order?' + queryString + signed;
    fetch(url, METHOD('DELETE'))
        .then(res => res.json())
        .then(json => json.code ? done(json) : done(null, json));
}

const cancelAll = (symbol, done) => {
    const s = 'symbol=' + symbol;
    const ts = '&timestamp=' + (new Date()).getTime();
    const queryString = s + ts;
    const signed = '&signature=' + signature(queryString);
    const url = BASE_URL + '/dapi/v1/allOpenOrders?' + queryString + signed;
    fetch(url, METHOD('DELETE'))
        .then(res => res.json())
        .then(json => json.code != 200 ? done(json) : done(null, json));
}

const listenKey = (done) => {
    const url = BASE_URL + '/dapi/v1/listenKey';
    fetch(url, METHOD("POST"))
        .then(res => res.json())
        .then(json => json.code ? done(json) : done(null, json));
}

const extendKey = (done) => {
    const url = BASE_URL + '/dapi/v1/listenKey';
    fetch(url, METHOD("PUT"))
        .then(res => res.json())
        .then(json => json.code ? done(json) : done(null, json));
}

const coinMEventsStream = (done) => {
    listenKey((err, result) => {
        if (err != null) done(err);
        else {
            const listenKey = result.listenKey;
            const wsUrl = 'wss://dstream.binance.com/ws/' + listenKey;
            const params = [
                '@account',
                '@balance',
            ];
            const option = { method: 'REQUEST', params: params, 'id': (+new Date()) }
            subscribeStream(wsUrl, option, (err, result) => {
                if (err != null) done(err);
                else done(null, result.data ? result : { data: result });
            });

            setInterval(_ => {
                //console.log('do extend');
                extendKey((err, result) => err ? console.error(err) : console.log('Extend Key OK'));
            }, 3300000 /**55 min */);
        }
    });
}


module.exports = {
    SELL: SELL,
    BUY: BUY,
    //subscribeStream: subscribeStream,
    coinMStream: coinMStream,
    coinMEventsStream: coinMEventsStream,
    //listenKey: listenKey,
    listOrders: listOrders,
    placeSellOrders: placeSellOrders,
    placeSellOrder: placeSellOrder,
    placeBuyOrders: placeBuyOrders,
    placeBuyOrder: placeBuyOrder,
    cancelOrder: cancelOrder,
    cancelAll: cancelAll,
    marketBuy: marketBuy,
    marketSell: marketSell
}
