export function productImageSources(url: string, size: "small" | "large") {
  if (size === "large" || !/^https:\/\/images\.openfoodfacts\.org\/images\/products\/[\d/]+\/front_[a-z0-9_-]+\.\d+\.(100|200|400)\.jpg$/i.test(url)) return { src: url, srcSet: undefined };
  const thumbnail = (pixels: number) => url.replace(/\.(100|200|400)\.jpg$/i, `.${pixels}.jpg`);
  return { src: thumbnail(100), srcSet: `${thumbnail(100)} 1x, ${thumbnail(200)} 2x` };
}
