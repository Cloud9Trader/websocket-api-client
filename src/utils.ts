const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";

export const randomKey = (length?: number) => {
    const string = [];
    length = length || 5;
    while (length > 0) {
        string.push(chars.charAt(Math.floor(Math.random() * 61)));
        length--;
    }
    return string.join("");
};

export const getHMACHeaders = (key, secret, path, data?) => {
    const crypto = require("crypto");
    const buffer = Buffer.from(secret, "base64");
    const hmac = crypto.createHmac("sha256", buffer);

    const nonce = Date.now().toString(10);

    hmac.write(path);
    if (data) hmac.write(JSON.stringify(data));
    hmac.write(nonce);

    hmac.end();

    const signature = hmac.read().toString("hex");

    return {
        "x-c9t-key": key,
        "x-c9t-nonce": nonce,
        "x-c9t-signature": signature
    };
};
