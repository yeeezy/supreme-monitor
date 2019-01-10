const functions = require(`./system/functions.js`);
const config = require(`./system/config.js`);
const fs = require('fs');
const r = require('rethinkdbdash')({ host: "localhost", db: "supreme", port: XXXXX });
const moment = require('moment');
const snek = require('snekfetch');

global.r = r;

var totalProducts = [];
var loop = 0;
var queue = [];
var tot = 0;

r.table('cache').delete().run().then(() => {
    console.log(`[  SYS  ] Backlog emptied`)
}).catch(console.error);

setInterval(() => {
    console.log("[  SYS  ] Fetching products");
    functions.fetchProducts().then(products => {
        let totalNumbers = 0;
        console.log(`[  SYS  ] Checking Stock [L: ${loop}] [Q: ${queue.length}] [T: ${tot}]`);
        for (let i = 0; i < products.length; i++) {
            for (let ii = 0; ii < products[i].styles.length; ii++) {
                for (let iii = 0; iii < products[i].styles[ii].stock.length; iii++) {

                    let item = {
                        uid: `${products[i].id}${products[i].styles[ii].name.replace(/"/g, "'")}${products[i].styles[ii].stock[iii].name.replace(/"/g, "'")}`,
                        name: products[i].name,
                        id: products[i].id,
                        style: products[i].styles[ii].name.replace(/"/g, "'"),
                        size: products[i].styles[ii].stock[iii].name.replace(/"/g, "'"),
                        stock: products[i].styles[ii].stock[iii].stock_level
                    };

                    r.table('items').get(item.uid).run().then(returned => {
                        if (returned) {
                            functions.stockCheck(item, returned).then(instock => {
                                if (instock) { // In stock
                                    r.table('cache').get(item.uid).run().then(stockeddb => {
                                        if (!stockeddb) {
                                            let temp = {
                                                uid: item.uid,
                                                stock: 0,
                                                id: item.id
                                            };
                                            r.table('cache').insert(temp).run().then(stockinsert => {
                                                if (!queue.includes(item.id)) {
                                                    queue.push(item.id);
                                                }
                                                console.log(`[ CACHE ] (UID: ${item.uid}) Inserted into cache`);
                                                loop = 0;
                                                functions.update(item).then(() => {
                                                    console.log(`[  SYS  ] (UID: ${item.uid}) Item in stock -  Updating database`);
                                                }).catch(console.error);
                                            }).catch(console.error);
                                        }
                                    }).catch(console.error);
                                } else { // Out of stock
                                    functions.update(item).then(() => {
                                        console.log(`[ STOCK ] (UID: ${item.uid}) Item out of stock - Updated database`);
                                    }).catch(console.error);
                                }
                            });
                        } else {
                            functions.write(item).then(() => {
                                console.log(`[ STOCK ] (UID: ${item.uid}) New item in stock - Inserted to database`);
                            });
                        }
                    }).catch(console.error);
                }
            }
        }
    }).catch(console.error);

    loop++;
    tot++;

    if (loop == 3) {
        loop = 0;
        if (queue.length != 0) {
            let tempid = queue[0];
            r.table('cache').filter({ id: queue[0] }).run().then(results => {
                queue.shift();
                var dumpedstyle = [];
                var dumpedsize = [];
                snek.get(`https://www.supremenewyork.com/shop/${tempid}.json`).then(shop => {
                    for (let i = 0; i < results.length; i++) {
                        r.table('items').get(results[i].uid).run().then(updated => {
                            dumpedstyle.push(updated.style);
                            dumpedsize.push(updated.size);
                            if (i >= results.length - 1) {
                                dumpedstyleFinal = dumpedstyle.filter((elem, pos) => { return dumpedstyle.indexOf(elem) == pos; });
                                dumpedsizeFinal = dumpedsize.filter((elem, pos) => { return dumpedsize.indexOf(elem) == pos; });

                                if (dumpedstyleFinal.length >= 1) {
                                    let pre = shop.body.styles.filter(s => s.name == dumpedstyleFinal[0])[0].image_url;
                                    url = `https:${pre}`;
                                } else {
                                    let pre = shop.body.styles[0].image_url;
                                    url = `https:${pre}`;
                                }
                                let embed = {
                                    description: `**${updated.name}** - IN STOCK`,
                                    color: 16743856,
                                    thumbnail: { url },
                                    footer: { text: `In stock as of: ${moment().format('Do MMM YYYY, h:mm:ss a')}` },
                                    fields: [
                                        { name: "Sizes", value: dumpedsizeFinal.join("\n"), inline: true },
                                        { name: "Style", value: dumpedstyleFinal.join("\n"), inline: true }
                                    ]
                                };

                                snek.post(config.options.webhookURL).send({ embeds: [embed] }).then(() => {
                                    console.log(`[ ALERT ] (ID: ${tempid}) Embed dispatched`);

                                    r.table('cache').filter({ id: tempid }).delete().run().then(() => {
                                        console.log(`[ CACHE ] (ID: ${tempid}) Cleared from cache`);
                                    }).catch(console.error);
                                }).catch(console.error);
                            }
                        }).catch(console.error);
                    }
                }).catch(console.error);
            }).catch(console.error);
        }
    }
}, config.options.checkInt);


console.log(`[  SYS  ] Listening for new items and stock updates`);