'use strict';

angular.module('parserApp.display3dService', [])

// ===================================
// Factory for helper functions
// ===================================
.factory('displayHelpers', ['$window', function($window){

  var THREE = $window.THREE;

  var makeLoResElement = function (layersSeparated, elData) {
    var elLo = document.createElement( 'div' );
    elLo.className = ( 'tweet-3d-lod-low' );
    elLo.style.backgroundColor = currentBGColor(layersSeparated, elData);

    return elLo;
  };

  var makeLoResMesh = function (layersSeparated, elData, layerObj, type) {
    var loGeo;
    if (type === 'pb') {
      loGeo = new THREE.PlaneBufferGeometry(140, 140);
    } else {
      loGeo = new THREE.PlaneGeometry(140, 140);
    }
    var loMesh;
    var score = elData.score.split(': ')[1];
    if (score === 'N/A') {
      score = 0;
    } else {
      score = +score;
    }
    if (score > 0) {
      loMesh = new THREE.Mesh(loGeo, layerObj.tweetMaterialPos);
    } else if (score < 0) {
      loMesh = new THREE.Mesh(loGeo, layerObj.tweetMaterialNeg);
    } else {
      loMesh = new THREE.Mesh(loGeo, layerObj.tweetMaterialNeutral);
    }
    //elData.baseBGColorRGB;
    return loMesh;
  };

  var makeLoResGeo = function () {
    var loGeo = new THREE.PlaneGeometry(140, 140);
    return loGeo;
  };

  var getCameraDistanceFrom = function(camera,x,y,z) {
    var cameraDistance = new THREE.Vector3();
    var zTarget = new THREE.Vector3(x,y,z);
    cameraDistance.subVectors(camera.position, zTarget);
    return cameraDistance.length();
  };

  var getDisplayWidthAtPoint = function(camera,x,y,z) {
    x = x || 0;
    y = y || 0;
    z = z || 0;
    var cameraDistanceFromZPlane = getCameraDistanceFrom(camera, x,y,z);
    var heightAtZPlane = 2 * cameraDistanceFromZPlane * Math.tan(THREE.Math.degToRad(camera.fov)/2);
    var widthAtZPlane = camera.aspect * heightAtZPlane;
    return widthAtZPlane;
  };

  var getDisplayHeightAtPoint = function(camera,x,y,z) {
    x = x || 0;
    y = y || 0;
    z = z || 0;
    var cameraDistanceFromZPlane = getCameraDistanceFrom(camera, x,y,z);
    var heightAtZPlane = 2 * cameraDistanceFromZPlane * Math.tan(THREE.Math.degToRad(camera.fov)/2);
    return heightAtZPlane;
  };

  var currentBGColor = function (layersSeparated, elData) {
    if (!layersSeparated && elData.baseBGColor === 'rgba(225,225,225,0.8)') {
      return 'rgba(225,225,225,0)';
    } else {
      return elData.baseBGColor;
    }
  };

  var calculateColorFromScore = function (score) {
    var bgRGBA;
    if (score < -5) {
      score = -5;
    }
    if (score > 5) {
      score = 5;
    }
    if (score < 0) {
      bgRGBA = '225,0,0,' + (0.25 - score/10);
    }
    if (score > 0) {
      bgRGBA = '0,20,190,' + (0.25 + score/10);
    }
    if (score === 0 || score === undefined) {
      bgRGBA = '225,225,225,0.8';
    }
    return bgRGBA;
  };

  return {
    makeLoResElement: makeLoResElement,
    makeLoResMesh: makeLoResMesh,
    makeLoResGeo: makeLoResGeo,
    getCameraDistanceFrom: getCameraDistanceFrom,
    getDisplayWidthAtPoint: getDisplayWidthAtPoint,
    getDisplayHeightAtPoint: getDisplayHeightAtPoint,
    currentBGColor: currentBGColor,
    calculateColorFromScore: calculateColorFromScore
  };
}])

// ===================================
// Main factory service for 3D display
// ===================================
.factory('Display3d', ['$document', '$window', 'displayHelpers', 'Emoji', function($document, $window, displayHelpers, Emoji) {

  var document = $document[0];
  var THREE = $window.THREE;
  var TWEEN = $window.TWEEN;

  // Important global threejs vars
  var sceneCSS, sceneGL, camera, rendererCSS, rendererGL, controls, prevCameraPosition;

  var layersSeparated;
  var layers;
  var ribbonHeight;
  var scope;

  // Distances to switch LODs
  var lod0Distance = 1000;
  var lod1Distance = 2000;
  var lod2Distance = 5000;

  // Tweets to combine at each LOD
  var lod1Size = 4;
  var lod2Size = 16;

  var frontLayerZ = 300;
  var layerSpacing = 300;

  // left and right mouse hover buttons
  var leftHover = false;
  var rightHover = false;
  var baseScrollSpeed = 25;
  var scrollSpeed = baseScrollSpeed;
  var neverAutoScroll = false;
  var rightAutoScroll = false;
  var tick = 0;

  // tweet display settings
  var rows;
  var ySpacing = 200;
  var yStart = 300;
  var xSpacing = 320;
  var xStart = -800;

  // Clear display - want to call this before leaving page or starting a new search
  // Removes all Three.js objects in each scene and clears them from memory.
  var clear = function () {
    console.log('calling clear');
    if (layers !== undefined) {
      layers.forEach( function (layer) {
        if (layer.lodHolder) {
          layer.lodHolder.children.forEach( function (obj) {
            sceneGL.remove(obj);
            obj.geometry.dispose();
          });
          sceneGL.remove(layer.lodHolder);
          layer.lodHolder = undefined;
        }
        sceneGL.remove(layer.ribbonMesh);
        layer.ribbonMesh = undefined;
        sceneGL.remove(layer.titleMesh);
        layer.titleMesh = undefined;
        layer.ribbonMaterial.dispose();
        layer.ribbonMaterial = undefined;
        layer.titleMaterial.dispose();
        layer.titleMaterial = undefined;
        layer.tweetMaterialNeutral.dispose();
        layer.tweetMaterialNeutral = undefined;
        layer.tweetMaterialPos.dispose();
        layer.tweetMaterialPos = undefined;
        layer.tweetMaterialNeg.dispose();
        layer.tweetMaterialNeg = undefined;
        layer.tweets.forEach( function (tweet) {
          if (tweet.obj) {
            sceneGL.remove(tweet.obj);
            sceneCSS.remove(tweet.obj);
            if (tweet.obj.geometry) {
              tweet.obj.geometry.dispose();
            }
          }
          tweet.obj = undefined;
          tweet.el = undefined;
        });
        layer.tweets = undefined;
        layer = undefined;
      });
    }
  };

  // Toggle layer visibility per whatever is checked in the layer menu
  var updateLayers = function (layersVisible) {
    layers.forEach(function (layerObj, i) {
      // if this layer is hidden and should be visible,
      // toggle on visible and call showLayer
      if (layerObj.visible === false && layersVisible[layerObj.title].viz === true) {
        console.log('toggle on ' + layerObj.title);
        layerObj.visible = true;
        console.log('showing ' + layerObj.title);
        showLayer(i);
      // if this layer is visible and should be hidden
      // toggle off visible and call hideLayer
      } else if (layerObj.visible === true && layersVisible[layerObj.title].viz === false) {
        console.log('toggle off ' + layerObj.title);
        layerObj.visible = false;
        console.log('hiding ' + layerObj.title);
        hideLayer(i);
      }
    });
  };

  // Separates layers with animation tweening
  var separateLayers = function () {
    for (var i = 0; i < layers.length; i++) {
      // tweet opacity for WebGL tweets
      if (layers[i].visible) {
        new TWEEN.Tween( layers[i].tweetMaterialNeutral )
          .to ({opacity: 0.5}, 1000)
          .start();
      }
      
      // Tween individual tweets if at two closest LODs
      if (layers[i].lod === 'individual') {
        layers[i].tweets.forEach(function(tweet) {
          // if tweet has an obj representing it
          if (tweet.obj) {
            new TWEEN.Tween( tweet.obj.position )
              .onStart( function () {
                tweet.transition = true;
              })
              .to( {z: frontLayerZ - layerSpacing*i}, 1000 )
              .easing( TWEEN.Easing.Exponential.InOut )
              .onComplete( function() {
                tweet.transition = false;
              })
              .start();
          } else { // tweet is hidden or LOD merged into another tweet
            //tweet.position.z = frontLayerZ - layerSpacing*i;
          }
          // tweet opacity for CSS tweets
          if (layers[i].visible && tweet.el && tweet.elData.baseBGColor === 'rgba(225,225,225,0.8)') {
            new TWEEN.Tween( {val: 0} )
              .to ( {val: 0.8}, 1000 )
              .easing( TWEEN.Easing.Exponential.InOut )
              .onUpdate( function () {
                if (tweet.el) {
                  tweet.el.style.backgroundColor = 'rgba(225,225,225,' + this.val + ')';
                }
              })
              .start();
          }
        });
      } else if (layers[i].lodHolder) { // at further LODs, all tweets are in one object
        layers[i].transition = true;
        new TWEEN.Tween( layers[i].lodHolder.position )
          .to( {z: frontLayerZ - layerSpacing*i}, 1000)
          .easing( TWEEN.Easing.Exponential.InOut)
          .onComplete( function () {
            this.transition = false;
          }.bind(layers[i]))
          .start();
      }


      // ribbon position
      new TWEEN.Tween( layers[i].ribbonMesh.position )
        .to( {z: frontLayerZ - layerSpacing*i - 1}, 1000 )
        .easing( TWEEN.Easing.Exponential.InOut )
        .start();
      if (i > 0 && layers[i].visible) {
        // ribbon title opacity (not front layer)
        new TWEEN.Tween( layers[i].titleMaterial )
          .to( {opacity: 0.5}, 1300 )
          .easing( TWEEN.Easing.Exponential.InOut )
          .start();
      }
      layers[i].z = frontLayerZ - layerSpacing*i - 1;
      if (i === 0) {
        // ribbon title opacity (front layer)
        var fadeOut = new TWEEN.Tween( layers[i].combinedMaterial )
          .to( {opacity: 0}, 500)
          .easing( TWEEN.Easing.Quadratic.InOut );
        var fadeIn = new TWEEN.Tween( layers[i].titleMaterial )
          .to( {opacity: 0.5}, 500)
          .easing( TWEEN.Easing.Quadratic.InOut );
        fadeOut.chain(fadeIn).start();
      }
    }
  };

  // Flatten layers with animation tweening
  var flattenLayers = function () {

    for (var i = 0; i < layers.length; i++) {

      // tween neutral tweet material to invisible when flattening
      new TWEEN.Tween( layers[i].tweetMaterialNeutral )
        .to ({opacity: 0}, 1000)
        .start();

      // Tween individual tweets if at two closest LODs
      if (layers[i].lod === 'individual') {
        layers[i].tweets.forEach(function(tweet) {
          //tweet.transition = true;
          // if tweet has an obj representing it
          if (tweet.obj) {
            new TWEEN.Tween( tweet.obj.position )
              .onStart( function () {
                tweet.transition = true;
              })
              .to( {z: frontLayerZ - 2*i}, 1000 )
              .easing( TWEEN.Easing.Exponential.InOut )
              .onComplete( function () {
                tweet.transition = false;
              })
              .start();
          } else { // if tweet is LOD'd out, hidden offscreen
            // update its position
            // tweet.position.z = frontLayerZ - 2*i;
          }
          if (tweet.el && tweet.elData.baseBGColor === 'rgba(225,225,225,0.8)') {
            new TWEEN.Tween( {val: 0.8} )
              .to ( {val: 0}, 1000 )
              .easing( TWEEN.Easing.Exponential.InOut )
              .onUpdate( function () {
                if (tweet.el) {
                  tweet.el.style.backgroundColor = 'rgba(225,225,225,' + this.val + ')';
                }
              })
              .start();
          }
        });
      } else if (layers[i].lodHolder) { // at further LODs, all tweets are in one object
        layers[i].transition = true;
        new TWEEN.Tween( layers[i].lodHolder.position )
          .to( {z: frontLayerZ - 2*i}, 1000)
          .easing( TWEEN.Easing.Exponential.InOut)
          .onComplete( function () {
            this.transition = false;
          }.bind(layers[i]))
          .start();
      }

      // tween ribbon and title
      new TWEEN.Tween( layers[i].ribbonMesh.position )
        .to( {z: frontLayerZ - 2*i - 1}, 1000 )
        .easing( TWEEN.Easing.Exponential.InOut )
        .start();
      if (i > 0) {
        new TWEEN.Tween( layers[i].titleMaterial )
          .to( {opacity: 0}, 500)
          .easing( TWEEN.Easing.Exponential.InOut )
          .start();
      }

      layers[i].z = frontLayerZ - 2*i;

      // For front layer, generate a combined title, show it, hide the individual one
      if (i === 0) {

        if (layers[i].combinedMesh) {
          sceneGL.remove(layers[i].combinedMesh);
          layers[i].combinedMesh.geometry.dispose();
          layers[i].combinedMaterial.dispose();
        }
        var combinedMaterial = new THREE.MeshBasicMaterial( { color: 'rgb(0,150,210)', wireframe: false, wireframeLinewidth: 1, side: THREE.DoubleSide } );
        combinedMaterial.transparent = true;
        combinedMaterial.opacity = 0;
        var layerNames = [];
        layers.forEach(function (item) {
          if (item.visible) {
            layerNames.push(item.title);
          }
        });
        
        var combinedTextGeom = new THREE.TextGeometry( layerNames.join(' + ') + ' layers',
          {
            size: (12*rows),
            font: 'droid sans', // Must be lowercase!
            height: 0
          });
        var combinedTextMesh = new THREE.Mesh(combinedTextGeom, combinedMaterial);
        combinedTextMesh.position.x = layers[i].titleMesh.position.x;
        combinedTextMesh.position.y = layers[i].titleMesh.position.y;
        combinedTextMesh.position.z = layers[i].titleMesh.position.z;
        sceneGL.add(combinedTextMesh);
        layers[i].combinedMesh = combinedTextMesh;
        layers[i].combinedMaterial = combinedMaterial;

        var fadeOut = new TWEEN.Tween( layers[i].titleMaterial )
          .to( {opacity: 0}, 500)
          .easing( TWEEN.Easing.Quadratic.InOut );
        var fadeIn = new TWEEN.Tween( combinedMaterial )
          .to( {opacity: 0.5}, 500)
          .easing( TWEEN.Easing.Quadratic.InOut );
        fadeOut.chain(fadeIn).start();
      }
    }
  };

  // Toggle on/off autoscroll to right
  var autoScrollToggle = function () {
    neverAutoScroll = !neverAutoScroll;
  };

  // Automatically adjusts ribbon width to full screen width (plus a little more)
  // Call on init, or camera move
  var adjustRibbonWidth = function() {
    var lastX = 50;
    layers.forEach(function(layer) {
      var farthestYOnRibbon;
      // probably would be more precise to find out angle of camera vector relative
      // to ribbon but this should work in most cases
      if (camera.position.y >= 0) {
        farthestYOnRibbon = -1 * ribbonHeight;
      } else {
        farthestYOnRibbon = ribbonHeight;
      }
      var newRibbonWidth = displayHelpers.getDisplayWidthAtPoint(camera, 0, farthestYOnRibbon, layer.z) + 10;
      layer.ribbonMesh.scale.x = newRibbonWidth;
      layer.ribbonMesh.position.x = controls.target.x;
      // I want the new title to start after the x screen position of the last title
      var desiredTitleScreenXPosition = lastX;
      var screenWidthIn3DCoords = displayHelpers.getDisplayWidthAtPoint(camera, controls.target.x, 0, layer.z);
      var screenWidthInBrowser = window.innerWidth;
      var leftEdgeIn3DCoords = controls.target.x - screenWidthIn3DCoords/2;
      var desiredTitleXCoord = leftEdgeIn3DCoords + desiredTitleScreenXPosition * (screenWidthIn3DCoords/screenWidthInBrowser);

      lastX += layer.titleMesh.textWidth * (screenWidthInBrowser/screenWidthIn3DCoords);
      layer.titleMesh.position.x = desiredTitleXCoord;
    });
  };

  // generic function to add event handlers to buttons
  var addButtonEvent = function (buttonId, eventName, callback) {
    var button = document.getElementById( buttonId );
    button.addEventListener( eventName, function ( event ) {
      callback(event);
    }, false);
  };

  // Creates a new div element for a tweet (for close-up tweets)
  var makeTweetElement = function (elData, layerObj) {

      var tweet = document.createElement( 'div' );
      tweet.className = 'tweet-3d';
      tweet.style.backgroundColor = elData.baseBGColor;

      var username = document.createElement( 'div' );
      username.textContent = elData.username;
      tweet.appendChild( username );

      var tweetText = document.createElement( 'div' );
      tweetText.innerHTML = elData.text;
      tweet.appendChild( tweetText );

      var score = document.createElement( 'div' );
      score.textContent = elData.score;
      tweet.appendChild( score );

      if (+elData.score.split(': ')[1] === 0 || elData.score.split(': ')[1] === 'N/A') {
        tweetText.className = 'tweetText';
        score.className = 'score';
        username.className = 'username';
      } else {
        tweetText.className = 'colorTweetText';
        score.className = 'colorScore';
        username.className = 'colorUsername';
      }

      tweet.style.backgroundColor = displayHelpers.currentBGColor(layersSeparated, elData);

      // if current layer is hidden
      if (!layerObj.visible) {
        tweet.className = tweet.className + ' invisible';
      }

      if (scope) {
        tweet.addEventListener( 'click', function ( event ) {
          scope.editTweet(elData);
        }, false);
      }


      return tweet;

  };


  // makes a new lodHolder for a layer, saves the children from the old one
  // and copies them over
  var refreshLODHolder = function (layerObj) {
    var tmpArray = [];
    if (layerObj.lodHolder && layerObj.lodHolder.children[0]) {
      for (var k = 0; k < layerObj.lodHolder.children.length; k++) {
        tmpArray.push(layerObj.lodHolder.children[k]);
      }
    }
    sceneGL.remove(layerObj.lodHolder);
    layerObj.lodHolder = undefined;
    layerObj.lodHolder = new THREE.Object3D();
    for (var m = 0; m < tmpArray.length; m++) {
      layerObj.lodHolder.add(tmpArray[m]);
    }
  };

  // Adds a new tweet to the display
  var addTweet = function(rawTweet, index, lastTweet) {

    layers.forEach(function(layerObj) {

      var elData = {};
      var bgRGBA;

      var text = Emoji.restoreEmojisInTweet(rawTweet.text);

      // if the layer data is in the data from the server
      if (rawTweet[layerObj.resultsName]) {
        bgRGBA = displayHelpers.calculateColorFromScore(rawTweet[layerObj.resultsName].score);

        // add into tweet text pos-word/neg-word color spans for relevant layers
        if (layerObj.resultsName === 'baseLayerResults' || layerObj.resultsName === 'slangLayerResults' ||
              layerObj.resultsName === 'negationLayerResults') {
          rawTweet[layerObj.resultsName].positiveWords.forEach( function (posWord) {
            text = text.replace(posWord[0], '<span class="positive-word">' + posWord[0] + '</span>');
          });
          rawTweet[layerObj.resultsName].negativeWords.forEach( function (negWord) {
            text = text.replace(negWord[0], '<span class="negative-word">' + negWord[0] + '</span>');
          });
        }

        // more properties that won't be available if DB didn't send data for this layer
        elData.score = layerObj.title + ' score: ' + rawTweet[layerObj.resultsName].score;

      } else {
        // some backup values if it doesn't have layer data
        bgRGBA = displayHelpers.calculateColorFromScore();
        elData.score = layerObj.title + ' score: N/A';
      }
      
      // calculate BG color values from score
      elData.baseBGColor = 'rgba(' + bgRGBA + ')';
      elData.baseBGColorRGB = 'rgb(' + bgRGBA.split(',').slice(0,3).join(',') + ')';

      elData.text = text;
      elData.username = Emoji.restoreEmojisInTweet(rawTweet.username);

      // tweet position data
      var x = xStart + Math.floor(index / rows) * xSpacing;
      var y = yStart - (index % rows) * ySpacing;
      var z = layerObj.z;
      var tweet;
      var object;
      var lodLevel;
      var hidden = false;

      var tweetDistance = displayHelpers.getCameraDistanceFrom( camera, x, y, z );
      var layerDistance = displayHelpers.getCameraDistanceFrom( camera, controls.target.x, controls.target.y, layerObj.z );

      // Determines what type of tweet to create based on current distance from the camera
      // For furthest distance (LOD2):
      // Make a threejs plane geometry for each tweet and group every 16x16 square
      // of tweets into one mesh object
      if (layerDistance > lod2Distance) {

        layerObj.lod = 'lo2';
        layerObj.lastDisplayedTweet = layerObj.lastDisplayedTweet || -1;
        lodLevel = 'lo2';

        var thisTweet = {
          obj: object,
          el: tweet,
          elData: elData,
          lod: lodLevel,
          index: index,
          hidden: hidden,
          position: new THREE.Vector3(x, y, z),
        };

        layerObj.tweets.push(thisTweet);

        // if we have enough columns to make n x n blocks OR this is last tweet
        if (((index+1) % (rows*lod2Size) === 0) || lastTweet) {

          // make a new LOD holder for layer (it is hard to get an old one to rerender for some reason)
          refreshLODHolder(layerObj);

          for (var i = layerObj.lastDisplayedTweet+1; i < layerObj.tweets.length; i++) {
            var n = lod2Size; // merge an n x n square
            var row = i % rows;
            var col = Math.floor(i/rows);
            if (row % n === 0 && col % n === 0) {
              var tweetsToMerge = [];
              for (var colIndex = 0; colIndex < n; colIndex++) {
                for (var rowIndex = 0; rowIndex < n; rowIndex++) {
                  var currentIndex = i + rowIndex + (rows * colIndex);
                  if (currentIndex < layerObj.tweets.length && row + rowIndex < rows) {
                    tweetsToMerge.push(layerObj.tweets[currentIndex]);
                  } else {
                    tweetsToMerge.push(null);
                  }
                }
              }
              var combinedMesh = mergeTweets(tweetsToMerge, layerObj);
              combinedMesh.position.x = tweetsToMerge[0].position.x;
              combinedMesh.position.y = tweetsToMerge[0].position.y;
              tweetsToMerge[0].obj = combinedMesh;
              layerObj.lodHolder.add(combinedMesh);
              layerObj.lastDisplayedTweet = i;
            }
          }
          layerObj.lodHolder.position.z = layerObj.z;
          sceneGL.add(layerObj.lodHolder);
        }


      } else if (layerDistance > lod1Distance) {
      // For next furthest distance (LOD1):
      // Make a threejs plane geometry for each tweet and group every 4x4 square
      // of tweets into one mesh object

        layerObj.lod = 'lo1';
        layerObj.lastDisplayedTweet = layerObj.lastDisplayedTweet || -1;
        lodLevel = 'lo1';

        var thisTweet = {
          obj: object,
          el: tweet,
          elData: elData,
          lod: lodLevel,
          index: index,
          hidden: hidden,
          position: new THREE.Vector3(x, y, z),
        };

        layerObj.tweets.push(thisTweet);

        // if we have enough columns to make n x n blocks
        if (((index+1) % (rows*lod1Size) === 0) || lastTweet) {

          // make a new LOD holder for layer (it is hard to get an old one to rerender for some reason)
          refreshLODHolder(layerObj);

          for (var i = layerObj.lastDisplayedTweet+1; i < layerObj.tweets.length; i++) {
            var n = lod1Size; // merge an n x n square
            var row = i % rows;
            var col = Math.floor(i/rows);
            if (row % n === 0 && col % n === 0) {
              var tweetsToMerge = [];
              for (var colIndex = 0; colIndex < n; colIndex++) {
                for (var rowIndex = 0; rowIndex < n; rowIndex++) {
                  var currentIndex = i + rowIndex + (rows * colIndex);
                  if (currentIndex < layerObj.tweets.length && row + rowIndex < rows) {
                    tweetsToMerge.push(layerObj.tweets[currentIndex]);
                  } else {
                    tweetsToMerge.push(null);
                  }
                }
              }
              var combinedMesh = mergeTweets(tweetsToMerge, layerObj);
              combinedMesh.position.x = tweetsToMerge[0].position.x;
              combinedMesh.position.y = tweetsToMerge[0].position.y;
              tweetsToMerge[0].obj = combinedMesh;
              layerObj.lodHolder.add(combinedMesh);
              layerObj.lastDisplayedTweet = i;
            }
          }
          layerObj.lodHolder.position.z = layerObj.z;
          sceneGL.add(layerObj.lodHolder);
        }


      } else if (tweetDistance > lod0Distance) {
        // For next lod (LO):
        // Make a threejs planeBuffer geometry for each tweet
        lodLevel = 'lo';
        object = displayHelpers.makeLoResMesh(layersSeparated, elData, layerObj, 'pb');
        object.position.x = x;
        object.position.y = y;
        object.position.z = z;
        sceneGL.add( object );

        layerObj.tweets.push({
          obj: object,
          el: tweet,
          elData: elData,
          lod: lodLevel,
          index: index,
          hidden: hidden,
          position: new THREE.Vector3(x, y, z),
        });

      } else {
        // For closest lod (HI):
        // Make a CSS 3D div for each tweet
        lodLevel = 'hi';
        tweet = makeTweetElement(elData, layerObj);

        object = new THREE.CSS3DObject( tweet );
        object.position.x = x;
        object.position.y = y;
        object.position.z = z;
        sceneCSS.add( object );

        layerObj.tweets.push({
          obj: object,
          el: tweet,
          elData: elData,
          lod: lodLevel,
          index: index,
          hidden: hidden,
          position: new THREE.Vector3(x, y, z),
        });
      }

    });

  };

  // Input: tweet sentiment score
  // Output: material index for that tweet (pos, neg, neutral)
  var getMatIndexFromScore = function (score) {
    var matIndex;
    if (score > 0) {
      matIndex = 1;
    } else if (score < 0) {
      matIndex = 2;
    } else {
      matIndex = 0;
    }
    return matIndex;
  };

  // Merges given array of tweets into one mesh object
  var mergeTweets = function (tweetsToMerge, layer) {
    var combinedGeo = new THREE.Geometry();
    //var combinedMat = [];
    var combinedMat = [layer.tweetMaterialNeutral, layer.tweetMaterialPos, layer.tweetMaterialNeg];

    if (!window.combinedGeo) {
      window.combinedGeo = combinedGeo;
    }

    for (var i = 0; i < tweetsToMerge.length; i++) {
      var tweet = tweetsToMerge[i];
      if (tweet !== null) {
        if (tweet.obj) {
          tweet.position.copy(tweet.obj.position);
        }
        var tmpRows = Math.sqrt(tweetsToMerge.length);
        var x = Math.floor(i / tmpRows) * xSpacing;
        var y = 0 - (i % tmpRows) * ySpacing;
        var score = +tweet.elData.score.split(': ')[1];
        var matIndex = getMatIndexFromScore(score);
        sceneGL.remove(tweet.obj);
        if (tweet.obj && tweet.obj.geometry) {
          tweet.obj.geometry.dispose();
        }
        var newPlaneMesh = displayHelpers.makeLoResMesh(layersSeparated, tweet.elData, layer, 'p');
        newPlaneMesh.position.set(x,y,0);
        newPlaneMesh.updateMatrix();
        combinedGeo.merge(newPlaneMesh.geometry, newPlaneMesh.matrix, matIndex);
        newPlaneMesh.geometry.dispose();
        newPlaneMesh = undefined;
        //combinedMat.push(tweet.obj.material);
        sceneGL.remove(tweet.obj);
        tweet.obj = undefined;
      }
    }
    var combinedMesh = new THREE.Mesh(combinedGeo, new THREE.MeshFaceMaterial(combinedMat));
    //var combinedMesh = new THREE.Mesh(combinedGeo, testMat);
    if (!window.combinedMesh) {
      window.combinedMesh = combinedMesh;
    }
    return combinedMesh;
  };

  // Creates a new empty layer
  var makeTweetLayer = function(layerResultsProp, layerTitle, z) {
    var layerObj = {};
    layerObj.tweets = [];
    layerObj.resultsName = layerResultsProp;
    layerObj.title = layerTitle;
    layerObj.z = z;

    // Materials are stored on layer so we don't have to make a new one for each tweet
    layerObj.tweetMaterialNeutral = new THREE.MeshBasicMaterial( { color: 'rgb(225,225,225)', wireframe: false, wireframeLinewidth: 1, side: THREE.DoubleSide } );
    layerObj.tweetMaterialNeutral.transparent = true;
    layerObj.tweetMaterialNeutral.opacity = 0.5;

    layerObj.tweetMaterialPos = new THREE.MeshBasicMaterial( { color: 'rgb(0,20,190)', wireframe: false, wireframeLinewidth: 1, side: THREE.DoubleSide } );
    layerObj.tweetMaterialPos.transparent = true;
    layerObj.tweetMaterialPos.opacity = 0.5;

    layerObj.tweetMaterialNeg = new THREE.MeshBasicMaterial( { color: 'rgb(225,0,0)', wireframe: false, wireframeLinewidth: 1, side: THREE.DoubleSide } );
    layerObj.tweetMaterialNeg.transparent = true;
    layerObj.tweetMaterialNeg.opacity = 0.5;

    // Ribbon material and geo

    var ribbonMaterial = new THREE.MeshBasicMaterial( { color: 'rgb(0,132,180)', wireframe: false, wireframeLinewidth: 1, side: THREE.DoubleSide } );
    ribbonMaterial.transparent = true;
    ribbonMaterial.opacity = 0.3;

    var ribbonGeo = new THREE.PlaneBufferGeometry( 1, ribbonHeight, 2, 2 );
    $window.ribbonGeo = ribbonGeo;
    var ribbonMesh = new THREE.Mesh( ribbonGeo, ribbonMaterial );
    ribbonMesh.position.x = 0;
    ribbonMesh.position.y = 0;
    ribbonMesh.position.z = z-1;

    sceneGL.add( ribbonMesh );
    layerObj.ribbonMesh = ribbonMesh;
    layerObj.ribbonMaterial = ribbonMaterial;

    // Layer titles material and geo (titles are 3D geometry, not CSS)
    var layerTitleMaterial = new THREE.MeshBasicMaterial( { color: 'rgb(0,150,210)', wireframe: false, wireframeLinewidth: 1, side: THREE.DoubleSide } );
    layerTitleMaterial.transparent = true;
    layerTitleMaterial.opacity = 0.5;

    var textGeom = new THREE.TextGeometry( layerTitle + ' layer', {
      size: (12*rows),
      font: 'droid sans', // Must be lowercase!
      height: 0
    });
    var textMesh = new THREE.Mesh( textGeom, layerTitleMaterial );
    textGeom.computeBoundingBox();
    textMesh.textWidth = textGeom.boundingBox.max.x - textGeom.boundingBox.min.x;
    var textHeight = textGeom.boundingBox.max.y - textGeom.boundingBox.min.y;
    textMesh.position.y = (rows*(ySpacing+35))/2 - textHeight/2;
    textMesh.position.z = z-1;

    sceneGL.add( textMesh );
    layerObj.titleMesh = textMesh;
    layerObj.titleMaterial = layerTitleMaterial;

    // set visibility to true on initial creation
    layerObj.visible = true;

    // stores visible layers
    layers.push(layerObj);
  };

  // Hides everything on a given layer
  var hideLayer = function (layerIndex) {
    // hide tweets
    layers[layerIndex].tweetMaterialNeg.opacity = 0;
    layers[layerIndex].tweetMaterialNeutral.opacity = 0;
    layers[layerIndex].tweetMaterialPos.opacity = 0;
    layers[layerIndex].tweets.forEach(function (tweet) {
      if (tweet.el) {
        tweet.el.className = tweet.el.className + ' invisible';
      }
    });
    // hide ribbon mesh
    layers[layerIndex].ribbonMaterial.opacity = 0;
    // hide layer title
    layers[layerIndex].titleMaterial.opacity = 0;
  };

  // Unhides everything on a given layer
  var showLayer = function (layerIndex) {
    // show tweets
    layers[layerIndex].tweetMaterialNeg.opacity = 0.5;
    if (layersSeparated) {
      layers[layerIndex].tweetMaterialNeutral.opacity = 0.5;
    } else {
      layers[layerIndex].tweetMaterialNeutral.opacity = 0;
    }
    layers[layerIndex].tweetMaterialPos.opacity = 0.5;
    layers[layerIndex].tweets.forEach(function (tweet) {
      if (tweet.el) {
        tweet.el.className = tweet.el.className.split(' ')[0];
      }
    });
    // show ribbon mesh
    layers[layerIndex].ribbonMaterial.opacity = 0.5;
    // show layer title
    layers[layerIndex].titleMaterial.opacity = 0.5;
  };

  // Renders objects in both scenes (CSS and GL)
  // Called every tick in animate()
  var render = function() {
    rendererCSS.render( sceneCSS, camera );
    rendererGL.render( sceneGL, camera );
  };

  // Update LODs of tweets that need it
  // Called every tick in animate()
  var updateTweetLOD = function () {
    for (var layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      for (var t = 0; t < layers[layerIndex].tweets.length; t++) {
        var tweet = layers[layerIndex].tweets[t];

        // If this tweet has an existing obj (it might not at farthest LODs)
        // Get the current position from it
        // Otherwise tweet.position should hold the last saved position
        if (tweet.obj) {
          tweet.position.copy(tweet.obj.position);
        }
        var tweetDistance = displayHelpers.getCameraDistanceFrom( camera, tweet.position.x, tweet.position.y, tweet.position.z );
        var layerDistance = displayHelpers.getCameraDistanceFrom( camera, controls.target.x, controls.target.y, layers[layerIndex].z );

        // whole layer swaps
        if (layerDistance > lod2Distance && layers[layerIndex].lod !== 'lo2') {
          // switch whole layer to LOD2
          console.log('swap to LO2');
          swapLayerLOD(layers[layerIndex], 'lo2');
        } else if (layerDistance <= lod2Distance && layerDistance > lod1Distance && layers[layerIndex].lod !== 'lo1') {
          // switch whole layer to LOD1
          console.log('swap to LO1');
          swapLayerLOD(layers[layerIndex], 'lo1');
        } else if (layerDistance <= lod1Distance && layers[layerIndex].lod === 'lo1') {
          // switch whole layer to lo
          console.log('swap to LO');
          swapLayerLOD(layers[layerIndex], 'lo');
          layers[layerIndex].lod = 'individual';
        }

        // individual tweet swaps
        if (layerDistance <= lod1Distance && tweetDistance > lod0Distance && tweet.el) {
          // switch to lo from hi
          if (tweet.hidden) { // if tweet is hidden, just swap the lod property so it knows what lod it should be at when it comes back
            tweet.lod = 'lo';
          } else {
            swapLOD(tweet, 'lo', layers[layerIndex]);
          }
          layers[layerIndex].lod = 'individual';
          console.log(layers[layerIndex].lod);
        } else if (layerDistance <= lod1Distance && tweetDistance <= lod0Distance && !tweet.el) {
          // switch to hi from lo
          if (tweet.hidden) {
            tweet.lod = 'hi';
          } else {
            swapLOD(tweet, 'hi', layers[layerIndex]);
          }
          layers[layerIndex].lod = 'individual';
        }

      }
    }
  };

  // swap an entire layer's LOD
  var swapLayerLOD = function(layer, swapTo) {
    // Do nothing if layer is already at that LOD
    if (layer.lod === swapTo) {
      return;
    }
    // Need to make a new LOD holder (or it won't render)
    if (layer.lodHolder) {
      sceneGL.remove(layer.lodHolder);
      layer.lodHolder = undefined;
    }
    layer.lodHolder = new THREE.Object3D();
    for (var t = 0; t < layer.tweets.length; t++) {
      var tweet = layer.tweets[t];
      if (!tweet.hidden) {
        swapLOD(tweet, swapTo, layer);
      } else {
        tweet.lod = swapTo; // hidden tweets just have their data updated to say what lod they should be at when they come back
      }
    }
    layer.lodHolder.position.z = layer.z;
    sceneGL.add(layer.lodHolder);
    layer.lod = swapTo;
  };

  // Swaps LOD for a single tweet
  var swapLOD = function (tweet, swapTo, layer) {


    var el, object;

    var index = tweet.index;
    var row = index % rows;
    var col = Math.floor(index/rows);

    var x, y, z;

    if (tweet.obj) {
      tweet.position.copy(tweet.obj.position);
      tweet.position.z = layer.z;
    }
    x = tweet.position.x;
    y = tweet.position.y;
    z = tweet.position.z;

    // don't do anything if it's already at the right LOD
    if (swapTo === tweet.lod) {
      return;
    }

    // don't do anything if the tweet is tweening
    if (tweet.transition || layer.transition) {
      if (swapTo === 'lo2' && tweet.index === 0) {
        console.log(tweet.transition);
        console.log(layer.transition);
      }
      return;
    }


    // 'hi' = css div
    if (swapTo === 'hi') {
      el = makeTweetElement(tweet.elData, layer);
      if (tweet.obj) {
        sceneGL.remove(tweet.obj);
        if (tweet.obj.geometry) {
          tweet.obj.geometry.dispose();
        }
      }
      object = new THREE.CSS3DObject( el );
      object.position.x = x;
      object.position.y = y;
      object.position.z = layer.z;
      sceneCSS.add( object );
      tweet.lod = 'hi';
    }

    // 'lo' = single webgl square
    if (swapTo === 'lo') {
      if (tweet.el) { // swapping from hi
        sceneCSS.remove(tweet.obj);
      } else { // swapping from lo1
        if (tweet.obj) { // only primary box in a merge group should have an obj
          // console.dir(tweet);
          // layer.lodHolder.remove(tweet.obj);
          // tweet.obj.geometry.dispose();
        }
      }
      object = displayHelpers.makeLoResMesh(layersSeparated, tweet.elData, layer, 'pb');
      object.position.x = x;
      object.position.y = y;
      object.position.z = layer.z;
      sceneGL.add( object );
      tweet.lod = 'lo';
    }

    // 'lo1' = 4x4 square geom merged into 1
    if (swapTo === 'lo1') { 
      var n = lod1Size;
      if (row % n === 0 && col % n === 0) {
        // this is a primary box, 1 merge per primary
        var tweetsToMerge = [];
        for (var colIndex = 0; colIndex < n; colIndex++) {
          for (var rowIndex = 0; rowIndex < n; rowIndex++) {
            var currentIndex = index + rowIndex + (rows * colIndex);
            if (currentIndex < layer.tweets.length && row + rowIndex < rows) {
              tweetsToMerge.push(layer.tweets[currentIndex]);
            } else {
              tweetsToMerge.push(null);
            }
          }
        }

        object = mergeTweets(tweetsToMerge, layer);
        // set necessary values for non-primary squares - need to make sure this is done AFTER merging
        for (var j = 1; j < tweetsToMerge.length; j++) {
          if (tweetsToMerge[j] !== null) {
            tweetsToMerge[j].lod = 'lo1';
            tweetsToMerge[j].obj = undefined;
            tweetsToMerge[j].el = undefined;
          }
        }
        object.position.set(x, y, 0);
        layer.lodHolder.add(object);
      } else {
        // the non-primary squares don't need to worry about it
        return;
      }
      tweet.lod = 'lo1';
    }

    // 'lo2' = 16x16 square geom merged into 1
    if (swapTo === 'lo2') { 
      var n = lod2Size;
      if (row % n === 0 && col % n === 0) {
        console.log('swapping to lo2 for index ' + index);
        // this is a primary box, 1 merge per primary
        var tweetsToMerge = [];
        for (var colIndex = 0; colIndex < n; colIndex++) {
          for (var rowIndex = 0; rowIndex < n; rowIndex++) {
            var currentIndex = index + rowIndex + (rows * colIndex);
            if (currentIndex < layer.tweets.length && row + rowIndex < rows) {
              tweetsToMerge.push(layer.tweets[currentIndex]);
            } else {
              tweetsToMerge.push(null);
            }
          }
        }

        object = mergeTweets(tweetsToMerge, layer);
        // set necessary values for non-primary squares - need to make sure this is done AFTER merging
        for (var j = 1; j < tweetsToMerge.length; j++) {
          if (tweetsToMerge[j] !== null) {
            tweetsToMerge[j].lod = 'lo2';
            tweetsToMerge[j].obj = undefined;
            tweetsToMerge[j].el = undefined;
          }
        }
        object.position.set(x, y, 0);
        layer.lodHolder.add(object);
      } else {
        // the non-primary squares don't need to worry about it
        return;
      }
      tweet.lod = 'lo2';

    }


    tweet.obj = object;
    tweet.el = el;
  };

  // Kill a tweet obj (when culling) in a way that frees memory
  var killTweetObj = function (i, layer) {
    layer.lodHolder.remove(layer.tweets[i].obj);
    sceneGL.remove(layer.tweets[i].obj);
    sceneCSS.remove(layer.tweets[i].obj);
    if (layer.tweets[i].obj.geometry) {
      layer.tweets[i].obj.geometry.dispose();
    }
    layer.tweets[i].obj = undefined;
  };

  // Checks if this tweet index is the anchor of a obj group
  // given the current LOD
  var isAnchor = function (i, layer) {

    var row = i % rows;
    var col = Math.floor(i/rows);
    var n;

    if (layer.lod === 'lo2') {
      n = lod2Size;
    } else if (layer.lod === 'lo1') {
      n = lod1Size;
    } else {
      n = 1;
    }

    if (row % n === 0 && col % n === 0) {
      return true;
    } else {
      return false;
    }

  };

  // Given an anchor index, find the other 3 corners of that block
  // (bottom left, top right, bottom right)
  var blockCorners = function (i, layer) {
    i = +i;
    var n;
    if (layer.lod === 'lo2') {
      n = lod2Size;
    } else if (layer.lod === 'lo1') {
      n = lod1Size;
    } else {
      return undefined;
    }
    var rowsInBlock = n-1;
    for (var j = 1; j < n; j++) {
      if ((i+j) % rows === 0) { // if it moved up to the top of the next column
        rowsInBlock = j-1;
        break;
      }
    }
    var corner1 = i + rowsInBlock;
    var cols = n;
    var corner2 = i + rows * cols;
    while (cols > 0 && corner2 > layer.tweets.length - 1) {
      cols --;
      corner2 = i + rows * cols;
    }
    cols = n;
    var corner3 = i + rows*n + rowsInBlock;
    while (cols > 0 && corner3 > layer.tweets.length - 1) {
      cols --;
      corner3 = i + rows * cols + rowsInBlock;
    }
    return [corner1, corner2, corner3];
  };

  // Returns objs signifying which tweet indexes are off and on screen.
  var getIndexesOffScreen = function(layer) {
    var offScreen = {};
    var onScreen = {};

    var screenWidth = displayHelpers.getDisplayWidthAtPoint(camera, controls.target.x, controls.target.y, layer.z);
    var screenHeight = displayHelpers.getDisplayHeightAtPoint(camera, controls.target.x, controls.target.y, layer.z);
    var leftEdge = controls.target.x - screenWidth/2;
    var rightEdge = controls.target.x + screenWidth/2;
    var topEdge = controls.target.y + screenHeight/2;
    var bottomEdge = controls.target.y - screenHeight/2;
    // TODO: cutoffs should be smart and look at layer.lod to find bottom and right bounds of groups
    var leftIndexCutoff = (((leftEdge) - xStart) / xSpacing) * rows;
    var rightIndexCutoff = (((rightEdge) - xStart) / xSpacing) * rows;
    var topRowCutoff = (yStart - topEdge) / ySpacing;
    var bottomRowCutoff = (yStart - bottomEdge) / ySpacing;

    // Pick offscreen by index
    var i;
    var row;
    // left edge pick
    if (leftIndexCutoff > layer.tweets.length) {
      leftIndexCutoff = layer.tweets.length;
    }
    for (i = 0; i < leftIndexCutoff; i++) {
      offScreen[i] = true;
    }
    // right edge pick
    if (rightIndexCutoff < 0) {
      rightIndexCutoff = 0;
    }
    for (i = Math.floor(rightIndexCutoff); i < layer.tweets.length; i++) {
      offScreen[i] = true;
    }
    // top edge pick (by row)
    if (topRowCutoff > rows) {
      topRowCutoff = rows;
    }
    for (row = 0; row < topRowCutoff; row++) {
      // every index in that row
      for (i = row; i < layer.tweets.length; i += rows) {
        offScreen[i] = true;
      }
    }
    // bottom edge pick (by row)
    if (bottomRowCutoff < 0) {
      bottomRowCutoff = 0;
    }
    for (row = Math.floor(bottomRowCutoff); row < rows; row++) {
      // every index in that row
      for (i = row; i < layer.tweets.length; i += rows) {
        offScreen[i] = true;
      }
    }

    // what is onscreen
    if (bottomRowCutoff > rows) {
      bottomRowCutoff = rows;
    }
    if (rightIndexCutoff > layer.tweets.length) {
      rightIndexCutoff = layer.tweets.length;
    }
    if (leftIndexCutoff < 0) {
      leftIndexCutoff = 0;
    }
    if (topRowCutoff < 0) {
      topRowCutoff = 0;
    }
    for (row = Math.floor(topRowCutoff); row < bottomRowCutoff; row++) {
      for (i = row; i < rightIndexCutoff; i += rows) {
        if (i >= leftIndexCutoff) {
          onScreen[i] = true;
        }
      }
    }

    return {
      offScreen: offScreen,
      onScreen: onScreen
    };
  };

  // Main animation function, runs 60 times a second (or less, if throttled)
  var animate = function() {
    var cameraMoved = false;

    setTimeout( function() {
        requestAnimationFrame( animate );
    }, 1000 / 15 );

    tick++;

    // check if camera has moved
    if (!camera.position.equals(prevCameraPosition)) {
      // if so, adjust ribbon width so you don't see the left/right ends of the ribbon
      adjustRibbonWidth();
      updateTweetLOD();
      cameraMoved = true;
    }

    prevCameraPosition.copy(camera.position);

    // auto scroll if tweets are falling off the right
    if (!leftHover && !rightHover) {
      if (layers[0].tweets && layers[0].tweets.length) {
        var lastTweet = layers[0].tweets[layers[0].tweets.length-1];
        if (lastTweet.obj) {
          lastTweet.position.copy(lastTweet.obj.position);
        }
        var lastTweetPosition = lastTweet.position;
        var rightEdge = displayHelpers.getDisplayWidthAtPoint(camera, controls.target.x, controls.target.y, frontLayerZ)/2 + camera.position.x;
        if ((lastTweetPosition.x + xSpacing) > rightEdge) {
          var distanceToGo = (lastTweetPosition.x + xSpacing) - rightEdge;
          scrollSpeed = 10 * distanceToGo/100;
          rightAutoScroll = true;
        } else {
          rightAutoScroll = false;
        }
      }
    }

    // cull and restore
    if (cameraMoved && tick % 4 === 0) {
      var i;
      var t;
      var thisTweet;
      var tmp;

      layers.forEach(function (layer) {
        var screenCheck = getIndexesOffScreen(layer);

        // cull everything offscreen
        var offScreenIndexes = Object.keys(screenCheck.offScreen);
        for (i = 0; i < offScreenIndexes.length; i++) {
          t = +offScreenIndexes[i];
          thisTweet = layer.tweets[t];
          // if this tweet holds a renderable obj (in zoomed-out lods, many do not)
          if (thisTweet.obj) {
            var corners = blockCorners(t, layer);
            if (corners && corners[0] in screenCheck.offScreen &&
              corners[1] in screenCheck.offScreen && corners[2] in screenCheck.offScreen) {
              killTweetObj(t, layer);
              thisTweet.hidden = true;
            }
          } else {
            thisTweet.hidden = true;
          }
        }


        // restore everything onscreen that has no obj
        var onScreenIndexes = Object.keys(screenCheck.onScreen);
        for (i = 0; i < onScreenIndexes.length; i++) {
          t = +onScreenIndexes[i];
          thisTweet = layer.tweets[t];
          // if this tweet SHOULD hold a renderable obj when onscreen
          if ( isAnchor(t, layer) && thisTweet.hidden ) {
            //console.log('attempting to restore: ' + thisTweet.index + ' t: ' + t);
            if (layer.lod === 'lo2' || layer.lod === 'lo1') {
              thisTweet.lod = 'x';
              thisTweet.hidden = false;
              swapLOD(thisTweet, layer.lod, layer);
            } else if (layer.lod === 'individual' && thisTweet.hidden) {
                tmp = thisTweet.lod;
                thisTweet.lod = 'x';
                thisTweet.hidden = false;
                swapLOD(thisTweet, tmp, layer);
            }
          } else {
            thisTweet.hidden = false;
          }
        }
      });
    }

    if (rightHover || (rightAutoScroll && !neverAutoScroll)) {
      if (rightHover) {
        scrollSpeed = baseScrollSpeed;
      }
      camera.position.x += scrollSpeed;
      controls.target.x += scrollSpeed;

    }
    TWEEN.update();
    controls.update();
      render();
  };

  // Make 4 sentiment layers -
  // Currently hardcoded, can make more flexible
  var makeLayers = function () {
    var numLayers = 4;
    frontLayerZ = numLayers * layerSpacing;
    makeTweetLayer('baseLayerResults', 'word', frontLayerZ);
    makeTweetLayer('emoticonLayerResults', 'emoji', frontLayerZ - layerSpacing);
    makeTweetLayer('slangLayerResults', 'slang', frontLayerZ - layerSpacing*2);
    makeTweetLayer('negationLayerResults', 'negation', frontLayerZ - layerSpacing*3);
    scope.layers = layers;
  };

  // Run once on page load
  var init = function(context, passedScope) {
    scope = passedScope;
    console.log(context);

    var height = window.innerHeight;
    var containerID = 'container-3d';
    var cameraY, cameraZ;

    rows = 4;
    ribbonHeight = 1000;
    layers = [];
    layersSeparated = true;

    // Overwrite defaults if in macro mode
    // We currently don't have any other modes but might want to put it
    // in a container on another page in the future, or something.
    if (context === 'macro') {
      cameraZ = 5000;
      cameraY = 0;
      rows = 25;
    }

    // Init scenes, camera, renderer
    sceneCSS = new THREE.Scene();
    sceneGL = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 75, document.getElementById(containerID).clientWidth / height, 10, 40000 );

    camera.position.z = cameraZ !== undefined ? cameraZ : 1000;
    camera.position.y = cameraY !== undefined ? cameraY : 200;

    rendererCSS = new THREE.CSS3DRenderer();
    rendererCSS.domElement.style.position = 'absolute';
    rendererCSS.domElement.style.top = 0;

    rendererGL = new THREE.WebGLRenderer( {antialias: true} );
    rendererGL.setClearColor( 0x000000 );
    rendererGL.setPixelRatio( window.devicePixelRatio );

    document.getElementById( containerID ).appendChild( rendererGL.domElement );
    document.getElementById( containerID ).appendChild( rendererCSS.domElement );

    camera.aspect = document.getElementById(containerID).clientWidth/document.getElementById(containerID).clientHeight;
    camera.updateProjectionMatrix();

    rendererCSS.setSize( document.getElementById(containerID).clientWidth, document.getElementById(containerID).clientHeight );
    rendererGL.setSize( document.getElementById(containerID).clientWidth, document.getElementById(containerID).clientHeight - 1 );

    // Resize display when window resizes
    window.onresize = function () {
      rendererCSS.setSize( document.getElementById(containerID).clientWidth, document.getElementById(containerID).clientHeight );
      rendererGL.setSize( document.getElementById(containerID).clientWidth, document.getElementById(containerID).clientHeight - 1 );

      camera.aspect = document.getElementById(containerID).clientWidth/document.getElementById(containerID).clientHeight;
      camera.updateProjectionMatrix();
      adjustRibbonWidth();
    };

    // Initialize control module - mouse and touchscreen controls
    controls = new THREE.TrackballControls( camera, rendererCSS.domElement );
    controls.rotateSpeed = 1;
    controls.maxDistance = 10000;
    controls.addEventListener( 'change', render );
    if (context === 'macro') {
      controls.maxDistance = 40000;
      //ribbonHeight = 100;
      xStart = 0 - (displayHelpers.getDisplayWidthAtPoint(camera,0,0,0) / 4);
    }

    // Add flatten/separate button functionality
    addButtonEvent('flatten-separate-3d', 'click', function() {
      if (layersSeparated) {
        flattenLayers();
        layersSeparated = false;
      } else {
        separateLayers();
        layersSeparated = true;
      }
    });

    initRepeatable(25);
  };

  // This portion of init can be repeated while on the same page
  // Use for reloading the display on a new search or changing the number of rows
  var initRepeatable = function (numRows) {

    layers = [];
    layersSeparated = true;

    rows = numRows;
    
    ribbonHeight = rows * (ySpacing + 50);

    makeLayers();

    controls.maxDistance = numRows * 1000;
    camera.position.z = numRows * 250;

    xStart = 0 - (displayHelpers.getDisplayWidthAtPoint(camera,0,0,frontLayerZ) / 2) + xSpacing/2;
    yStart = ((rows-1)*ySpacing)/2;

    prevCameraPosition = new THREE.Vector3();
    prevCameraPosition.copy(camera.position);
    
    render();
    adjustRibbonWidth();

  };



  return {
    addTweet: addTweet,
    makeTweetLayer: makeTweetLayer,
    init: init,
    reinit: initRepeatable,
    clear: clear,
    animate: animate,
    autoScrollToggle: autoScrollToggle,
    updateLayers: updateLayers
  };
}]);
  