const fs = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");
const outputDirectory = path.join(projectRoot, "dist");
const staticFiles = [
    "index.html",
    "produtos.html",
    "checkout.html",
    "contactos.html",
    "criar-site.html",
    "entregas.html",
    "sobre.html",
    "products.json",
    "responsive.css",
    "site.js"
];
const staticDirectories = ["Logo", "img", "media"];

async function main() {
    await fs.rm(outputDirectory, { recursive: true, force: true });
    await fs.mkdir(outputDirectory, { recursive: true });

    for (const file of staticFiles) {
        await fs.copyFile(path.join(projectRoot, file), path.join(outputDirectory, file));
    }
    for (const directory of staticDirectories) {
        await fs.cp(path.join(projectRoot, directory), path.join(outputDirectory, directory), {
            recursive: true
        });
    }

    await fs.writeFile(path.join(outputDirectory, ".nojekyll"), "", "utf8");
    console.log(`Site estático preparado em ${outputDirectory}.`);
}

main().catch(error => {
    console.error("Falha ao preparar o site estático:", error);
    process.exitCode = 1;
});
