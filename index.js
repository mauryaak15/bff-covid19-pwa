import { getData } from './helpers.mjs';
import express from 'express';
import cors from 'cors';

const whitelist = ['http://localhost:3000'];
const corsOptions = {
    origin: (origin, callback) => {
        if (whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
};

const app = express();
const port = process.env.PORT || 3000;

app.get('/getCases', cors(corsOptions), async (req, res) => {
    try {
        const data = await getData();
        res.json(data);
    } catch (e) {
        console.log(e.message);
        res.status(500).json({ msg: 'Something went wrong' });
    }
});

app.listen(port, () => {
    console.log(`app listening on port ${port}`);
});
