import { describe, expect, it } from "vitest";
import { productImageSources } from "../src/product-image";

const image = "https://images.openfoodfacts.org/images/products/890/449/120/0777/front_en.3.400.jpg";
describe("product thumbnail loading", () => {
  it("offers smaller revision-matched OFF thumbnails and preserves the original for details", () => {
    expect(productImageSources(image, "small")).toEqual({ src: image.replace(".400.", ".100."), srcSet: `${image.replace(".400.", ".100.")} 1x, ${image.replace(".400.", ".200.")} 2x` });
    expect(productImageSources(image, "large")).toEqual({ src: image, srcSet: undefined });
  });
  it.each(["https://example.com/front_en.3.400.jpg", "https://images.openfoodfacts.org.evil.test/images/products/123/front_en.3.400.jpg", "https://images.openfoodfacts.org/images/products/123/3.jpg"])("keeps unsupported image URLs intact: %s", (url) => {
    expect(productImageSources(url, "small")).toEqual({ src: url, srcSet: undefined });
  });
});
