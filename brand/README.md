# ITC NoteScan — arquivos de marca (direção Mira)

Geometria: caixa 64×64, módulo 8u. Haste 8u, braço 22u, recuo 4u, miolo 18u raio 3u.
Variante "small" (haste 10u, miolo 16u raio 2u) para uso a 24px ou menos.

## symbol/
- notescan-symbol-color.svg — principal (cantos #008F95, miolo #003C3F)
- notescan-symbol-cyan.svg — ciano chapado
- notescan-symbol-black.svg — monocromático preto puro
- notescan-symbol-white.svg — negativa
- notescan-symbol-dark-bg.svg — versão para fundo escuro (#30A5AB + #F5F0E8)
- notescan-symbol-small-*.svg — desenho ajustado para <=24px

## lockup/
- notescan-lockup-horizontal-*.svg — padrão; vão símbolo↔texto = 12u a partir da TINTA do símbolo (x=60). O símbolo já
carrega 4u de recuo interno na caixa 64 — some os dois e o vão aparente é 16u.
- notescan-lockup-stacked-*.svg — empilhado, para espaços estreitos
Sufixos: color (fundo claro), black, white, dark-bg (fundo escuro).

O texto dos lockups usa <text> com Archivo (600 / 800) e textLength travado, então a
caixa nunca corta o nome mesmo sem a fonte instalada — mas o desenho das letras muda.
Para impressão, terceiros ou e-mail, converta o texto em curvas (Illustrator/Figma:
Criar contornos) ou use os PNGs @4x em lockup/.

Caixa do lockup horizontal: 267×64 (viewBox 0 0 267 64), medida com Archivo real.

## android/
Assets de splash e launcher — ver android/README.md.

## app-icon/
- notescan-appicon-deep.svg / -cyan.svg / -cream.svg — tile 64 com raio 14, símbolo a 70%
- notescan-appicon-180.png — Apple touch icon
- notescan-appicon-512.png / -512-cyan.png — PWA / manifest

## favicon/
- favicon.ico — 16 + 32 + 48 em um arquivo
- favicon-16/32/48/64.png
- favicon-white-32.png — para abas de tema escuro

Snippet:
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
    <link rel="apple-touch-icon" href="/notescan-appicon-180.png">

## Cores
#008F95 ciano ITC · #30A5AB claro · #006C72 escuro · #003C3F profundo
#1B1B1B texto · #F5F0E8 fundo claro
