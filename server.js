import("./APIGROQ/server.js").catch((error) => {
    console.error("Nao foi possivel iniciar o servidor do AI Control:", error);
    process.exitCode = 1;
});