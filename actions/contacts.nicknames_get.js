const TAG = path.basename(__filename, '.js');

module.exports = function(e) {
    return new Promise((resolve, reject) => {
        console.debug(TAG, e);
        let { parameters:p, fulfillment } = e;

        new Memory.Contact()
        .query({ 
            where: { first_name: p.name }, 
            orWhere: { last_name: p.name }
        })
        .fetch({ require: true })
        .then((contact) => {
            let alias = contact.get('alias');
            const responses = [
            `Io, ${p.name} la chiamo ${alias}`,
            `Il soprannome di ${p.name} è ${alias}`,
            `Chi? ${p.name}? Forse volevi dire ${alias}!`
            ];

            resolve({
                text: responses.getRandom()
            });
        })
        .catch((err) => {
            resolve({
                text: `Non so chi sia ${p.name}`
            });
        });
        
    });
};

