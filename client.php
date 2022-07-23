<?php

//TODO: comment this in if you want to download the page as a image.
//file_put_contents(
//    __DIR__ . '/example.png',
//    downloadUrlAs(
//        'https://blog.risingstack.com/pdf-from-html-node-js-puppeteer/',
//        Type::IMAGE
//    )
//);

//TODO: comment if you don't want to download the page as a pdf.
file_put_contents(
    __DIR__ . '/example.pdf',
    downloadUrlAs(
        'https://blog.risingstack.com/pdf-from-html-node-js-puppeteer/',
        Type::PDF
    )
);
// --------------------------------------------
// --------------------------------------------
// -------- HTTP Client code below. -----------
// --------------------------------------------
// --------------------------------------------

const API_URL = 'http://localhost:3000/';
const API_SSL = false;

//The key in the server.js and this should match, it is used as authentication.
const HMAC_SECRET = 'PlW89MfmR9VClx3IjtZubapl3dmVS7hG';

enum Type: string
{
    case IMAGE = 'image';
    case PDF = 'pdf';
}

/**
 *
 * @param string $url The url you wish to download as PNG or PDF
 * @param Type $type Your choice whether PDF or PNG content should be returned.
 * @return string|null a string of the content from the API or null on failure.
 */
function downloadUrlAs(string $url, Type $type = Type::PDF): ?string
{
    $body = json_encode([
        'url' => $url,
        'type' => $type->value
    ], JSON_UNESCAPED_SLASHES);

    if (json_last_error() !== JSON_ERROR_NONE) {
        return null;
    }

    $hmac = hash_hmac('sha256', $body, HMAC_SECRET);
    if ($hmac === false) {
        return null;
    }

    $ch = curl_init();

    $responseHeaders = [];

    $curlOptions = [
        CURLOPT_URL => API_URL,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => API_SSL,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: ' . $hmac,
        ],
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HEADERFUNCTION => function ($curl, $header) use (&$responseHeaders) {
            $len = strlen($header);
            $header = explode(':', $header, 2);
            if (count($header) < 2) {
                return $len;
            }

            $responseHeaders[strtolower(trim($header[0]))][] = trim($header[1]);
            return $len;
        },
    ];
    curl_setopt_array($ch, $curlOptions);

    if (($data = curl_exec($ch)) === false) {
        curl_close($ch);
        return null;
    }
    curl_close($ch);
    return $data;
}