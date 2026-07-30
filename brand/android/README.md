# ITC NoteScan — assets Android

## Splash screen (Android 12+, SplashScreen API)
O sistema recorta o ícone num círculo. Use:

- splash-icon-1152.png — 1152×1152, símbolo em 768×768, fundo transparente.
  Para windowSplashScreenAnimatedIcon SEM windowSplashScreenIconBackgroundColor.
- splash-icon-1152-onbg.png — 1152×1152, símbolo em 576×576 sobre círculo #003C3F.
  Use quando quiser o ícone com fundo próprio.
- splash-icon-1152-white.png — versão negativa, para fundo de splash escuro.
- branded-lockup-light-1200.png / -dark-1200.png — para windowSplashScreenBrandingImage
  (faixa inferior; o Android limita a altura, então o arquivo é largo e baixo).

    <style name="Theme.NoteScan.Splash" parent="Theme.SplashScreen">
      <item name="windowSplashScreenBackground">@color/notescan_splash_bg</item>
      <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
      <item name="windowSplashScreenBrandingImage">@drawable/branded_lockup</item>
      <item name="postSplashScreenTheme">@style/Theme.NoteScan</item>
    </style>

Fundo recomendado: #F5F0E8 (claro) ou #1B1B1B (escuro).

## Ícone do launcher
- adaptive-foreground-432.png — 432×432, símbolo em 264×264 (zona segura). Pareie com
  cor de fundo #003C3F ou #F5F0E8 no ic_launcher_background.
- ic-launcher-512.png — 512×512 para a Play Store.

## Splash de tela cheia (legado / preview de marca)
- splash-fullscreen-dark-1080x2400.png
- splash-fullscreen-light-1080x2400.png
Para densidades: reduza a partir destes; não amplie.

## Densidades a partir do 1152
mdpi 288 · hdpi 432 · xhdpi 576 · xxhdpi 864 · xxxhdpi 1152
