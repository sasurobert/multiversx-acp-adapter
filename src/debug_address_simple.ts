import { Address } from "@multiversx/sdk-core";

try {
    const a = new Address("erd1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruq0u46d0");
    console.log("Keys:", Object.keys(a));
    console.log("Prototype:", Object.getOwnPropertyNames(Object.getPrototypeOf(a)));
    console.log("Values:", JSON.stringify(a));
} catch (e) {
    console.error(e);
}
