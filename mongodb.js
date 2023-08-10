// Select the database to use.
use('hml-app');

// Here we run an aggregation and open a cursor to the results.
// Use '.toArray()' to exhaust the cursor to return the whole result set.
// You can use '.hasNext()/.next()' to iterate through the cursor page by page.
db.getCollection('answer').count({
    $expr: {
        $and: [
            { 
                $gt: [
                    { 
                        $ifNull: [ 
                            `$updated_at`, '$updatedAt', `$created_at`, '$createdAt', 
                            { $convert: { input: `$_id`, to: 'date', onError: new Date(), onNull: new Date() } }
                        ]
                    }, 
                    new Date(0)
                ] 
            },
            { 
                $lte: [
                    { 
                        $ifNull: [
                            `$updated_at`,  '$updatedAt',  `$created_at`, '$createdAt', 
                            { $convert: { input: `$_id`, to: 'date', onError: new Date(), onNull: new Date() } }
                        ]
                    }, 
                    new Date()
                ]
            }
        ]
    }
})