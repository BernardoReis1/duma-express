const fs = require("node:fs/promises");
const path = require("node:path");
const { createServer } = require("../server");

async function main() {
    const server = createServer();
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });

    try {
        const address = server.address();
        const response = await fetch(`http://127.0.0.1:${address.port}/api/products`);
        if (!response.ok) {
            throw new Error(`Não foi possível exportar o catálogo: HTTP ${response.status}.`);
        }

        const catalog = await response.json();
        if (!Array.isArray(catalog.products)) {
            throw new Error("O catálogo recebido do servidor é inválido.");
        }

        await fs.writeFile(
            path.join(__dirname, "..", "products.json"),
            `${JSON.stringify(catalog, null, 2)}\n`,
            "utf8"
        );
        console.log(`Catálogo exportado: ${catalog.products.length} produtos.`);
    } finally {
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
    }
}

main().catch(error => {
    console.error("Falha ao exportar o catálogo:", error);
    process.exitCode = 1;
});
