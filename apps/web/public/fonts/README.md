# Fontes Nexa

Coloque aqui os arquivos da fonte **Nexa** (Fontfabric — comercial, requer licença).

Arquivos esperados pelo @font-face declarado em `src/styles.css`:

- `Nexa-Regular.woff2`  (weight 400)
- `Nexa-Bold.woff2`     (weight 700)

Formato recomendado: **.woff2** (menor e suportado por todos os browsers modernos).
Se você só tiver .otf/.ttf, converta para .woff2 (ex: https://transfonter.org)
ou ajuste a declaração `@font-face` no styles.css para apontar para o formato que tiver.

Enquanto os arquivos não estiverem aqui, os textos com a classe `font-nexa`
caem no fallback (Inter / system-ui) automaticamente.
