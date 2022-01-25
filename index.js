import { getData } from './helpers.mjs';
import express from 'express';
const app = express();
const port = 3000;

app.get('/getCases', async (req, res) => {
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
