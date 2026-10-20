const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createServer } = require("../server");

async function startTestServer(t) {
    const dataDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "duma-express-test-"));
    const server = createServer({ dataDirectory });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    t.after(async () => {
        server.closeAllConnections();
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
        await fs.rm(dataDirectory, { recursive: true, force: true });
    });
    return {
        baseUrl: `http://127.0.0.1:${address.port}`,
        dataDirectory
    };
}

async function postJson(baseUrl, endpoint, body) {
    return fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}

test("serve as páginas e protege os ficheiros internos", async t => {
    const { baseUrl } = await startTestServer(t);
    const page = await fetch(`${baseUrl}/`);
    const internalFile = await fetch(`${baseUrl}/server.js`);

    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    assert.equal(internalFile.status, 404);
    const siteRequestPage = await fetch(`${baseUrl}/criar-site.html`);
    assert.equal(siteRequestPage.status, 200);
    assert.match(await siteRequestPage.text(), /moscovodollar@gmail\.com/);
});

test("serve um catálogo de marcas com as imagens não repetidas", async t => {
    const { baseUrl } = await startTestServer(t);
    const response = await fetch(`${baseUrl}/api/products`);
    const { products } = await response.json();
    const polo = products.find(product => product.brand === "Polo Ralph Lauren");
    const longrich = products.find(product => product.brand === "Longrich");
    const image = await fetch(`${baseUrl}/${polo.image}`);

    assert.equal(response.status, 200);
    assert.ok(products.length > 50);
    assert.ok(polo);
    assert.ok(longrich);
    assert.equal(longrich.quoteRequired, true);
    assert.equal(longrich.price, null);
    assert.equal(image.status, 200);
    assert.match(image.headers.get("content-type"), /image\/jpeg/);
});

test("regista inscrições uma só vez, sem diferenciar maiúsculas", async t => {
    const { baseUrl, dataDirectory } = await startTestServer(t);
    const first = await postJson(baseUrl, "/api/newsletter", { email: "Loja@Example.com" });
    const duplicate = await postJson(baseUrl, "/api/newsletter", { email: "loja@example.com" });
    const invalid = await postJson(baseUrl, "/api/newsletter", { email: "email-invalido" });
    const records = await fs.readFile(path.join(dataDirectory, "newsletter.jsonl"), "utf8");

    assert.equal(first.status, 201);
    assert.equal(duplicate.status, 200);
    assert.equal(invalid.status, 400);
    assert.equal(records.trim().split(/\r?\n/).length, 1);
});

test("valida e persiste pedidos com preços definidos pelo servidor", async t => {
    const { baseUrl, dataDirectory } = await startTestServer(t);
    const response = await postJson(baseUrl, "/api/orders", {
        name: "Cliente Teste",
        email: "cliente@example.com",
        items: [{ name: "Sandália Hermes", quantity: 2, price: 1 }]
    });
    const result = await response.json();
    const unavailable = await postJson(baseUrl, "/api/orders", {
        name: "Cliente Teste",
        email: "cliente@example.com",
        items: [{ name: "Pasta executiva", quantity: 1 }]
    });
    const quoteRequired = await postJson(baseUrl, "/api/orders", {
        name: "Cliente Teste",
        email: "cliente@example.com",
        items: [{ name: "Produto Longrich 01", quantity: 1 }]
    });

    assert.equal(response.status, 201);
    assert.equal(result.order.total, 6000);
    assert.equal(result.order.items[0].price, 3000);
    assert.equal(unavailable.status, 400);
    assert.equal(quoteRequired.status, 400);
    const records = await fs.readFile(path.join(dataDirectory, "orders.jsonl"), "utf8");
    assert.equal(JSON.parse(records).total, 6000);
});

test("regista mensagens de contacto válidas", async t => {
    const { baseUrl, dataDirectory } = await startTestServer(t);
    const response = await postJson(baseUrl, "/api/contact", {
        name: "Cliente Teste",
        email: "cliente@example.com",
        subject: "Informação",
        message: "Gostaria de saber mais sobre o produto."
    });
    const result = await response.json();

    assert.equal(response.status, 201);
    assert.ok(result.contactId);
    const records = await fs.readFile(path.join(dataDirectory, "contacts.jsonl"), "utf8");
    assert.equal(JSON.parse(records).message, "Gostaria de saber mais sobre o produto.");
});

test("valida e guarda pedidos para criação de sites", async t => {
    const { baseUrl, dataDirectory } = await startTestServer(t);
    const response = await postJson(baseUrl, "/api/site-requests", {
        name: "Cliente Teste",
        email: "cliente@example.com",
        phone: "+244 900 000 000",
        business: "Loja de teste",
        projectType: "Loja online",
        budget: "100.000–300.000 Kz",
        details: "Preciso de uma loja online para apresentar os meus produtos."
    });
    const result = await response.json();
    const invalid = await postJson(baseUrl, "/api/site-requests", {
        name: "A",
        email: "email inválido",
        projectType: "",
        details: "curto"
    });

    assert.equal(response.status, 201);
    assert.ok(result.requestId);
    assert.equal(invalid.status, 400);
    const records = await fs.readFile(path.join(dataDirectory, "site-requests.jsonl"), "utf8");
    assert.equal(JSON.parse(records).business, "Loja de teste");
});
