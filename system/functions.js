const snek = require('snekfetch');
const config = require('./config.js');

r = global.r;

const funcs = [];

funcs.postStockUpdate = (item) => {
    return new Promise((resolve, reject) => {
        if (item.stock <= 0) {
            snek.post(config.options.webhookURL).send({
                title: "Stock Update on SupremeNewYork",
                description: ""
            }).then(res => {
                return resolve(res.body);
            }).catch(reject);
        } else if (item.stock >= 1) {
            snek.post(config.options.webhookURL).send({
                title: "Stock Update on SupremeNewYork",
                description: ""
            }).then(res => {
                return resolve(res.body);
            }).catch(reject);
        }
    });
};

funcs.fetchProducts = () => {
    return new Promise((resolve, reject) => {
        let products = [];
        let done = 0;

        snek.get(config.options.stock_endpoint).then(res => {
            Object.keys(res.body.products_and_categories).forEach((Category) => {
                let category = res.body.products_and_categories[Category];

                category.forEach(item => {
                    done++;
                    funcs.fetchStock(item.id).then(itemInfo => {
                        products.push({
                            category: item.category_name,
                            id: item.id,
                            name: item.name,
                            image: item.image_url_hi,
                            styles: itemInfo
                        });
        
                        if (products.length >= done) {
                            resolve(products);
                        }
                    }).catch(console.error);
                });
            });
        }).catch(reject);
    });
};

funcs.fetchStock = (id) => {
    return new Promise((resolve, reject) => {
        snek.get(`${config.options.item_endpoint}/${id}.json`).then(res => {
            let stock = res.body.styles.map(style => { return { name: style.name, stock: style.sizes }; });
            resolve(stock);
        }).catch(reject);
    });
};

funcs.write = (item) => {
    return new Promise((resolve, reject) => {
        r.table('items').insert(item).run().then(resolve).catch(reject);
    });
};

funcs.stockCheck = (newItem, oldItem) => {
    return new Promise((resolve, reject) => {
        if (oldItem.stock == 0 && newItem.stock == 1) {
            resolve(true);
        } else if (oldItem.stock == 1 && newItem.stock == 0) {
            resolve(false);
        }
    });
};

funcs.update = (item) => {
    return new Promise((resolve, reject) => {
        r.table('items').get(item.uid).update(item).run().then(resolve).catch(reject);
    });
};
module.exports = funcs;