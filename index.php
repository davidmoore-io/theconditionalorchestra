<!doctype html>
<!--[if lt IE 7]>      <html class="no-js lt-ie9 lt-ie8 lt-ie7" lang=""> <![endif]-->
<!--[if IE 7]>         <html class="no-js lt-ie9 lt-ie8" lang=""> <![endif]-->
<!--[if IE 8]>         <html class="no-js lt-ie9" lang=""> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang=""> <!--<![endif]-->
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
        <title>The Conditional Orchestra</title>
        <meta name="description" content="">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="apple-touch-icon" href="apple-touch-icon.png">
        <link rel="stylesheet" href="src/styles/normalize.css">
        <link rel="stylesheet" href="src/styles/main.css">
    </head>
    <body>
        <!--[if lt IE 8]>
            <p class="browserupgrade">You are using an <strong>outdated</strong> browser. Please <a href="http://browsehappy.com/">upgrade your browser</a> to improve your experience.</p>
        <![endif]-->
        <main aria-role="main">
          <article class="wrapper">
              <h1>The Conditional Orchestra</h1>
              <p class="intro">By using the weather conditions in your local area The Conditional Orchestra plays original compositions all day every day. Play the sound of your location too:</p>
              <div class="cta" id="cta-user-location">
                  <button id="use-location-btn">Play my weather</button>
              </div>
              <p id="message-block" class="status-bar"></p>
              <div id="canvas-container" class="canvas-container">
              </div>
              <form id="form-coords" style="display: none">
                <h2>Enter your coordinates</h2>
                <label for="lat">Lattiude</label>
                <input type="text" id="lat">
                <label for="long">Longitude</label>
                <input type="text" id="long">
                <button id="form-coords-btn">Submit</button>
              </form>
          </article>
        </main>
        <footer class="footer wrapper">
            <h2>Credits</h2>
            <p>This project uses <a href="http://forecast.io/">Forecast.io</a> to obtain the weather data.</p>
            <p>The JavaScript library used to access the API can be found on <a href="https://github.com/iantearle/forecast.io-javascript-api">GitHub here</a>.</p>
            <p><a href="http://p5js.org/">P5.js</a> is used to generate the graphical interface and audio.</p>
            <p><a href="https://www.google.com/intx/en_uk/work/mapsearth/products/mapsapi.html">Google maps</a> is used to reverse Geocode the location information</p>
            <p>Musical Weathervane is written and maintained by <a href="https://github.com/rjbultitude">R.Bultitude</a></p>
        </footer>
        <script src="dist/scripts/app.js"></script>
    </body>
</html>
