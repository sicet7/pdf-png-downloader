const port = 3000;
const defaultUserAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.5173.0 Safari/537.36';
const hmacSecret = 'PlW89MfmR9VClx3IjtZubapl3dmVS7hG'

// Libraries
const puppeteer = require('puppeteer');
const express = require('express');
const crypto = require('crypto');
const { URL, parse } = require('url');
const app = express();

app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    },
}))
app.use(express.urlencoded({ extended: true }))

function stringIsAValidUrl(str) {
    try {
        new URL(str);
        const parsed = parse(str);
        return parsed.protocol
            ? ['http', 'https'].map(x => `${x.toLowerCase()}:`).includes(parsed.protocol)
            : false;
    } catch (err) {
        return false;
    }
}

app.post('/', async (req, res) => {
    const hmac = crypto.createHmac('sha256', hmacSecret);
    const userAgent = req.header('user-agent') || defaultUserAgent;
    const authHeader = req.header('authorization') || null;
    const requestBody = (typeof req.rawBody === 'string' ? req.rawBody : null);

    if (authHeader === null || authHeader.length === 0) {
        res.status(401).json({
            error: true,
            message: 'Missing "Authorization" header.'
        });
        return;
    }

    if (
        requestBody === null ||
        requestBody.length === 0 ||
        typeof req.body !== 'object' ||
        typeof req.body.url !== 'string' ||
        typeof req.body.type !== 'string'
    ) {
        res.status(400).json({
            error: true,
            message: 'Invalid request body.'
        });
        return;
    }

    hmac.write(requestBody);

    const requestDigest = hmac.digest().toString('hex');
    hmac.end();

    if (requestDigest !== authHeader) {
        res.status(403).json({
            error: true,
            message: 'Request body digest mismatch.'
        });
        return;
    }

    if (!stringIsAValidUrl(req.body.url)) {
        res.status(400).json({
            error: true,
            message: 'Invalid url passed in request body.'
        });
        return;
    }

    const browser = await puppeteer.launch({ headless: true });

    try {
        const page = await browser.newPage();
        page.setUserAgent(userAgent);
        await page.goto(req.body.url, {
            waitUntil: 'networkidle2',
        });

        let value = null;
        switch (req.body.type) {
            case 'image':
                value = await page.screenshot({ fullPage: true });
                res.set({'Content-Type': 'image/png'});
                break;
            case 'pdf':
                value = await page.pdf({ format: 'A4' });
                res.set({'Content-Type': 'application/pdf'});
                break;
            default:
                res.status(400).json({
                    error: true,
                    message: 'Unknown type. "' + req.body.type + '" is not a known type.'
                });
                return;
        }

        if (value === null) {
            res.status(500).json({
                error: true,
                message: 'Switch match fall-through.'
            });
            return;
        }

        res.set({ 'Content-Length': value.length });
        res.send(value);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: true,
            message: 'Unknown error occurred.'
        });
    } finally {
        await browser.close();
    }
})

app.listen(port, () => {
    console.log(`Server started listening on port: ${port}`)
})
