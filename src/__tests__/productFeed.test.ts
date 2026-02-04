import axios from "axios";
import { fetchAcpProducts } from "../logic/products";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock("../utils/environment", () => ({
    env: {
        SELLER_NAME: "Test Store",
        SELLER_URL: "https://teststore.com",
        RETURN_POLICY_URL: "https://teststore.com/returns",
        STORE_COUNTRY: "US",
        API_URL: "http://mock-api",
        SHOWCASE_COLLECTION: undefined
    }
}));

describe("ACP Product Feed", () => {
    beforeEach(() => {
        mockedAxios.get.mockResolvedValue({
            data: [
                {
                    identifier: "EGLD-123-01",
                    name: "Test NFT",
                    price: "10.5",
                    nonce: 1,
                    url: "https://media.com/image.png",
                    attributes: { description: "Test Description" }
                }
            ]
        });
    });

    it("should return products with all required ACP fields", async () => {
        const products = await fetchAcpProducts();

        expect(products[0]).toHaveProperty("item_id");
        expect(products[0]).toHaveProperty("is_eligible_search", true);
        expect(products[0]).toHaveProperty("is_eligible_checkout", true);
        expect(products[0]).toHaveProperty("url");
        expect(products[0]).toHaveProperty("brand", "Test Store");
        expect(products[0]).toHaveProperty("availability", "in_stock");
        expect(products[0]).toHaveProperty("group_id");
        expect(products[0]).toHaveProperty("seller_name", "Test Store");
        expect(products[0]).toHaveProperty("seller_url", "https://teststore.com");
        expect(products[0]).toHaveProperty("return_policy", "https://teststore.com/returns");
        expect(products[0]).toHaveProperty("target_countries", ["US"]);
        expect(products[0]).toHaveProperty("store_country", "US");
    });

    it("should format price as 'amount currency' string", async () => {
        const products = await fetchAcpProducts();
        expect(products[0].price).toBe("10.5 EGLD");
    });

    it("should set listing_has_variations to false for nonce 1", async () => {
        const products = await fetchAcpProducts();
        expect(products[0].listing_has_variations).toBe(false);
    });
});
