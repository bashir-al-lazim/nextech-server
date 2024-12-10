const express = require('express');
const cors = require('cors')
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()

//initialization
const app = express()
const port = process.env.PORT || 5000

//middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.SECRET_KEY}@inochi.zmivthc.mongodb.net/?retryWrites=true&w=majority&appName=Inochi`;
console.log(uri)

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        await client.connect();

        const productsCollection = client.db('NexTechDB').collection('products')
        const reviewsCollection = client.db('NexTechDB').collection('reviews')
        const usersCollection = client.db('NexTechDB').collection('users')

        const verifyToken = (req, res, next) => {
            console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        app.get('/products', async (req, res) => {
            const type = req.query?.type
            const id = req.query?.id
            if (type === 'featured') {
                query = { priority: 'featured' }
                const result = await productsCollection.find(query).sort({ date: -1 }).toArray()
                return res.send(result)
            }
            else if (type === 'trending') {
                const result = await productsCollection.find().sort({ upVote: -1 }).toArray()
                return res.send(result)
            }
            else if (id) {
                query = { _id: new ObjectId(id) }
                const result = await productsCollection.findOne(query)
                return res.send(result)
            }
            const result = await productsCollection.find().toArray()
            res.send(result)
        })

        app.get('/products/search', async (req, res) => {
            const keyword = req.query.keyword
            if (keyword) {
                const query = { tags: { $regex: new RegExp(keyword, "i") } };
                const products = await productsCollection.find(query).toArray();
                return res.send(products)
            }
            else {
                return res.status(400).send({ error: "Keyword is required for searching." });
            }
        })

        app.get('/reviews', async (req, res) => {
            const id = req.query?.id
            let query = {}
            if (id) {
                query = { productId: id }
            }
            const result = await reviewsCollection.find(query).toArray()
            res.send(result)
        })

        app.patch('/products/:id', async (req, res) => {
            const id = req.params.id
            const updates = req.body
            filter = { _id: new ObjectId(id) }
            const updateProduct = {
                $set: updates,
            };
            const result = await productsCollection.updateOne(filter, updateProduct);
            res.send(result)
        })

        app.post('/reviews', async (req, res) => {
            const review = req.body
            const result = await reviewsCollection.insertOne(review);
            res.send(result)
        })

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if user doesnt exists: 
            // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token: token });
        })


    } finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('NexTech Server Running')
})

app.listen(port, () => {
    console.log('NexTech server is running on port: ', port)
})