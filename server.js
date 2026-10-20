const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");

const ROOT = __dirname;
const DATA_DIRECTORY = path.join(ROOT, "data");
const MAX_BODY_SIZE = 16 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

const BASE_PRODUCTS = [
    { name: "Sandália Hermes", brand: "Duma Collection", category: "Sandálias", description: "Conforto para todos os dias.", image: "media/catalog/sandalia-IMG-20260627-WA0021.jpg", price: 3000, previousPrice: 10000, available: true },
    { name: "Fato completo", brand: "Polo Ralph Lauren", category: "Roupas", description: "Um conjunto versátil para o teu estilo.", image: "media/catalog/roupa-IMG-20260706-WA0017.jpg", price: 3000, previousPrice: 10000, available: true },
    { name: "Pasta executiva", brand: "Duma Collection", category: "Pastas", description: "Espaço e organização para o dia a dia.", image: "media/catalog/pasta-IMG-20260706-WA0084.jpg", price: 3000, previousPrice: 10000, available: false },
    { name: "Mochila urbana", brand: "Duma Collection", category: "Pastas", description: "Um essencial prático para levar contigo.", image: "media/catalog/pasta-IMG-20260706-WA0070-1.jpg", price: 3000, previousPrice: 10000, available: false },
    { name: "Pasta casual", brand: "Duma Collection", category: "Pastas", description: "Um acessório funcional para qualquer ocasião.", image: "media/catalog/pasta-IMG-20260705-WA0007.jpg", price: 3000, previousPrice: 10000, available: true },
    { name: "Blusa clássica", brand: "Duma Collection", category: "Blusas", description: "Uma peça fácil de combinar.", image: "media/catalog/blusa-IMG-20260630-WA0015.jpg", price: 3000, previousPrice: 10000, available: true },
    { name: "Blusa essencial", brand: "Duma Collection", category: "Blusas", description: "Conforto e simplicidade para o teu guarda-roupa.", image: "media/catalog/blusa-IMG-20260630-WA0016.jpg", price: 3000, previousPrice: 10000, available: true },
    { name: "Blusa moderna", brand: "Duma Collection", category: "Blusas", description: "Um toque actual para o teu visual.", image: "media/catalog/blusa-IMG-20260630-WA0012.jpg", price: 3000, previousPrice: 10000, available: false },
    { name: "Blusa urbana", brand: "Duma Collection", category: "Blusas", description: "Uma escolha confortável para a cidade.", image: "media/catalog/blusa-IMG-20260630-WA0013.jpg", price: 3000, previousPrice: 10000, available: false },
    { name: "Pasta compacta", brand: "Duma Collection", category: "Pastas", description: "Leva o essencial contigo.", image: "media/catalog/pasta-IMG-20260705-WA0008.jpg", price: 3000, previousPrice: 10000, available: false },
    { name: "Blusa versátil", brand: "Duma Collection", category: "Blusas", description: "Uma peça para diferentes momentos.", image: "media/catalog/blusa-IMG-20260630-WA0014.jpg", price: 3000, previousPrice: 10000, available: false },
    { name: "Sandália casual", brand: "Duma Collection", category: "Sandálias", description: "Leveza e conforto em cada passo.", image: "media/catalog/sandalia-IMG-20260627-WA0023.jpg", price: 3000, previousPrice: 10000, available: false }
];

const IMAGE_COLLECTIONS = [
    { folder: "Longrinch Picture", category: "Beleza e bem-estar", singular: "Produto Longrich", brand: "Longrich", quoteRequired: true },
    { folder: "Blusas", category: "Blusas", singular: "Blusa", brand: "Duma Collection" },
    { folder: "Pastas", category: "Pastas", singular: "Pasta", brand: "Duma Collection" },
    { folder: "Roupas", category: "Roupas", singular: "Conjunto", brand: "Duma Collection" },
    { folder: "Sandalias", category: "Sandálias", singular: "Sandália", brand: "Duma Collection" },
    { folder: "Sapatos", category: "Sapatos", singular: "Sapato", brand: "Duma Collection" }
];

function jsonResponse(response, status, body) {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(body));
}

function readJsonBody(request) {
    return new Promise((resolve, reject) => {
        if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
            reject(Object.assign(new Error("O pedido deve usar application/json."), { status: 415 }));
            request.resume();
            return;
        }

        const chunks = [];
        let size = 0;
        let tooLarge = false;
        request.on("data", chunk => {
            size += chunk.length;
            if (size > MAX_BODY_SIZE) {
                tooLarge = true;
                chunks.length = 0;
                return;
            }
            if (!tooLarge) chunks.push(chunk);
        });
        request.on("end", () => {
            if (tooLarge) {
                reject(Object.assign(new Error("O conteúdo enviado excede o limite permitido."), { status: 413 }));
                return;
            }
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch {
                reject(Object.assign(new Error("O conteúdo enviado não é um JSON válido."), { status: 400 }));
            }
        });
        request.on("error", reject);
    });
}

function createServer({ dataDirectory = DATA_DIRECTORY, publicDirectory = ROOT } = {}) {
    let writeQueue = Promise.resolve();
    let subscribersLoaded = false;
    let subscriberLoadPromise;
    const subscriberEmails = new Set();
    let catalogPromise;

    async function getCatalog() {
        if (!catalogPromise) {
            catalogPromise = (async () => {
                const imageHashes = new Set();
                const mediaDirectory = path.join(publicDirectory, "media", "catalog");
                try {
                    for (const entry of await fs.readdir(mediaDirectory, { withFileTypes: true })) {
                        if (!entry.isFile()) continue;
                        const image = await fs.readFile(path.join(mediaDirectory, entry.name));
                        imageHashes.add(createHash("sha256").update(image).digest("hex"));
                    }
                } catch (error) {
                    if (error.code !== "ENOENT") throw error;
                }

                const products = BASE_PRODUCTS.map(product => ({ ...product, quoteRequired: false }));
                const productNames = new Set(products.map(product => product.name));

                for (const collection of IMAGE_COLLECTIONS) {
                    const directory = path.join(publicDirectory, "img", collection.folder);
                    let entries;
                    try {
                        entries = await fs.readdir(directory, { withFileTypes: true });
                    } catch (error) {
                        if (error.code === "ENOENT") continue;
                        throw error;
                    }

                    const images = entries
                        .filter(entry => entry.isFile() && /\.(?:jpe?g|png|webp)$/i.test(entry.name))
                        .sort((first, second) => first.name.localeCompare(second.name, "en"));
                    let sequence = 0;

                    for (const entry of images) {
                        const imagePath = path.join(directory, entry.name);
                        const image = await fs.readFile(imagePath);
                        const hash = createHash("sha256").update(image).digest("hex");
                        if (imageHashes.has(hash)) continue;
                        imageHashes.add(hash);
                        sequence += 1;

                        const isPoloOutfit = collection.folder === "Longrinch Picture" &&
                            entry.name === "IMG-20260715-WA0043.jpg";
                        const brand = isPoloOutfit ? "Polo Ralph Lauren" : collection.brand;
                        const category = isPoloOutfit ? "Roupas" : collection.category;
                        const singular = isPoloOutfit ? "Conjunto infantil" : collection.singular;
                        let name = `${singular} ${String(sequence).padStart(2, "0")}`;
                        while (productNames.has(name)) {
                            name = `${singular} ${String(++sequence).padStart(2, "0")}`;
                        }
                        productNames.add(name);
                        products.push({
                            name,
                            brand,
                            category,
                            description: `Colecção ${brand}. Consulta os detalhes e a disponibilidade com a nossa equipa.`,
                            image: `img/${encodeURIComponent(collection.folder)}/${encodeURIComponent(entry.name)}`,
                            price: collection.quoteRequired && !isPoloOutfit ? null : 3000,
                            previousPrice: collection.quoteRequired && !isPoloOutfit ? null : 10000,
                            available: true,
                            quoteRequired: collection.quoteRequired && !isPoloOutfit
                        });
                    }
                }

                return products;
            })();
        }
        return catalogPromise;
    }

    function persistRecord(fileName, record) {
        const operation = writeQueue.then(async () => {
            await fs.mkdir(dataDirectory, { recursive: true });
            await fs.appendFile(
                path.join(dataDirectory, fileName),
                `${JSON.stringify(record)}\n`,
                { encoding: "utf8", mode: 0o600 }
            );
        });
        writeQueue = operation.catch(() => {});
        return operation;
    }

    async function loadSubscribers() {
        if (subscribersLoaded) return;
        if (!subscriberLoadPromise) {
            subscriberLoadPromise = (async () => {
                try {
                    const contents = await fs.readFile(path.join(dataDirectory, "newsletter.jsonl"), "utf8");
                    for (const line of contents.split(/\r?\n/)) {
                        if (!line) continue;
                        const record = JSON.parse(line);
                        if (typeof record.email === "string") subscriberEmails.add(record.email);
                    }
                } catch (error) {
                    if (error.code !== "ENOENT") throw error;
                }
                subscribersLoaded = true;
            })();
        }
        await subscriberLoadPromise;
    }

    async function subscribe(email) {
        await loadSubscribers();
        const operation = writeQueue.then(async () => {
            if (subscriberEmails.has(email)) return false;
            await fs.mkdir(dataDirectory, { recursive: true });
            await fs.appendFile(
                path.join(dataDirectory, "newsletter.jsonl"),
                `${JSON.stringify({ email, createdAt: new Date().toISOString() })}\n`,
                { encoding: "utf8", mode: 0o600 }
            );
            subscriberEmails.add(email);
            return true;
        });
        writeQueue = operation.catch(() => {});
        return operation;
    }

    async function handleApi(request, response, pathname) {
        if (request.method === "GET" && pathname === "/api/health") {
            jsonResponse(response, 200, { status: "ok" });
            return;
        }

        if (request.method === "GET" && pathname === "/api/products") {
            jsonResponse(response, 200, { products: await getCatalog() });
            return;
        }

        if (request.method !== "POST") {
            jsonResponse(response, 404, { error: "Rota não encontrada." });
            return;
        }

        const body = await readJsonBody(request);
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            jsonResponse(response, 400, { error: "O corpo do pedido deve ser um objeto JSON." });
            return;
        }

        if (pathname === "/api/newsletter") {
            const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
            if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
                jsonResponse(response, 400, { error: "Indica um endereço de email válido." });
                return;
            }

            const created = await subscribe(email);
            jsonResponse(response, created ? 201 : 200, {
                message: created ? "Inscrição registada com sucesso." : "Este email já está inscrito."
            });
            return;
        }

        if (pathname === "/api/contact") {
            const name = typeof body.name === "string" ? body.name.trim() : "";
            const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
            const subject = typeof body.subject === "string" ? body.subject.trim() : "";
            const message = typeof body.message === "string" ? body.message.trim() : "";

            if (name.length < 2 || name.length > 120 ||
                email.length > 254 || !EMAIL_PATTERN.test(email) ||
                subject.length < 2 || subject.length > 160 ||
                message.length < 5 || message.length > 5000) {
                jsonResponse(response, 400, { error: "Verifica os dados do formulário de contacto." });
                return;
            }

            const record = {
                id: randomUUID(),
                name,
                email,
                subject,
                message,
                createdAt: new Date().toISOString()
            };
            await persistRecord("contacts.jsonl", record);
            jsonResponse(response, 201, {
                message: "Mensagem recebida com sucesso.",
                contactId: record.id
            });
            return;
        }

        if (pathname === "/api/site-requests") {
            const name = typeof body.name === "string" ? body.name.trim() : "";
            const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
            const phone = typeof body.phone === "string" ? body.phone.trim() : "";
            const business = typeof body.business === "string" ? body.business.trim() : "";
            const projectType = typeof body.projectType === "string" ? body.projectType.trim() : "";
            const budget = typeof body.budget === "string" ? body.budget.trim() : "";
            const details = typeof body.details === "string" ? body.details.trim() : "";

            if (name.length < 2 || name.length > 120 ||
                email.length > 254 || !EMAIL_PATTERN.test(email) ||
                phone.length > 40 || business.length > 160 ||
                projectType.length < 2 || projectType.length > 80 ||
                budget.length > 80 || details.length < 10 || details.length > 5000) {
                jsonResponse(response, 400, { error: "Verifica os dados do pedido para criação do site." });
                return;
            }

            const requestRecord = {
                id: randomUUID(),
                name,
                email,
                phone,
                business,
                projectType,
                budget,
                details,
                createdAt: new Date().toISOString()
            };
            await persistRecord("site-requests.jsonl", requestRecord);
            jsonResponse(response, 201, {
                message: "O teu pedido foi registado. Escolhe a aplicação para o rever e enviar.",
                requestId: requestRecord.id
            });
            return;
        }

        if (pathname === "/api/orders") {
            const name = typeof body.name === "string" ? body.name.trim() : "";
            const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
            if (name.length < 2 || name.length > 120 ||
                email.length > 254 || !EMAIL_PATTERN.test(email) ||
                !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
                jsonResponse(response, 400, { error: "Verifica os dados do cliente e os produtos do pedido." });
                return;
            }

            const catalogue = await getCatalog();
            const productsByName = new Map(
                catalogue.filter(product => !product.quoteRequired).map(product => [product.name, product])
            );
            const items = [];
            for (const item of body.items) {
                const product = item && typeof item.name === "string"
                    ? productsByName.get(item.name)
                    : undefined;
                const quantity = item?.quantity;
                if (!product || !product.available ||
                    !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
                    jsonResponse(response, 400, { error: "O carrinho contém um produto ou uma quantidade inválida." });
                    return;
                }
                items.push({ name: product.name, quantity, price: product.price });
            }

            const order = {
                id: randomUUID(),
                name,
                email,
                items,
                total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
                createdAt: new Date().toISOString()
            };
            await persistRecord("orders.jsonl", order);
            jsonResponse(response, 201, {
                message: "Pedido registado com sucesso.",
                order: {
                    id: order.id,
                    items: order.items,
                    total: order.total,
                    createdAt: order.createdAt
                }
            });
            return;
        }

        jsonResponse(response, 404, { error: "Rota não encontrada." });
    }

    async function serveStatic(request, response, pathname) {
        if (request.method !== "GET" && request.method !== "HEAD") {
            jsonResponse(response, 405, { error: "Método não permitido." });
            return;
        }

        let decodedPath;
        try {
            decodedPath = decodeURIComponent(pathname);
        } catch {
            jsonResponse(response, 400, { error: "Caminho inválido." });
            return;
        }

        const relativePath = decodedPath === "/" ? "index.html" : decodedPath.slice(1);
        const filePath = path.resolve(publicDirectory, relativePath);
        const relativeToRoot = path.relative(publicDirectory, filePath);
        if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot) ||
            relativePath.split(/[\\/]/).some(part => part.startsWith(".")) ||
            relativePath === "server.js" || relativePath === "package.json" ||
            relativePath.split(/[\\/]/)[0] === "data" ||
            relativePath.split(/[\\/]/)[0] === "node_modules") {
            jsonResponse(response, 404, { error: "Ficheiro não encontrado." });
            return;
        }

        const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()];
        if (!contentType) {
            jsonResponse(response, 404, { error: "Ficheiro não encontrado." });
            return;
        }

        try {
            const file = await fs.readFile(filePath);
            response.writeHead(200, {
                "Content-Type": contentType,
                "Content-Length": file.length,
                "X-Content-Type-Options": "nosniff"
            });
            response.end(request.method === "HEAD" ? undefined : file);
        } catch (error) {
            if (error.code === "ENOENT" || error.code === "EISDIR") {
                jsonResponse(response, 404, { error: "Ficheiro não encontrado." });
                return;
            }
            throw error;
        }
    }

    return http.createServer(async (request, response) => {
        let pathname;
        try {
            pathname = new URL(request.url, "http://localhost").pathname;
            if (pathname.startsWith("/api/")) {
                await handleApi(request, response, pathname);
            } else {
                await serveStatic(request, response, pathname);
            }
        } catch (error) {
            if (!response.headersSent) {
                jsonResponse(response, error.status || 500, {
                    error: error.status ? error.message : "Ocorreu um erro ao processar o pedido."
                });
            } else {
                response.destroy(error);
            }
            if (!error.status) console.error("Erro no servidor:", error);
        }
    });
}

if (require.main === module) {
    const port = Number(process.env.PORT || 3000);
    const server = createServer();
    server.listen(port, "0.0.0.0", () => {
        console.log(`Duma Express disponível em http://localhost:${port}`);
    });
}

module.exports = { createServer };
