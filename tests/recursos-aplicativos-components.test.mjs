import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const fileUrl = (path) => new URL(path, root);
const read = (path) => readFile(fileUrl(path), "utf8");
const exists = (path) => existsSync(fileUrl(path));

const expectedFiles = [
  "src/pages/recursos/aplicativos/index.astro",
  "src/components/catalogo/CatalogAppCard.astro",
  "src/components/catalogo/CatalogSoftBadge.astro",
  "src/components/catalogo/CatalogBundleBanner.astro",
  "src/components/catalogo/CatalogoContent.astro",
  "src/components/enlaces/EnlacesContent.astro",
  "src/components/ui/AnnouncementBanner.astro",
];

for (const path of expectedFiles) {
  assert.ok(exists(path), `Expected ${path} to exist`);
}

const catalogPage = await read("src/pages/recursos/aplicativos/index.astro");
const catalogContent = await read(
  "src/components/catalogo/CatalogoContent.astro",
);
const appCard = await read(
  "src/components/catalogo/CatalogAppCard.astro",
);
const bundleBanner = await read(
  "src/components/catalogo/CatalogBundleBanner.astro",
);
const enlacesContent = await read(
  "src/components/enlaces/EnlacesContent.astro",
);
const announcementBanner = await read(
  "src/components/ui/AnnouncementBanner.astro",
);

// La pagina es un shell: delega todo el catalogo al server island.
assert.match(catalogPage, /<CatalogoContent\s+server:defer/);
assert.match(catalogPage, /<CatalogoSkeleton\s+slot="fallback"/);

// Los componentes se consumen desde CatalogoContent, no desde la pagina.
assert.match(
  catalogContent,
  /import\s+CatalogAppCard\s+from\s+"\.\/CatalogAppCard\.astro"/,
);
assert.match(
  catalogContent,
  /import\s+CatalogBundleBanner\s+from\s+"\.\/CatalogBundleBanner\.astro"/,
);

// Contrato de props: caller y callee deben seguir hablando el mismo idioma.
assert.match(catalogContent, /<CatalogAppCard[\s\S]*?\bid=\{app\.id\}/);
assert.match(catalogContent, /<CatalogAppCard[\s\S]*?\btitle=\{app\.title\}/);
assert.match(
  catalogContent,
  /<CatalogBundleBanner[\s\S]*?title=\{bundle\.title\}[\s\S]*?description=\{bundle\.description[\s\S]*?filePath=\{bundle\.filePath\}/,
);
assert.match(bundleBanner, /interface\s+Props\s*\{[\s\S]*?title:\s*string;[\s\S]*?description:\s*string;[\s\S]*?filePath\?:\s*string\s*\|\s*null;[\s\S]*?\}/);
assert.match(appCard, /interface\s+Props\s*\{[\s\S]*?\bid:\s*number;[\s\S]*?\btitle:\s*string;[\s\S]*?\}/);

// Las credenciales se revelan con details/summary (progressive disclosure
// nativo), no con un dropdown custom.
assert.match(appCard, /<details[\s\S]*<summary/);
assert.match(appCard, /data-password-input/);

// Boton deshabilitado "Pendiente": fuera del orden de tabulacion.
assert.match(appCard, /tabindex="-1"/);
assert.match(appCard, /Pendiente/);

// La version se muestra con el badge reutilizable, no con markup suelto.
assert.match(appCard, /<CatalogSoftBadge\s+tone="neutral"/);

// Estados del banner de paquete.
assert.match(bundleBanner, /Descargar \.zip/);
assert.match(bundleBanner, /Disponible pronto/);

// El CTA al catalogo se compone con AnnouncementBanner.
assert.match(enlacesContent, /<AnnouncementBanner\b/);
assert.match(enlacesContent, /href=\{`\$\{cleanBase\}recursos\/aplicativos`\}/);
assert.doesNotMatch(enlacesContent, /catalogo-aplicativos-cta-title/);

// AnnouncementBanner expone exactamente las props que EnlacesContent pasa.
assert.match(
  announcementBanner,
  /interface\s+Props\s*\{[\s\S]*?title:\s*string;[\s\S]*?description:\s*string;[\s\S]*?badgeLabel\?:\s*string;[\s\S]*?href:\s*string;[\s\S]*?ctaLabel:\s*string;[\s\S]*?tone\?:\s*BannerTone;[\s\S]*?\}/,
);

// Los aplicativos en el catalogo se ordenan por sortOrder y title
assert.match(
  catalogContent,
  /\.orderBy\(\s*asc\(applications\.sortOrder\),\s*asc\(applications\.title\),?\s*\)/s,
);

