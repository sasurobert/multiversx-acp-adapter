import { Address } from "@multiversx/sdk-core";

const a = new Address("erd1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruq0u46d0");
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(a)));
console.log(Object.keys(a));
